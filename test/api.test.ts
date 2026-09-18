import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addVariation,
  ApiFailure,
  createIdea,
  createLabel,
  deleteIdea,
  deleteLabel,
  editVariation,
  fetchIdentity,
  listIdeas,
  listLabels,
  renameLabel,
  reorderLabels,
  setIdeaLabel,
  revokeSession,
  signInWithGoogle,
} from '@/background/api';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

const reasonOf = async (
  promise: Promise<unknown>,
): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    return (error as ApiFailure).failure.reason;
  }
  throw new Error('expected a failure');
};

describe('the http client', () => {
  it('returns what the api answered', async () => {
    vi.stubGlobal('fetch', respond(200, []));

    expect(await listIdeas('token')).toEqual([]);
  });

  it('sends the session token as a bearer', async () => {
    const fetched = respond(200, []);
    vi.stubGlobal('fetch', fetched);

    await listIdeas('the-token');

    const init = fetched.mock.calls[0]![1] as {
      headers: Record<string, string>;
    };
    expect(init.headers.Authorization).toBe('Bearer the-token');
  });

  it('hits the path the contract declares, for every operation', async () => {
    const fetched = respond(200, {});
    vi.stubGlobal('fetch', fetched);

    await listIdeas('t');
    await createIdea('t', 'x');
    await addVariation('t', 'i', 'x');
    await editVariation('t', 'i', 'v', 'x');
    await setIdeaLabel('t', 'i', 'l');
    await deleteIdea('t', 'i');
    await listLabels('t');
    await createLabel('t', 'Prêt');
    await reorderLabels('t', ['l']);
    await renameLabel('t', 'l', 'Publié');
    await deleteLabel('t', 'l');

    // A typo in a path is invisible against a stubbed fetch unless it is
    // asserted: every call would still "succeed".
    //
    // The path alone, never the whole URL: the host comes from VITE_API_URL,
    // so asserting it would make this test pass or fail according to the .env
    // of whoever runs it. It is the routing that is under test here.
    expect(
      fetched.mock.calls.map(
        (call) => new URL(String(call[0])).pathname,
      ),
    ).toEqual([
      '/ideas',
      '/ideas',
      '/ideas/i/variations',
      '/ideas/i/variations/v',
      '/ideas/i',
      '/ideas/i',
      '/labels',
      '/labels',
      '/labels',
      '/labels/l',
      '/labels/l',
    ]);
    expect(
      fetched.mock.calls.map(
        (call) => (call[1] as { method: string }).method,
      ),
    ).toEqual([
      'GET',
      'POST',
      'POST',
      'PATCH',
      'PATCH',
      'DELETE',
      'GET',
      'POST',
      // The collection PATCH and the item PATCH are one character apart.
      'PATCH',
      'PATCH',
      'DELETE',
    ]);
  });

  it('reads 401 as a dead session', async () => {
    vi.stubGlobal(
      'fetch',
      respond(401, { error: 'Authentification requise.' }),
    );

    expect(await reasonOf(listIdeas('token'))).toBe(
      'unauthenticated',
    );
  });

  it('reads 404 as an idea that is gone', async () => {
    vi.stubGlobal(
      'fetch',
      respond(404, { error: 'Idée introuvable.' }),
    );

    expect(await reasonOf(deleteIdea('token', 'id'))).toBe('gone');
  });

  it('carries the server message through on 400', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, { error: 'Champs non autorisés.' }),
    );

    try {
      await createIdea('token', 'x');
      throw new Error('expected a failure');
    } catch (error) {
      const { failure } = error as ApiFailure;
      expect(failure).toEqual({
        reason: 'rejected',
        message: 'Champs non autorisés.',
      });
    }
  });

  it('reads 500 as a server fault', async () => {
    vi.stubGlobal('fetch', respond(500, {}));

    expect(await reasonOf(listIdeas('token'))).toBe('server');
  });

  it('reads a network failure as being offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('failed to fetch')),
    );

    expect(await reasonOf(listIdeas('token'))).toBe('offline');
  });

  it('accepts an empty body on delete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 204,
        ok: true,
        json: async () => null,
      }),
    );

    expect(await deleteIdea('token', 'id')).toBeNull();
  });
});

describe('signing in with Google', () => {
  it('posts the code without an Authorization header', async () => {
    const fetched = respond(201, {
      token: 'tok',
      user: { id: 'u1', email: 'c@example.com' },
    });
    vi.stubGlobal('fetch', fetched);

    const result = await signInWithGoogle('the-code', 'the-verifier');

    expect(result.token).toBe('tok');

    const [, init] = fetched.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body as string)).toEqual({
      code: 'the-code',
      codeVerifier: 'the-verifier',
    });
  });

  it('surfaces a refused code as the server worded it', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, { error: "Code d'autorisation invalide." }),
    );

    await expect(
      signInWithGoogle('bad', 'verifier'),
    ).rejects.toMatchObject({
      failure: {
        reason: 'rejected',
        message: "Code d'autorisation invalide.",
      },
    });
  });
});

describe('the identity and the sign-out', () => {
  it('reads the current user', async () => {
    vi.stubGlobal(
      'fetch',
      respond(200, { id: 'u1', email: 'c@example.com' }),
    );

    expect(await fetchIdentity('tok')).toEqual({
      id: 'u1',
      email: 'c@example.com',
    });
  });

  it('revokes the session with a DELETE', async () => {
    const fetched = respond(204, null);
    vi.stubGlobal('fetch', fetched);

    await revokeSession('tok');

    const [url, init] = fetched.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/auth\/session$/);
    expect(init.method).toBe('DELETE');
  });
});
