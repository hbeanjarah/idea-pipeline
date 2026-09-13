import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';

import { SCALAR_BUNDLE_PATH, SPEC_PATH } from '#config/spec';

export const docsRouter = Router();

// Scalar fetches the document by URL, so the spec is never parsed server-side.
docsRouter.get('/openapi.yaml', (_req, res) => {
  res.type('application/yaml').sendFile(SPEC_PATH);
});

// Serving the bundle ourselves is the whole point: `cdn` below points Scalar
// here instead of jsdelivr, so the page works with no network at all.
docsRouter.get('/scalar.js', (_req, res) => {
  // pnpm stores packages under node_modules/.pnpm, and sendFile 404s on any
  // path holding a dotfile segment unless told otherwise.
  res.sendFile(SCALAR_BUNDLE_PATH, { dotfiles: 'allow' });
});

docsRouter.use(
  '/docs',
  apiReference({ url: '/openapi.yaml', cdn: '/scalar.js' }),
);
