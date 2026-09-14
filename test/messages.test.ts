import { afterEach, describe, expect, it, vi } from 'vitest';

import { handle } from '../src/background/messages';
import { readToken } from '../src/background/session';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

const signedIn = () => handle({ kind: 'session/set', token: 'tok' });

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

    await handle({ kind: 'session/clear' });

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
      kind: 'ideas/changeStatus',
      ideaId: 'i',
      status: 'ready',
    });
    await handle({ kind: 'ideas/delete', ideaId: 'i' });

    // A mis-wired switch branch would still answer ok, on the wrong endpoint.
    expect(
      fetched.mock.calls.map(
        (call) =>
          `${(call[1] as { method: string }).method} ${String(call[0]).replace('http://localhost:3000', '')}`,
      ),
    ).toEqual([
      'GET /ideas',
      'POST /ideas',
      'POST /ideas/i/variations',
      'PATCH /ideas/i/variations/v',
      'PATCH /ideas/i',
      'DELETE /ideas/i',
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
