import type { RequestHandler } from 'express';

import { tokenOf, userIdOf } from '#middleware/auth';
import * as authService from '#services/auth';

export const me: RequestHandler = async (req, res) => {
  res.status(200).json(await authService.currentUser(userIdOf(req)));
};

export const signOut: RequestHandler = async (req, res) => {
  await authService.signOut(tokenOf(req));
  res.status(204).end();
};

export const signInWithGoogle: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(
      await authService.signInWithGoogle(
        req.body,
        req.headers['user-agent'] ?? null,
      ),
    );
};
