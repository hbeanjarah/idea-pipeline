import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// docs/openapi.yaml lives outside this package. src/config and dist/config sit
// at the same depth, so one relative path covers dev and build alike.
export const SPEC_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'openapi.yaml',
);

// The package's exports map stops at '.', so the browser bundle is reached
// through the filesystem rather than module resolution — nothing guarantees
// this path across upgrades, which is why a test requests it over HTTP.
// standalone.js is the self-contained build; standalone.esm.js pulls in chunks.
export const SCALAR_BUNDLE_PATH = join(
  dirname(
    fileURLToPath(import.meta.resolve('@scalar/api-reference')),
  ),
  'browser',
  'standalone.js',
);
