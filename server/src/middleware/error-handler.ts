import type { ErrorRequestHandler } from 'express';

import { ApiError } from '#config/api-error';

// express.json() rejects malformed bodies with a SyntaxError carrying the raw body.
const isJsonParseError = (error: unknown): boolean =>
  error instanceof SyntaxError && 'body' in error;

// Express 5 forwards a rejected promise here on its own, so async handlers
// need no try/catch.
export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (isJsonParseError(error)) {
    res
      .status(400)
      .json({ error: 'Corps de requête JSON invalide.' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Erreur inattendue côté serveur.' });
};
