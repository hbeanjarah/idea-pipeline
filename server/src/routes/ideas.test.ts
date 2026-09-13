import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SPEC_PATH } from '#config/spec';
import { ideasRouter } from '#routes/ideas';

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
]);

// Where ideasRouter is mounted in app.ts — its own paths don't carry it.
const MOUNT = '/ideas';

// No YAML parser is a declared dependency, and the paths section has a fixed
// shape: a path template indented by two spaces, its methods by four. Parsing
// those two lines is cheaper and clearer than pulling a parser in for it.
function declaredOperations(): string[] {
  const lines = readFileSync(SPEC_PATH, 'utf8').split('\n');
  const operations: string[] = [];
  let path = '';

  for (const line of lines.slice(lines.indexOf('paths:') + 1)) {
    if (line.trim() === '') continue;
    // Back to column zero means the paths section is over.
    if (!line.startsWith('  ')) break;

    const declared = /^ {2}(\/\S*):$/.exec(line);
    if (declared) {
      path = declared[1]!;
      continue;
    }

    const method = /^ {4}([a-z]+):$/.exec(line)?.[1];
    if (method && HTTP_METHODS.has(method)) {
      operations.push(`${method.toUpperCase()} ${path}`);
    }
  }

  return operations.sort();
}

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

// Reaching into router internals is the only way to ask Express what it mounted.
// The docs routes are deliberately absent: they serve the contract, they are
// not part of it.
function mountedOperations(): string[] {
  const { stack } = ideasRouter as unknown as { stack: RouteLayer[] };

  return stack
    .flatMap(({ route }) => {
      if (!route) return [];

      const suffix = route.path === '/' ? '' : route.path;
      // Express spells parameters /:id, OpenAPI spells them /{id}.
      const path = `${MOUNT}${suffix}`.replace(/:(\w+)/g, '{$1}');

      return Object.entries(route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => `${method.toUpperCase()} ${path}`);
    })
    .sort();
}

describe('the ideas routes and docs/openapi.yaml', () => {
  // Both sides are read through fragile means — a hand-rolled parser and an
  // Express internal. If either silently returned nothing, the comparison
  // below would pass while checking nothing at all.
  it('are both actually read', () => {
    expect(declaredOperations().length).toBeGreaterThan(0);
    expect(mountedOperations().length).toBeGreaterThan(0);
  });

  it('declare exactly the same operations', () => {
    expect(mountedOperations()).toEqual(declaredOperations());
  });
});
