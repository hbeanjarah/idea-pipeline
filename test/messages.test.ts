import { afterEach, describe, expect, it, vi } from 'vitest';

import { handle } from '@/background/messages';
import { readToken, writeToken } from '@/background/session';
import type { createChromeIdentityStub } from './chromeIdentityStub';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// A test seeds its own state: there is no protocol message for handing the
// worker a token any more, and there should not be one.
const signedIn = () => writeToken('tok');

const identity = () =>
  globalThis.chrome.identity as unknown as ReturnType<
    typeof createChromeIdentityStub
  >;

describe('the session requests', () => {
  it('reports no session before one is set', async () => {
    expect(await handle({ kind: 'session/status' })).toEqual({
      ok: true,
      data: { connected: false },
    });
  });

  it('reports a session once set, and drops it when cleared', async () => {
    await signedIn();
    expect(await handle({ kind: 'session/status' })).toEqual({
      ok: true,
      data: { connected: true },
    });

    vi.stubGlobal('fetch', respond(204, null));
    await handle({ kind: 'session/signOut' });

    expect(await handle({ kind: 'session/status' })).toEqual({
      ok: true,
      data: { connected: false },
    });
  });
});

describe('the idea requests', () => {
  it('refuse to call the api without a session', async () => {
    const fetched = respond(200, []);
    vi.stubGlobal('fetch', fetched);

    expect(await handle({ kind: 'ideas/list' })).toEqual({
      ok: false,
      failure: { reason: 'unauthenticated' },
    });
    expect(fetched).not.toHaveBeenCalled();
  });

  it('route each kind to its own operation', async () => {
    await signedIn();
    const fetched = respond(200, {});
    vi.stubGlobal('fetch', fetched);

    await handle({ kind: 'ideas/list' });
    await handle({ kind: 'ideas/create', text: 'x' });
    await handle({
      kind: 'ideas/addVariation',
      ideaId: 'i',
      text: 'x',
    });
    await handle({
      kind: 'ideas/editVariation',
      ideaId: 'i',
      variationId: 'v',
      text: 'x',
    });
    await handle({
      kind: 'ideas/setLabel',
      ideaId: 'i',
      labelId: 'l',
    });
    await handle({
      kind: 'ideas/setTitle',
      ideaId: 'i',
      title: 'Un titre',
    });
    await handle({ kind: 'ideas/delete', ideaId: 'i' });
    await handle({ kind: 'labels/list' });
    await handle({ kind: 'labels/create', name: 'Prêt' });
    await handle({ kind: 'labels/reorder', ids: ['l'] });
    await handle({
      kind: 'labels/rename',
      labelId: 'l',
      name: 'Publié',
    });
    await handle({ kind: 'labels/delete', labelId: 'l' });

    // A mis-wired switch branch would still answer ok, on the wrong endpoint.
    // Path only: the host comes from VITE_API_URL, and asserting it would tie
    // this test to the .env of whoever runs it.
    expect(
      fetched.mock.calls.map(
        (call) =>
          `${(call[1] as { method: string }).method} ${new URL(String(call[0])).pathname}`,
      ),
    ).toEqual([
      'GET /ideas',
      'POST /ideas',
      'POST /ideas/i/variations',
      'PATCH /ideas/i/variations/v',
      'PATCH /ideas/i',
      'PATCH /ideas/i/title',
      'DELETE /ideas/i',
      'GET /labels',
      'POST /labels',
      'PATCH /labels',
      'PATCH /labels/l',
      'DELETE /labels/l',
    ]);
  });

  it('forget the session as soon as the api rejects it', async () => {
    await signedIn();
    vi.stubGlobal(
      'fetch',
      respond(401, { error: 'Authentification requise.' }),
    );

    const reply = await handle({ kind: 'ideas/list' });

    expect(reply).toEqual({
      ok: false,
      failure: { reason: 'unauthenticated' },
    });
    // Keeping a token the server has already refused would make every later
    // call fail the same way, and keep the panel out of the sign-in screen.
    expect(await readToken()).toBeNull();
  });

  it('keep the session on a failure that is not about it', async () => {
    await signedIn();
    vi.stubGlobal('fetch', respond(500, {}));

    await handle({ kind: 'ideas/list' });

    expect(await readToken()).toBe('tok');
  });
});

describe('signing in with Google', () => {
  const CLIENT = 'client-123.apps.googleusercontent.com';

  it('asks for a code with an S256 challenge, then keeps the token', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT);
    // The state is generated inside the flow, so the stub echoes back the one
    // it was given: that is what makes a nominal round-trip playable.
    identity().answerWith(
      'https://x.chromiumapp.org/?code=the-code&state={state}',
    );
    const fetched = respond(201, {
      token: 'fresh',
      user: { id: 'u1', email: 'c@example.com' },
    });
    vi.stubGlobal('fetch', fetched);

    expect(await handle({ kind: 'session/signIn' })).toEqual({
      ok: true,
      data: { user: { id: 'u1', email: 'c@example.com' } },
    });
    expect(await readToken()).toBe('fresh');

    const sent = new URL(identity().lastUrl() ?? 'https://x/');
    expect(sent.searchParams.get('code_challenge_method')).toBe(
      'S256',
    );
    expect(sent.searchParams.get('client_id')).toBe(CLIENT);
    expect(sent.searchParams.get('code_challenge')).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    // The verifier is what proves we hold the challenge; it must reach the
    // server and never the authorization URL.
    expect(sent.searchParams.get('code_verifier')).toBeNull();
    expect(
      JSON.parse(
        (fetched.mock.calls[0] as [string, RequestInit])[1]
          .body as string,
      ).codeVerifier,
    ).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('reports a closed window as cancelled, and stays signed out', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT);
    identity().rejectWith('The user did not approve access.');

    expect(await handle({ kind: 'session/signIn' })).toEqual({
      ok: false,
      failure: { reason: 'cancelled' },
    });
    expect(await readToken()).toBeNull();
  });

  it('refuses a redirect whose state is not the one it sent', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT);
    identity().answerWith(
      'https://x.chromiumapp.org/?code=c&state=forged',
    );
    const fetched = respond(201, {});
    vi.stubGlobal('fetch', fetched);

    expect(await handle({ kind: 'session/signIn' })).toEqual({
      ok: false,
      failure: { reason: 'server' },
    });
    expect(fetched).not.toHaveBeenCalled();
    expect(await readToken()).toBeNull();
  });
});

describe('signing out', () => {
  it('revokes the session server side, then forgets the token', async () => {
    await signedIn();
    const fetched = respond(204, null);
    vi.stubGlobal('fetch', fetched);

    expect(await handle({ kind: 'session/signOut' })).toEqual({
      ok: true,
      data: { revoked: true },
    });

    const [url, init] = fetched.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(`${init.method} ${String(url)}`).toMatch(
      /DELETE .*\/auth\/session$/,
    );
    expect(await readToken()).toBeNull();
  });

  it('leaves anyway when the server cannot be told', async () => {
    await signedIn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline')),
    );

    expect(await handle({ kind: 'session/signOut' })).toEqual({
      ok: true,
      data: { revoked: false },
    });
    // Leaving is what the user asked for: refusing because the network is
    // down would keep them signed in against their will.
    expect(await readToken()).toBeNull();
  });

  it('counts an already dead session as revoked', async () => {
    await signedIn();
    vi.stubGlobal(
      'fetch',
      respond(401, { error: 'Authentification requise.' }),
    );

    expect(await handle({ kind: 'session/signOut' })).toEqual({
      ok: true,
      data: { revoked: true },
    });
  });
});
