import type {
  Failure,
  Reply,
  ReplyData,
  Request,
} from '../lib/protocol';
import type { IdeaRepository } from './storage';
import type { Idea, Status } from './types';

export class RepositoryError extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.reason);
    this.name = 'RepositoryError';
    this.failure = failure;
  }
}

async function ask<K extends Request['kind']>(
  request: Extract<Request, { kind: K }>,
): Promise<ReplyData[K]> {
  const reply = (await chrome.runtime.sendMessage(request)) as
    | Reply<K>
    | undefined;

  // undefined means the worker never answered: stopped mid-flight, or a
  // listener that forgot to keep the channel open.
  if (!reply) throw new RepositoryError({ reason: 'server' });
  if (!reply.ok) throw new RepositoryError(reply.failure);

  return reply.data;
}

// The panel makes no network call and never sees the token: it asks the worker,
// which holds both.
export class MessagingIdeaRepository implements IdeaRepository {
  async list(): Promise<Idea[]> {
    return ask({ kind: 'ideas/list' });
  }

  async create(text: string): Promise<Idea> {
    return ask({ kind: 'ideas/create', text });
  }

  async addVariation(ideaId: string, text: string): Promise<Idea> {
    return ask({ kind: 'ideas/addVariation', ideaId, text });
  }

  async editVariation(
    ideaId: string,
    variationId: string,
    text: string,
  ): Promise<Idea> {
    return ask({
      kind: 'ideas/editVariation',
      ideaId,
      variationId,
      text,
    });
  }

  async changeStatus(ideaId: string, status: Status): Promise<Idea> {
    return ask({ kind: 'ideas/changeStatus', ideaId, status });
  }

  async delete(ideaId: string): Promise<void> {
    await ask({ kind: 'ideas/delete', ideaId });
  }
}
