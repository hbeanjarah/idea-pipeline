import { z } from 'zod';

import { ApiError } from '#config/api-error';
import { exchangeCode } from '#config/google';
import type { User } from '#domain/types';
import { createSession, revokeSession } from '#store/sessions';
import { findUser, upsertUser } from '#store/users';

const GoogleBody = z.strictObject({
  code: z.string().trim().min(1),
  codeVerifier: z.string().trim().min(1),
});

export async function currentUser(userId: string): Promise<User> {
  const user = await findUser(userId);
  // The session resolved a moment ago, so the account was deleted mid-request.
  if (!user) throw new ApiError(401, 'Authentification requise.');
  return user;
}

export async function signOut(token: string): Promise<void> {
  await revokeSession(token);
}

export async function signInWithGoogle(
  body: unknown,
  userAgent: string | null,
): Promise<{ token: string; user: User }> {
  const parsed = GoogleBody.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Code d'autorisation invalide.");
  }

  const identity = await exchangeCode(
    parsed.data.code,
    parsed.data.codeVerifier,
  );
  const user = await upsertUser(identity.sub, identity.email);
  const token = await createSession(user.id, userAgent);

  return { token, user };
}
