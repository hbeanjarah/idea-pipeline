import * as api from './api';
import { ApiFailure } from './api';
import { clearToken, readToken, writeToken } from './session';
import type { Failure, Request } from '../lib/protocol';

type AnyReply =
  | { ok: true; data: unknown }
  | { ok: false; failure: Failure };

const failed = (failure: Failure): AnyReply => ({
  ok: false,
  failure,
});

async function withToken(
  run: (token: string) => Promise<unknown>,
): Promise<AnyReply> {
  const token = await readToken();
  if (token === null) return failed({ reason: 'unauthenticated' });

  try {
    return { ok: true, data: await run(token) };
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

export async function handle(request: Request): Promise<AnyReply> {
  switch (request.kind) {
    case 'session/status':
      return {
        ok: true,
        data: { connected: (await readToken()) !== null },
      };
    case 'session/set':
      await writeToken(request.token);
      return { ok: true, data: { connected: true } };
    case 'session/clear':
      await clearToken();
      return { ok: true, data: null };
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
    case 'ideas/changeStatus':
      return withToken((token) =>
        api.changeStatus(token, request.ideaId, request.status),
      );
    case 'ideas/delete':
      return withToken((token) =>
        api.deleteIdea(token, request.ideaId),
      );
  }
}
