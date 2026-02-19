import { Query, Users } from 'node-appwrite';
import { premiumGuard }                                                       from '../../../shared/premiumGuard.js';
import { serverDb, serverClient, DB_ID, COL_USERS, COL_EMAILS, COL_ENTITIES, COL_SUBS } from '../../../shared/serverDb.js';

/**
 * deleteAccount — HTTP DELETE Appwrite Function
 *
 * GDPR-compliant full account wipe:
 *  1. Verify caller JWT
 *  2. Hard-delete extracted_entities (child docs first)
 *  3. Hard-delete emails
 *  4. Hard-delete subscriptions
 *  5. Hard-delete user document
 *  6. Revoke Google OAuth token
 *  7. Cancel Stripe subscription (if active)
 *  8. Delete Appwrite Auth user
 */
export default async ({ req, res, log, error }) => {
  // ── 1. Verify caller ──────────────────────────────────────────────────────
  const guard = await premiumGuard(req);
  if (guard.error) return res.json({ error: guard.error }, guard.status);

  const { userId, userDoc } = guard;
  const db = serverDb();

  log(`[deleteAccount] Initiating delete for userId=${userId}`);

  try {
    // ── 2-5. Delete all user data in order (children first) ─────────────────
    await hardDeleteCollection(db, COL_ENTITIES, 'userId', userId, log);
    await hardDeleteCollection(db, COL_EMAILS,   'userId', userId, log);
    await hardDeleteCollection(db, COL_SUBS,     'userId', userId, log);

    // Delete the user document itself
    await hardDeleteCollection(db, COL_USERS, 'appwriteUserId', userId, log);

    // ── 6. Revoke Google OAuth token ─────────────────────────────────────────
    try {
      const { decrypt } = await import('../../../shared/crypto.js');
      const { google }  = await import('googleapis');

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      const accessToken = decrypt(userDoc.googleAccessTokenEnc);
      await oauth2Client.revokeToken(accessToken);
      log(`[deleteAccount] Google token revoked for userId=${userId}`);
    } catch (revokeErr) {
      // Non-fatal — token may already be expired
      error(`[deleteAccount] Google token revoke failed: ${revokeErr.message}`);
    }

    // ── 7. Cancel Stripe subscription ────────────────────────────────────────
    if (userDoc.stripeCustomerId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const subs = await stripe.subscriptions.list({ customer: userDoc.stripeCustomerId, limit: 5 });

        for (const sub of subs.data) {
          if (['active', 'trialing'].includes(sub.status)) {
            await stripe.subscriptions.cancel(sub.id);
          }
        }

        log(`[deleteAccount] Stripe subscriptions cancelled for customerId=${userDoc.stripeCustomerId}`);
      } catch (stripeErr) {
        error(`[deleteAccount] Stripe cancel failed: ${stripeErr.message}`);
      }
    }

    // ── 8. Delete Appwrite Auth user ──────────────────────────────────────────
    const client = serverClient();
    const usersApi = new Users(client);
    await usersApi.delete(userId);

    log(`[deleteAccount] Appwrite Auth user deleted: ${userId}`);

    return res.json({
      success: true,
      message: 'Account and all associated data permanently deleted.',
    });

  } catch (e) {
    error(`[deleteAccount] Failed for userId=${userId}: ${e.message}`);
    return res.json({ error: 'Account deletion failed', details: e.message }, 500);
  }
};

/**
 * Hard deletes all documents in a collection matching a field/value.
 * Paginates in batches of 100 to handle large collections safely.
 */
async function hardDeleteCollection(db, collection, field, value, log) {
  let deleted = 0;
  let batch;

  do {
    batch = await db.listDocuments(DB_ID(), collection, [
      Query.equal(field, value),
      Query.limit(100),
    ]);

    await Promise.all(
      batch.documents.map(doc => db.deleteDocument(DB_ID(), collection, doc.$id))
    );

    deleted += batch.documents.length;
  } while (batch.documents.length === 100);

  log(`[deleteAccount] Deleted ${deleted} docs from ${collection}`);
}
