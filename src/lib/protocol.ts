import type { Idea, Status } from '../storage/types';

export type Request =
  | { kind: 'ideas/list' }
  | { kind: 'ideas/create'; text: string }
  | { kind: 'ideas/addVariation'; ideaId: string; text: string }
  | {
      kind: 'ideas/editVariation';
      ideaId: string;
      variationId: string;
      text: string;
    }
  | { kind: 'ideas/changeStatus'; ideaId: string; status: Status }
  | { kind: 'ideas/delete'; ideaId: string }
  | { kind: 'session/status' }
  | { kind: 'session/set'; token: string }
  | { kind: 'session/clear' };

export type Failure =
  | { reason: 'offline' }
  | { reason: 'unauthenticated' }
  | { reason: 'gone' }
  | { reason: 'rejected'; message: string }
  | { reason: 'server' };

// What each request answers. Without this table a caller casts by hand, and a
// mismatch only shows at runtime.
export interface ReplyData {
  'ideas/list': Idea[];
  'ideas/create': Idea;
  'ideas/addVariation': Idea;
  'ideas/editVariation': Idea;
  'ideas/changeStatus': Idea;
  // null and not void: a value has to cross sendMessage, where undefined
  // already means the channel broke.
  'ideas/delete': null;
  'session/status': { connected: boolean };
  'session/set': { connected: boolean };
  'session/clear': null;
}

export type Reply<K extends Request['kind']> =
  | { ok: true; data: ReplyData[K] }
  | { ok: false; failure: Failure };
