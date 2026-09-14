import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { exchangeCode } from '#config/google';

// The one module that talks to the outside world, so the outside world is what
// gets replaced here — not the module itself.
const answer = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

const idToken = (claims: unknown) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://example.test/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
});

describe('exchangeCode', () => {
  it('reads the identity out of the id_token', async () => {
    vi.stubGlobal(
      'fetch',
      answer(200, {
        id_token: idToken({
          sub: 'sub-1',
          email: 'moi@example.test',
        }),
      }),
    );

    expect(await exchangeCode('code', 'verifier')).toEqual({
      sub: 'sub-1',
      email: 'moi@example.test',
    });
  });

  it('sends the secret and the verifier, never to the client', async () => {
    const fetched = answer(200, {
      id_token: idToken({ sub: 'sub-1', email: 'moi@example.test' }),
    });
    vi.stubGlobal('fetch', fetched);

    await exchangeCode('the-code', 'the-verifier');

    const body = String(fetched.mock.calls[0]![1].body);
    expect(body).toContain('client_secret=secret');
    expect(body).toContain('code_verifier=the-verifier');
    expect(body).toContain('grant_type=authorization_code');
  });

  it('turns a refusal into 400', async () => {
    vi.stubGlobal('fetch', answer(400, { error: 'invalid_grant' }));

    await expect(
      exchangeCode('code', 'verifier'),
    ).rejects.toMatchObject({
      status: 400,
      message: "Code d'autorisation invalide.",
    });
  });

  it('turns a Google outage into 502, not into the client fault', async () => {
    vi.stubGlobal('fetch', answer(503, {}));

    await expect(
      exchangeCode('code', 'verifier'),
    ).rejects.toMatchObject({
      status: 502,
      message: "Service d'authentification indisponible.",
    });
  });

  it('turns a network failure into 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );

    await expect(
      exchangeCode('code', 'verifier'),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it('refuses a response without an id_token', async () => {
    vi.stubGlobal(
      'fetch',
      answer(200, { access_token: 'only-this' }),
    );

    await expect(
      exchangeCode('code', 'verifier'),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it('refuses an id_token missing the claims we identify on', async () => {
    vi.stubGlobal(
      'fetch',
      answer(200, {
        id_token: idToken({ email: 'moi@example.test' }),
      }),
    );

    await expect(
      exchangeCode('code', 'verifier'),
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});
