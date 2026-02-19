import { Client, Account, Databases } from 'appwrite';

const endpoint  = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

// Flag so the rest of the app can check before making any SDK calls
export const isConfigured =
  !!endpoint &&
  !!projectId &&
  !projectId.startsWith('YOUR_');

// Safe client — only initialised when env vars are real values
let client, account, databases;

if (isConfigured) {
  client    = new Client().setEndpoint(endpoint).setProject(projectId);
  account   = new Account(client);
  databases = new Databases(client);
} else {
  // Stub objects so imports don't throw at module parse time
  account   = {};
  databases = {};
  client    = null;
}

export { account, databases, client };
export const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'mailsense_db';
export default client;
