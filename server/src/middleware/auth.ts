import type { Request, RequestHandler } from 'express';

import { ApiError } from '#config/api-error';
import { resolveSession } from '#store/sessions';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const unauthenticated = () =>
  new ApiError(401, 'Authentification requise.');

const bearer = (header: string | undefined): string | null => {
  if (header === undefined) return null;

  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
};

export const requireSession: RequestHandler = async (
  req,
  _res,
  next,
) => {
  const token = bearer(req.headers.authorization);
  if (token === null) throw unauthenticated();

  const userId = await resolveSession(token);
  if (userId === null) throw unauthenticated();

  req.userId = userId;
  next();
};

// The type says optional because Express cannot know the middleware ran. A route
// mounted without it therefore fails closed, with a 401, instead of handing the
// store an undefined owner.
export function userIdOf(req: Request): string {
  const { userId } = req;
  if (userId === undefined) throw unauthenticated();
  return userId;
}

export function tokenOf(req: Request): string {
  const token = bearer(req.headers.authorization);
  if (token === null) throw unauthenticated();
  return token;
}
