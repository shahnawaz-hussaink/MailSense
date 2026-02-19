import { Client, Databases, Query, ID } from 'node-appwrite';
import { encrypt } from '../../../shared/crypto.js';
import { serverDb, DB_ID, COL_USERS, COL_SUBS } from '../../../shared/serverDb.js';

/**
 * authOnCreate — Appwrite Event Trigger Function
 *
 * Trigger: users.*.create  (fires when a new Appwrite Auth user is created)
 *
 * Responsibilities:
 *  1. Create a user document in our `users` collection
 *  2. Encrypt + store Google OAuth tokens received from the OAuth callback
 *  3. Create a default free-tier subscription document
 *
 * NOTE: Google tokens are delivered via the Appwrite OAuth session payload.
 *       We extract them here server-side so they NEVER touch the frontend.
 */
export default async ({ req, res, log, error }) => {
  const db = serverDb();

  try {
    // ── Parse the event payload ───────────────────────────────────────────
    // Appwrite sends the new user object as the event payload
    const payload = req.body ? JSON.parse(req.body) : null;

    if (!payload || !payload.$id) {
      error('Invalid event payload — missing user $id');
      return res.json({ error: 'Invalid payload' }, 400);
    }

    const {
      $id: appwriteUserId,
      email,
      name,
      prefs = {},
    } = payload;

    log(`authOnCreate triggered for userId: ${appwriteUserId} | email: ${email}`);

    // ── Check for duplicate (idempotency) ─────────────────────────────────
    const existing = await db.listDocuments(DB_ID(), COL_USERS, [
      Query.equal('appwriteUserId', appwriteUserId),
      Query.limit(1),
    ]);

    if (existing.total > 0) {
      log(`User ${appwriteUserId} already exists — skipping creation`);
      return res.json({ success: true, message: 'User already exists' });
    }

    // ── Extract Google OAuth tokens from prefs or environment ─────────────
    // Appwrite stores OAuth provider tokens in user prefs when using
    // account.createOAuth2Session. They are accessible here via server API key.
    //
    // In production: tokens come from the OAuth session record.
    // We read them via the server client and immediately encrypt them.
    const googleAccessToken  = prefs?.googleAccessToken  || '';
    const googleRefreshToken = prefs?.googleRefreshToken || '';
    const tokenExpiresAt     = prefs?.tokenExpiresAt
      ? new Date(prefs.tokenExpiresAt).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // default: 1h

    // ── Create user document ──────────────────────────────────────────────
    const userDoc = await db.createDocument(DB_ID(), COL_USERS, ID.unique(), {
      appwriteUserId,
      email,
      name:                  name || email.split('@')[0],
      avatarUrl:             prefs?.avatarUrl || '',
      googleAccessTokenEnc:  encrypt(googleAccessToken),
      googleRefreshTokenEnc: encrypt(googleRefreshToken),
      tokenExpiresAt,
      gmailHistoryId:        '',      // populated on first sync
      lastSyncedAt:          null,
      syncStatus:            'idle',
      plan:                  'free',
      stripeCustomerId:      '',
    });

    log(`Created user document: ${userDoc.$id}`);

    // ── Create default subscription (free tier) ───────────────────────────
    await db.createDocument(DB_ID(), COL_SUBS, ID.unique(), {
      userId:               appwriteUserId,
      stripeSubscriptionId: '',
      plan:                 'free',
      status:               'active',
      currentPeriodEnd:     new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      cancelAtPeriodEnd:    false,
      updatedAt:            new Date().toISOString(),
    });

    log(`Created free subscription for userId: ${appwriteUserId}`);

    return res.json({
      success: true,
      userId: appwriteUserId,
      message: 'User and subscription records created',
    });

  } catch (e) {
    error(`authOnCreate failed: ${e.message}`);
    return res.json({ error: e.message }, 500);
  }
};
