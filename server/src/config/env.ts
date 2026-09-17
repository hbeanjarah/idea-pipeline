const DEFAULT_PORT = 3000;

function readPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined) return DEFAULT_PORT;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }

  return port;
}

export const env = {
  port: readPort(),
};

// Read on each call rather than at import time: under vitest the test container
// only publishes its port once the global setup has run, long after this module
// was first imported.
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw === '') {
    throw new Error('DATABASE_URL is required');
  }

  return raw;
}

export function noteKey(): Buffer {
  const raw = process.env.NOTE_KEY_V1;
  if (raw === undefined || raw === '') {
    throw new Error('NOTE_KEY_V1 is required');
  }

  const key = Buffer.from(raw, 'base64');
  // Checked here because nothing downstream would complain: AES-256 takes the
  // key it is handed, and a short one weakens every note in silence.
  if (key.length !== 32) {
    throw new Error(
      `NOTE_KEY_V1 must decode to 32 bytes, got ${key.length}`,
    );
  }

  return key;
}

export function googleConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are required',
    );
  }

  return { clientId, clientSecret, redirectUri };
}
