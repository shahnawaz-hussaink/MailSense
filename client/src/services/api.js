import axios from 'axios';

// ── Appwrite Function base URLs ───────────────────────────────────────────────
const FN = {
  syncEmails:    import.meta.env.VITE_FN_SYNC_EMAILS_URL,
  aiQuery:       import.meta.env.VITE_FN_AI_QUERY_URL,
  deleteAccount: import.meta.env.VITE_FN_DELETE_ACCOUNT_URL,
};

/**
 * Creates axios instance with Authorization header from JWT.
 */
function createClient(jwt) {
  return axios.create({
    headers: {
      'Content-Type':          'application/json',
      'x-appwrite-user-jwt':   jwt,
    },
  });
}

// ── Email Sync ────────────────────────────────────────────────────────────────
export async function syncEmails(jwt) {
  const client = createClient(jwt);
  const res    = await client.post(FN.syncEmails, {});
  return res.data;
}

// ── AI Query ──────────────────────────────────────────────────────────────────
export async function runAiQuery(jwt, query) {
  const client = createClient(jwt);
  const res    = await client.post(FN.aiQuery, { query });
  return res.data;
}

// ── Delete Account ────────────────────────────────────────────────────────────
export async function deleteAccount(jwt) {
  const client = createClient(jwt);
  const res    = await client.delete(FN.deleteAccount, {});
  return res.data;
}
