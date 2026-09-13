import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';

export const app = express();

app.use(express.json());

// Business routes mount here, above the fallbacks.

const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Ressource introuvable.' });
};

// express.json() rejects malformed bodies with a SyntaxError carrying the raw body.
const isJsonParseError = (error: unknown): boolean =>
  error instanceof SyntaxError && 'body' in error;

const onError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isJsonParseError(error)) {
    res
      .status(400)
      .json({ error: 'Corps de requête JSON invalide.' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Erreur inattendue côté serveur.' });
};

app.use(notFound);
app.use(onError);
