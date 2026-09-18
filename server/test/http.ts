import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach } from 'vitest';

import { app } from '#app';
import { createUserWithSession } from '#test/factories';

interface HttpHarness {
  // A function, not a value: the account is made anew before each test.
  userId: () => string;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  send: (
    method: string,
    path: string,
    body: unknown,
  ) => Promise<Response>;
}

// Registers its own beforeEach/afterEach, so it must be called at the top level
// of a test file — not inside a describe that runs later.
export function httpHarness(): HttpHarness {
  let server: Server;
  let base: string;
  let token: string;
  let userId: string;

  beforeEach(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) =>
      server.once('listening', resolve),
    );
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    ({ token, userId } = await createUserWithSession());
  });

  afterEach(
    () =>
      new Promise<void>((resolve) => server.close(() => resolve())),
  );

  const api = (path: string, init?: RequestInit) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init?.headers },
    });

  const send = (method: string, path: string, body: unknown) =>
    api(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  return { userId: () => userId, api, send };
}
