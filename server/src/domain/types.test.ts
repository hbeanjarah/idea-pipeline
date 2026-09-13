import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { STATUSES } from '#domain/types';

const SERVER_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const read = (path: string) =>
  readFileSync(join(SERVER_ROOT, path), 'utf8');

describe('api.generated.ts', () => {
  // The file is gitignored and recreated by the `prepare` hook on install, so
  // what rots is the local copy: editing docs/openapi.yaml without running
  // generate:types again would otherwise go unnoticed until runtime.
  it('is up to date with docs/openapi.yaml', () => {
    const pkg = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };

    // Reuse the very flags of the generate:types script, so the two can't drift.
    const [command, ...args] =
      pkg.scripts['generate:types']!.split(' ');
    const outIndex = args.indexOf('-o');
    expect(outIndex).toBeGreaterThan(-1);

    const dir = mkdtempSync(join(tmpdir(), 'idea-pipeline-'));
    args[outIndex + 1] = join(dir, 'api.ts');

    try {
      execFileSync('pnpm', ['exec', command!, ...args], {
        cwd: SERVER_ROOT,
      });

      expect(readFileSync(join(dir, 'api.ts'), 'utf8')).toBe(
        read('src/domain/api.generated.ts'),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('the domain façade', () => {
  it('exposes the statuses as a runtime value', () => {
    expect([...STATUSES]).toEqual([
      'captured',
      'maturing',
      'ready',
      'published',
    ]);
  });
});
