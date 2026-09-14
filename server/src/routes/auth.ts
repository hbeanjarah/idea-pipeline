import { Router } from 'express';

import * as authController from '#controllers/auth';
import { requireSession } from '#middleware/auth';

export const authRouter = Router();

// The one route without requireSession: it is what creates the session.
authRouter.post('/google', authController.signInWithGoogle);

authRouter.get('/me', requireSession, authController.me);

authRouter.delete('/session', requireSession, authController.signOut);
