import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addVariation,
  ApiFailure,
  changeStatus,
  createIdea,
  deleteIdea,
  editVariation,
  listIdeas,
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
    await changeStatus('t', 'i', 'ready');
    await deleteIdea('t', 'i');

    // A typo in a path is invisible against a stubbed fetch unless it is
    // asserted: every call would still "succeed".
    expect(fetched.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:3000/ideas',
      'http://localhost:3000/ideas',
      'http://localhost:3000/ideas/i/variations',
      'http://localhost:3000/ideas/i/variations/v',
      'http://localhost:3000/ideas/i',
      'http://localhost:3000/ideas/i',
    ]);
    expect(
      fetched.mock.calls.map(
        (call) => (call[1] as { method: string }).method,
      ),
    ).toEqual(['GET', 'POST', 'POST', 'PATCH', 'PATCH', 'DELETE']);
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
