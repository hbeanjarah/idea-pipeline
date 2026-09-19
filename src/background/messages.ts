import * as api from './api';
import { ApiFailure } from './api';
import * as google from './google';
import { clearToken, readToken, writeToken } from './session';
import type { Failure, Request } from '@/lib/protocol';

type AnyReply =
  | { ok: true; data: unknown }
  | { ok: false; failure: Failure };

const failed = (failure: Failure): AnyReply => ({
  ok: false,
  failure,
});

async function attempt(
  run: () => Promise<unknown>,
): Promise<AnyReply> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof ApiFailure) {
      // A dead session is worth forgetting right away: every later call would
      // fail the same way, and the panel must land on the sign-in screen.
      if (error.failure.reason === 'unauthenticated')
        await clearToken();
      return failed(error.failure);
    }
    throw error;
  }
}

async function withToken(
  run: (token: string) => Promise<unknown>,
): Promise<AnyReply> {
  const token = await readToken();
  if (token === null) return failed({ reason: 'unauthenticated' });

  return attempt(() => run(token));
}

async function revoke(token: string): Promise<boolean> {
  try {
    await api.revokeSession(token);
    return true;
  } catch (error) {
    // A 401 means the session was already dead, which is the outcome asked for.
    return (
      error instanceof ApiFailure &&
      error.failure.reason === 'unauthenticated'
    );
  }
}

export async function handle(request: Request): Promise<AnyReply> {
  switch (request.kind) {
    case 'session/status':
      return {
        ok: true,
        data: { connected: (await readToken()) !== null },
      };
    case 'session/signIn':
      return attempt(async () => {
        const { token, user } = await google.signIn();
        await writeToken(token);
        return { user };
      });
    case 'session/identity':
      return withToken((token) => api.fetchIdentity(token));
    case 'session/signOut': {
      const token = await readToken();
      // Leaving is the user's call, so the local token goes in every case —
      // including when the server never hears about it.
      const revoked = token === null ? false : await revoke(token);
      await clearToken();
      return { ok: true, data: { revoked } };
    }
    case 'ideas/list':
      return withToken((token) => api.listIdeas(token));
    case 'ideas/create':
      return withToken((token) =>
        api.createIdea(token, request.text),
      );
    case 'ideas/addVariation':
      return withToken((token) =>
        api.addVariation(token, request.ideaId, request.text),
      );
    case 'ideas/editVariation':
      return withToken((token) =>
        api.editVariation(
          token,
          request.ideaId,
          request.variationId,
          request.text,
        ),
      );
    case 'ideas/setLabel':
      return withToken((token) =>
        api.setIdeaLabel(token, request.ideaId, request.labelId),
      );
    case 'ideas/setTitle':
      return withToken((token) =>
        api.setIdeaTitle(token, request.ideaId, request.title),
      );
    case 'ideas/delete':
      return withToken((token) =>
        api.deleteIdea(token, request.ideaId),
      );
    case 'labels/list':
      return withToken((token) => api.listLabels(token));
    case 'labels/create':
      return withToken((token) =>
        api.createLabel(token, request.name),
      );
    case 'labels/rename':
      return withToken((token) =>
        api.renameLabel(token, request.labelId, request.name),
      );
    case 'labels/delete':
      return withToken((token) =>
        api.deleteLabel(token, request.labelId),
      );
    case 'labels/reorder':
      return withToken((token) =>
        api.reorderLabels(token, request.ids),
      );
  }
}
