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
