import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { app } from '#app';
import { addDevice, createUserWithSession } from '#test/factories';

let server: Server;
let base: string;

beforeEach(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once('listening', resolve),
  );
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

const as = (token: string, path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });

const UNAUTHENTICATED = { error: 'Authentification requise.' };

describe('GET /auth/me', () => {
  it('answers with the account behind the session', async () => {
    const { userId, token } = await createUserWithSession(
      'moi@example.test',
    );

    const res = await as(token, '/auth/me');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: userId,
      email: 'moi@example.test',
    });
  });

  it('answers 401 without a token', async () => {
    const res = await fetch(`${base}/auth/me`);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(UNAUTHENTICATED);
  });

  it('answers 401 on a token that means nothing', async () => {
    const res = await as('not-a-token', '/auth/me');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(UNAUTHENTICATED);
  });

  it('answers 401 when the scheme is not Bearer', async () => {
    const { token } = await createUserWithSession();

    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Basic ${token}` },
    });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /auth/session', () => {
  it('logs this device out and leaves the other one alone', async () => {
    // Two devices of the SAME account: createUserWithSession twice would make
    // two different accounts, and the assertion below would prove nothing.
    const { userId, token: laptop } = await createUserWithSession();
    const phone = await addDevice(userId);

    const out = await as(laptop, '/auth/session', {
      method: 'DELETE',
    });
    expect(out.status).toBe(204);

    expect((await as(laptop, '/auth/me')).status).toBe(401);
    expect((await as(phone, '/auth/me')).status).toBe(200);
  });
});
