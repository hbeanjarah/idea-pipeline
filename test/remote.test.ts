import { describe, expect, it } from 'vitest';

import {
  MessagingIdeaRepository,
  RepositoryError,
} from '@/storage/remote';

const runtime = () =>
  globalThis.chrome.runtime as unknown as {
    reply(answer: unknown): void;
    sent: unknown[];
  };

const repository = new MessagingIdeaRepository();

describe('the messaging repository', () => {
  it('hands back what the worker answered', async () => {
    runtime().reply({ ok: true, data: [] });

    expect(await repository.list()).toEqual([]);
  });

  it('asks for exactly one operation', async () => {
    runtime().reply({ ok: true, data: [] });

    await repository.create('une idée');

    expect(runtime().sent).toEqual([
      { kind: 'ideas/create', text: 'une idée' },
    ]);
  });

  it('names every operation the way the worker expects', async () => {
    runtime().reply({ ok: true, data: null });

    await repository.list();
    await repository.addVariation('i', 'x');
    await repository.editVariation('i', 'v', 'x');
    await repository.changeStatus('i', 'ready');
    await repository.delete('i');

    // A typo in a kind would be answered by the worker default branch, not by
    // an error: the two sides have to agree on the exact strings.
    expect(runtime().sent).toEqual([
      { kind: 'ideas/list' },
      { kind: 'ideas/addVariation', ideaId: 'i', text: 'x' },
      {
        kind: 'ideas/editVariation',
        ideaId: 'i',
        variationId: 'v',
        text: 'x',
      },
      { kind: 'ideas/changeStatus', ideaId: 'i', status: 'ready' },
      { kind: 'ideas/delete', ideaId: 'i' },
    ]);
  });

  it('turns a refusal into a throw carrying its reason', async () => {
    runtime().reply({ ok: false, failure: { reason: 'offline' } });

    await expect(repository.list()).rejects.toMatchObject({
      failure: { reason: 'offline' },
    });
  });

  it('treats silence as a failure, never as an empty success', async () => {
    // A dead worker, or a listener that forgot `return true`, answers
    // undefined. Letting that through would hand the screens an empty list and
    // look exactly like success.
    runtime().reply(undefined);

    await expect(repository.list()).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});
