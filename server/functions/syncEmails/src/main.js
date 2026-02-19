import { Query, ID } from 'node-appwrite';
import { premiumGuard }                              from '../../../shared/premiumGuard.js';
import { serverDb, DB_ID, COL_USERS, COL_EMAILS }    from '../../../shared/serverDb.js';
import { buildGmailClient, getIncrementalMessageIds, batchFetchMessages } from './gmailClient.js';
import { normalizeEmail }                             from './normalizeEmail.js';

/**
 * syncEmails — HTTP Appwrite Function
 *
 * Triggers: HTTP POST (user-initiated) + Cron "0 * /6 * * *" (auto-sync)
 *
 * Flow:
 *  1. Verify caller JWT (prevents unauthenticated calls)
 *  2. Load user document (encrypted tokens + sync cursor)
 *  3. Lock sync (prevent concurrent runs per user)
 *  4. Build Gmail client (auto-refresh OAuth token)
 *  5. Fetch new message IDs (History API → timestamp fallback)
 *  6. Batch-fetch full message details
 *  7. Normalize + deduplicate + store emails
 *  8. Update sync cursor (gmailHistoryId + lastSyncedAt)
 *  9. Release lock
 */
export default async ({ req, res, log, error }) => {
  const db = serverDb();

  // ── 1. Authenticate caller ────────────────────────────────────────────────
  const guard = await premiumGuard(req);
  if (guard.error) return res.json({ error: guard.error }, guard.status);

  const { userId, userDoc } = guard;

  // ── 2. Prevent concurrent sync for same user ──────────────────────────────
  if (userDoc.syncStatus === 'syncing') {
    return res.json({ success: false, message: 'Sync already in progress' }, 409);
  }

  // ── 3. Acquire sync lock ──────────────────────────────────────────────────
  await db.updateDocument(DB_ID(), COL_USERS, userDoc.$id, {
    syncStatus: 'syncing',
  });

  const stats = { fetched: 0, stored: 0, skipped: 0, failed: 0 };
  let newHistoryId = userDoc.gmailHistoryId;

  try {
    // ── 4. Build Gmail client ───────────────────────────────────────────────
    const gmail = await buildGmailClient(userDoc);

    // ── 5. Fetch incremental message IDs ────────────────────────────────────
    const { ids, newHistoryId: syncedHistoryId } =
      await getIncrementalMessageIds(gmail, userDoc);

    stats.fetched = ids.length;
    if (syncedHistoryId) newHistoryId = syncedHistoryId;

    log(`[syncEmails] userId=${userId} | new messages=${ids.length}`);

    if (ids.length === 0) {
      await releaseLock(db, userDoc, newHistoryId, 'idle');
      return res.json({ success: true, ...stats, message: 'Inbox up to date' });
    }

    // ── 6. Batch-fetch full message details ──────────────────────────────────
    const messages = await batchFetchMessages(gmail, ids);

    // Derive the latest historyId from actual fetched messages
    if (messages.length > 0 && !newHistoryId) {
      const highestHistoryId = messages
        .map(m => BigInt(m.historyId || '0'))
        .reduce((a, b) => (a > b ? a : b))
        .toString();
      newHistoryId = highestHistoryId;
    }

    // ── 7. Normalize → deduplicate → store ───────────────────────────────────
    for (const msg of messages) {
      try {
        const normalized = normalizeEmail(msg, userId);

        // Dedup: skip if this Gmail message already exists for this user
        const existing = await db.listDocuments(DB_ID(), COL_EMAILS, [
          Query.equal('userId', userId),
          Query.equal('gmailId', normalized.gmailId),
          Query.limit(1),
        ]);

        if (existing.total > 0) {
          stats.skipped++;
          continue;
        }

        await db.createDocument(DB_ID(), COL_EMAILS, ID.unique(), normalized);
        stats.stored++;
      } catch (msgErr) {
        error(`[syncEmails] Failed to store gmailId=${msg.id}: ${msgErr.message}`);
        stats.failed++;
      }
    }

    // ── 8. Update sync cursor ─────────────────────────────────────────────────
    await releaseLock(db, userDoc, newHistoryId, 'idle');

    log(`[syncEmails] DONE | ${JSON.stringify(stats)}`);
    return res.json({ success: true, ...stats });

  } catch (e) {
    error(`[syncEmails] Fatal error for userId=${userId}: ${e.message}`);
    await releaseLock(db, userDoc, newHistoryId, 'error');
    return res.json({ error: 'Sync failed', details: e.message }, 500);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function releaseLock(db, userDoc, newHistoryId, status) {
  const updates = {
    syncStatus:    status,
    lastSyncedAt:  new Date().toISOString(),
  };
  if (newHistoryId) updates.gmailHistoryId = newHistoryId;

  await db.updateDocument(DB_ID(), COL_USERS, userDoc.$id, updates);
}
