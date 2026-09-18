import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { app } from '#app';
import type { Idea } from '#domain/types';
import { db } from '#store/db';
import { createUserWithSession } from '#test/factories';

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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

const capture = async (
  token: string,
  text: string,
): Promise<Idea> => {
  const res = await as(token, '/ideas', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return (await res.json()) as Idea;
};

const NOT_FOUND = { error: 'Idée introuvable.' };

describe('two accounts', () => {
  it('never see the ideas of the other', async () => {
    const alice = await createUserWithSession('alice@example.test');
    const bob = await createUserWithSession('bob@example.test');

    await capture(alice.token, 'idée de alice');

    expect(await (await as(bob.token, '/ideas')).json()).toEqual([]);
    expect(
      ((await (await as(alice.token, '/ideas')).json()) as Idea[])
        .length,
    ).toBe(1);
  });

  it('get 404 and never 403 on the ideas of the other', async () => {
    const alice = await createUserWithSession('alice@example.test');
    const bob = await createUserWithSession('bob@example.test');

    const idea = await capture(alice.token, 'idée de alice');
    const variationId = idea.variations[0]!.id;

    // A 403 would confirm the idea exists and make identifiers enumerable.
    for (const [method, path, body] of [
      ['DELETE', `/ideas/${idea.id}`, undefined],
      [
        'PATCH',
        `/ideas/${idea.id}`,
        JSON.stringify({ labelId: null }),
      ],
      [
        'POST',
        `/ideas/${idea.id}/variations`,
        JSON.stringify({ text: 'x' }),
      ],
      [
        'PATCH',
        `/ideas/${idea.id}/variations/${variationId}`,
        JSON.stringify({ text: 'x' }),
      ],
    ] as const) {
      const res = await as(bob.token, path, { method, body });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual(NOT_FOUND);
    }

    // And none of it touched the idea.
    const still = (await (
      await as(alice.token, '/ideas')
    ).json()) as Idea[];
    expect(still).toHaveLength(1);
    expect(still[0]?.variations).toHaveLength(1);
    expect(still[0]?.variations[0]?.text).toBe('idée de alice');
    expect(still[0]?.labelId).toBeNull();
  });

  it('keep their ideas when the other account is deleted', async () => {
    const alice = await createUserWithSession('alice@example.test');
    const bob = await createUserWithSession('bob@example.test');

    await capture(bob.token, 'idée de bob');
    await capture(alice.token, 'idée de alice');

    await db()
      .deleteFrom('users')
      .where('id', '=', alice.userId)
      .execute();

    const left = (await (
      await as(bob.token, '/ideas')
    ).json()) as Idea[];
    expect(left).toHaveLength(1);
    expect(left[0]?.variations[0]?.text).toBe('idée de bob');
  });
});
