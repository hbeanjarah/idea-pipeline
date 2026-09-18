import type { Idea, Label, User } from '@/storage/types';

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
  | { kind: 'ideas/setLabel'; ideaId: string; labelId: string | null }
  | { kind: 'ideas/delete'; ideaId: string }
  | { kind: 'labels/list' }
  | { kind: 'labels/create'; name: string }
  | { kind: 'labels/rename'; labelId: string; name: string }
  | { kind: 'labels/delete'; labelId: string }
  | { kind: 'labels/reorder'; ids: string[] }
  | { kind: 'session/status' }
  | { kind: 'session/signIn' }
  | { kind: 'session/identity' }
  | { kind: 'session/signOut' };

export type Failure =
  | { reason: 'offline' }
  | { reason: 'unauthenticated' }
  | { reason: 'gone' }
  | { reason: 'rejected'; message: string }
  | { reason: 'server' }
  // The Google window was closed. Nothing failed and nothing is shown — but
  // without a case of its own it would read as a server error.
  | { reason: 'cancelled' };

// What each request answers. Without this table a caller casts by hand, and a
// mismatch only shows at runtime.
export interface ReplyData {
  'ideas/list': Idea[];
  'ideas/create': Idea;
  'ideas/addVariation': Idea;
  'ideas/editVariation': Idea;
  'ideas/setLabel': Idea;
  // null and not void: a value has to cross sendMessage, where undefined
  // already means the channel broke.
  'ideas/delete': null;
  'labels/list': Label[];
  'labels/create': Label;
  'labels/rename': Label;
  'labels/delete': null;
  'labels/reorder': Label[];
  'session/status': { connected: boolean };
  'session/signIn': { user: User };
  'session/identity': User;
  // revoked false means "gone from here, still alive there": the server was
  // not reachable to be told.
  'session/signOut': { revoked: boolean };
}

export type Reply<K extends Request['kind']> =
  | { ok: true; data: ReplyData[K] }
  | { ok: false; failure: Failure };
