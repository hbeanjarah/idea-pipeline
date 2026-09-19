import type {
  Failure,
  Reply,
  ReplyData,
  Request,
} from '@/lib/protocol';
import type { Idea, Label } from './types';

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
export interface IdeaRepository {
  list(): Promise<Idea[]>;
  create(text: string): Promise<Idea>; // creates the idea + its first variation
  addVariation(ideaId: string, text: string): Promise<Idea>;
  editVariation(
    ideaId: string,
    variationId: string,
    text: string,
  ): Promise<Idea>; // fixes a variation's text in place (id/createdAt frozen)
  setLabel(ideaId: string, labelId: string | null): Promise<Idea>;
  setTitle(ideaId: string, title: string | null): Promise<Idea>; // null clears it
  delete(ideaId: string): Promise<void>; // permanent deletion
}

export interface LabelRepository {
  list(): Promise<Label[]>;
  create(name: string): Promise<Label>;
  rename(labelId: string, name: string): Promise<Label>;
  delete(labelId: string): Promise<void>; // the ideas it carried go free
  reorder(ids: string[]): Promise<Label[]>; // the whole ordered list
}

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

  async setLabel(
    ideaId: string,
    labelId: string | null,
  ): Promise<Idea> {
    return ask({ kind: 'ideas/setLabel', ideaId, labelId });
  }

  async setTitle(
    ideaId: string,
    title: string | null,
  ): Promise<Idea> {
    return ask({ kind: 'ideas/setTitle', ideaId, title });
  }

  async delete(ideaId: string): Promise<void> {
    await ask({ kind: 'ideas/delete', ideaId });
  }
}

export class MessagingLabelRepository implements LabelRepository {
  async list(): Promise<Label[]> {
    return ask({ kind: 'labels/list' });
  }

  async create(name: string): Promise<Label> {
    return ask({ kind: 'labels/create', name });
  }

  async rename(labelId: string, name: string): Promise<Label> {
    return ask({ kind: 'labels/rename', labelId, name });
  }

  async delete(labelId: string): Promise<void> {
    await ask({ kind: 'labels/delete', labelId });
  }

  async reorder(ids: string[]): Promise<Label[]> {
    return ask({ kind: 'labels/reorder', ids });
  }
}

export const ideaRepository: IdeaRepository =
  new MessagingIdeaRepository();

export const labelRepository: LabelRepository =
  new MessagingLabelRepository();
