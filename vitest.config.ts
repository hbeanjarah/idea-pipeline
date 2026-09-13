import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'front',
          include: ['test/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        // Mirrors the condition tsc and tsx use, so #aliases resolve to src/
        // instead of a stale — or missing — dist/.
        resolve: {
          conditions: ['development'],
        },
        test: {
          name: 'server',
          root: './server',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
