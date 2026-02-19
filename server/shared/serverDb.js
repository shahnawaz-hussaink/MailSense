import { Client, Databases } from 'node-appwrite';

/**
 * Creates a server-privileged Appwrite Databases client.
 * Uses the scoped API key — never expose to frontend.
 */
export function serverDb() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  return new Databases(client);
}

/**
 * Creates a server-privileged Appwrite client (for multi-service use).
 */
export function serverClient() {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

/**
 * Creates a user-scoped Appwrite client from a JWT.
 * Used to verify caller identity without trusting client-provided IDs.
 */
export function userClient(jwt) {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setJWT(jwt);
}

export const DB_ID          = () => process.env.APPWRITE_DATABASE_ID;
export const COL_USERS      = 'users';
export const COL_EMAILS     = 'emails';
export const COL_ENTITIES   = 'extracted_entities';
export const COL_SUBS       = 'subscriptions';
export const COL_RATE_LIMIT = 'rate_limit_log';
