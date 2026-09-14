import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { ApiError } from '#config/api-error';
import { app } from '#app';

// Google is the one thing the tests cannot call. Everything below it — account
// creation, session issuing, error mapping — is ours and is exercised for real.
vi.mock('#config/google', () => ({ exchangeCode: vi.fn() }));

const { exchangeCode } = await import('#config/google');
const google = vi.mocked(exchangeCode);

let server: Server;
let base: string;

beforeEach(async () => {
  google.mockReset();
  server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once('listening', resolve),
  );
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

const signIn = (body: unknown) =>
  fetch(`${base}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const me = (token: string) =>
  fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

const VALID = { code: 'abc', codeVerifier: 'xyz' };

interface SignedIn {
  token: string;
  user: { id: string; email: string };
}

describe('POST /auth/google', () => {
  it('opens a usable session for a new account', async () => {
    google.mockResolvedValue({
      sub: 'sub-1',
      email: 'moi@example.test',
    });

    const res = await signIn(VALID);

    expect(res.status).toBe(201);
    const body = (await res.json()) as SignedIn;
    expect(body.user.email).toBe('moi@example.test');
    expect((await me(body.token)).status).toBe(200);
  });

  it('reuses the account on a second sign-in and adds a session', async () => {
    google.mockResolvedValue({
      sub: 'sub-1',
      email: 'moi@example.test',
    });

    const first = (await (await signIn(VALID)).json()) as SignedIn;
    const second = (await (await signIn(VALID)).json()) as SignedIn;

    expect(second.user.id).toBe(first.user.id);
    expect(second.token).not.toBe(first.token);
    // Signing in on a second device must not close the first one.
    expect((await me(first.token)).status).toBe(200);
    expect((await me(second.token)).status).toBe(200);
  });

  it('follows the address when Google reports a new one', async () => {
    google.mockResolvedValue({
      sub: 'sub-1',
      email: 'avant@example.test',
    });
    const before = (await (await signIn(VALID)).json()) as SignedIn;

    google.mockResolvedValue({
      sub: 'sub-1',
      email: 'apres@example.test',
    });
    const after = (await (await signIn(VALID)).json()) as SignedIn;

    // The sub is the identity, not the address: same account, new email.
    expect(after.user.id).toBe(before.user.id);
    expect(after.user.email).toBe('apres@example.test');
  });

  it('passes on the refusal when Google rejects the code', async () => {
    google.mockRejectedValue(
      new ApiError(400, "Code d'autorisation invalide."),
    );

    const res = await signIn(VALID);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Code d'autorisation invalide.",
    });
  });

  it('answers 502 when Google cannot be reached', async () => {
    google.mockRejectedValue(
      new ApiError(502, "Service d'authentification indisponible."),
    );

    const res = await signIn(VALID);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Service d'authentification indisponible.",
    });
  });

  it('rejects a body that is not the contract, without calling Google', async () => {
    for (const body of [
      {},
      { code: 'abc' },
      { codeVerifier: 'xyz' },
      { ...VALID, extra: 1 },
      { code: '   ', codeVerifier: 'xyz' },
    ]) {
      const res = await signIn(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Code d'autorisation invalide.",
      });
    }
    expect(google).not.toHaveBeenCalled();
  });

  it('needs no session of its own', async () => {
    google.mockResolvedValue({
      sub: 'sub-1',
      email: 'moi@example.test',
    });

    // Not one Authorization header in this file: this is the endpoint that
    // must work without one.
    expect((await signIn(VALID)).status).toBe(201);
  });
});
