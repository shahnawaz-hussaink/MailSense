import { Account, Query, ID } from 'node-appwrite';
import { serverDb, serverClient, userClient, DB_ID, COL_USERS, COL_SUBS, COL_RATE_LIMIT } from './serverDb.js';

/**
 * Guards an Appwrite Function endpoint.
 *
 * Verifies:
 *  1. Request has a valid Appwrite JWT
 *  2. Caller exists in our `users` collection
 *  3. If requirePremium=true, caller has active premium subscription
 *
 * @param {Request} req - Appwrite Function request object
 * @param {object} options
 * @param {boolean} [options.requirePremium=false] - Require active premium subscription
 * @returns {{ userId, userDoc } | { error, status, upgradeUrl? }}
 */
export async function premiumGuard(req, { requirePremium = false } = {}) {
  // 1. Extract JWT
  const jwt =
    req.headers['x-appwrite-user-jwt'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!jwt) {
    return { error: 'Missing authentication token', status: 401 };
  }

  // 2. Verify JWT via user-scoped client
  let appwriteUser;
  try {
    const uClient = userClient(jwt);
    const account = new Account(uClient);
    appwriteUser = await account.get();
  } catch {
    return { error: 'Invalid or expired session', status: 401 };
  }

  const userId = appwriteUser.$id;
  const db = serverDb();

  // 3. Load user document from our DB
  const usersResult = await db.listDocuments(DB_ID(), COL_USERS, [
    Query.equal('appwriteUserId', userId),
    Query.limit(1),
  ]);

  if (!usersResult.total) {
    return { error: 'User profile not found', status: 404 };
  }

  const userDoc = usersResult.documents[0];

  // 4. Premium check (re-verified server-side, never trust frontend)
  if (requirePremium) {
    const subsResult = await db.listDocuments(DB_ID(), COL_SUBS, [
      Query.equal('userId', userId),
      Query.limit(1),
    ]);

    const sub = subsResult.documents[0];
    const isActive =
      sub?.plan === 'premium' &&
      ['active', 'trialing'].includes(sub?.status) &&
      new Date(sub?.currentPeriodEnd) > new Date();

    if (!isActive) {
      return {
        error: 'Premium subscription required',
        status: 403,
        upgradeUrl: process.env.STRIPE_PAYMENT_LINK,
      };
    }
  }

  return { userId, userDoc };
}

/**
 * Rate limiter — counts calls within a sliding time window.
 * Uses `rate_limit_log` collection as a lightweight counter.
 *
 * @param {string} userId
 * @param {string} key - e.g. 'syncEmails', 'aiQuery'
 * @param {number} [maxCalls=10]
 * @param {number} [windowMs=3600000] - 1 hour default
 * @returns {{ limited: boolean, count: number, max: number }}
 */
export async function rateLimit(userId, key, maxCalls = 10, windowMs = 3_600_000) {
  const db = serverDb();
  const since = new Date(Date.now() - windowMs).toISOString();

  const recent = await db.listDocuments(DB_ID(), COL_RATE_LIMIT, [
    Query.equal('userId', userId),
    Query.equal('key', key),
    Query.greaterThan('createdAt', since),
    Query.limit(1), // we only need the count, not the docs
  ]);

  if (recent.total >= maxCalls) {
    return { limited: true, count: recent.total, max: maxCalls };
  }

  // Log this call
  await db.createDocument(DB_ID(), COL_RATE_LIMIT, ID.unique(), {
    userId,
    key,
    createdAt: new Date().toISOString(),
  });

  return { limited: false, count: recent.total + 1, max: maxCalls };
}
