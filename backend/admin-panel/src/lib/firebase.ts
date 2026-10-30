import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId: string;
  appId?: string;
};

function configFromEnv(): FirebaseClientConfig | null {
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim();
  if (!databaseURL) return null;

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || 'firebase-api-key',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    databaseURL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'car-comfort',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || undefined,
  };
}

let app: FirebaseApp | null = null;
let database: Database | null = null;
let initPromise: Promise<Database | null> | null = null;

function initDatabase(config: FirebaseClientConfig): Database {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  }
  if (!database) {
    database = getDatabase(app);
  }
  return database;
}

async function fetchConfigFromApi(): Promise<FirebaseClientConfig | null> {
  const { default: api } = await import('@/lib/api');
  const res = await api.get<{
    data?: {
      configured?: boolean;
      databaseURL?: string;
      apiKey?: string;
      projectId?: string;
      authDomain?: string;
      appId?: string;
    };
  }>('/admin/support/firebase-config');

  const data = res.data?.data;
  if (!data?.configured || !data.databaseURL) return null;

  return {
    databaseURL: data.databaseURL,
    apiKey: data.apiKey || 'firebase-api-key',
    projectId: data.projectId || 'car-comfort',
    authDomain: data.authDomain,
    appId: data.appId,
  };
}

const FIREBASE_NOT_CONFIGURED_MSG =
  'Firebase is not configured for live support chat. Set FIREBASE_DATABASE_URL (and FIREBASE_PROJECT_ID) in the API .env, or set NEXT_PUBLIC_FIREBASE_DATABASE_URL in admin-panel/.env.local, then restart the servers.';

/** Sync init from NEXT_PUBLIC_* only (may return null). */
export function getSupportChatDatabase(): Database | null {
  const config = configFromEnv();
  if (!config) return null;
  return initDatabase(config);
}

/** Env first, then GET /admin/support/firebase-config from the API. */
export async function getSupportChatDatabaseAsync(): Promise<Database | null> {
  const fromEnv = configFromEnv();
  if (fromEnv) return initDatabase(fromEnv);
  if (database) return database;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const config = await fetchConfigFromApi();
        if (!config) return null;
        return initDatabase(config);
      } catch {
        return null;
      }
    })();
  }

  return initPromise;
}

export { FIREBASE_NOT_CONFIGURED_MSG };

export const SUPPORT_CHAT_ROOT = 'support_chats';
