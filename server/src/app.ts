import express from 'express';

import { errorHandler } from '#middleware/error-handler';
import { notFound } from '#middleware/not-found';
import { docsRouter } from '#routes/docs';
import { ideasRouter } from '#routes/ideas';

export const app = express();

app.use(express.json());

app.use(docsRouter);
app.use('/ideas', ideasRouter);

// Order matters: the fallbacks only make sense below every business route.
app.use(notFound);
app.use(errorHandler);
