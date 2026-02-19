import { google } from 'googleapis';
import { decrypt, encrypt } from '../../../shared/crypto.js';
import { serverDb, DB_ID, COL_USERS } from '../../../shared/serverDb.js';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Builds an authenticated Gmail API client for a given user.
 * Auto-refreshes the access token if it's within 5 minutes of expiry,
 * and persists the updated encrypted token back to the DB.
 *
 * @param {object} userDoc - User document from `users` collection
 * @returns {object} Authenticated Gmail API client
 */
export async function buildGmailClient(userDoc) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const accessToken  = decrypt(userDoc.googleAccessTokenEnc);
  const refreshToken = decrypt(userDoc.googleRefreshTokenEnc);
  const expiresAt    = userDoc.tokenExpiresAt ? new Date(userDoc.tokenExpiresAt).getTime() : 0;

  oauth2Client.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
    expiry_date:   expiresAt,
  });

  // Token expired or expiring soon — refresh it
  if (Date.now() > expiresAt - REFRESH_BUFFER_MS) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Persist refreshed token back to DB
    const db = serverDb();
    await db.updateDocument(DB_ID(), COL_USERS, userDoc.$id, {
      googleAccessTokenEnc: encrypt(credentials.access_token),
      tokenExpiresAt: new Date(credentials.expiry_date).toISOString(),
    });
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetches only new message IDs since the last sync using Gmail's History API.
 * Falls back to a timestamp-based query if historyId is missing or expired.
 *
 * @param {object} gmail - Authenticated Gmail client
 * @param {object} userDoc - User document
 * @param {number} [maxResults=500]
 * @returns {{ ids: string[], newHistoryId: string|null }}
 */
export async function getIncrementalMessageIds(gmail, userDoc, maxResults = 500) {
  // ── Strategy 1: History API (most efficient — only fetches delta) ───────
  if (userDoc.gmailHistoryId) {
    try {
      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: userDoc.gmailHistoryId,
        historyTypes: ['messageAdded'],
        maxResults,
      });

      const historyItems = response.data.history || [];
      const ids = historyItems
        .flatMap(h => h.messagesAdded || [])
        .map(m => m.message.id)
        .filter(Boolean);

      return {
        ids,
        newHistoryId: response.data.historyId || userDoc.gmailHistoryId,
      };
    } catch (err) {
      // 404 = historyId expired (>7 days since last sync). Fall through.
      if (err.code !== 404) throw err;
    }
  }

  // ── Strategy 2: Timestamp-based query (full fetch bounded by date) ──────
  // Default: fetch last 30 days on first sync, or since lastSyncedAt
  const afterDate = userDoc.lastSyncedAt
    ? new Date(userDoc.lastSyncedAt)
    : new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const afterUnix = Math.floor(afterDate.getTime() / 1000);

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${afterUnix}`,
    maxResults,
  });

  const ids = (response.data.messages || []).map(m => m.id);

  return {
    ids,
    newHistoryId: null, // Will be extracted from first fetched message
  };
}

/**
 * Batch-fetches full message details for an array of message IDs.
 * Processes in batches of 50 to avoid overwhelming the Gmail API.
 *
 * @param {object} gmail - Authenticated Gmail client
 * @param {string[]} messageIds
 * @returns {object[]} Array of full Gmail message objects
 */
export async function batchFetchMessages(gmail, messageIds) {
  const BATCH_SIZE = 50;
  const results = [];

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map(id =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        }),
      ),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value.data);
      }
      // Silently skip failed individual message fetches
    }
  }

  return results;
}
