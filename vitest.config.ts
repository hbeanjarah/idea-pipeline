import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // The front project does not extend vite.config.ts, so the alias has to
        // be repeated here or every @/ import fails to resolve under vitest.
        resolve: {
          alias: { '@': new URL('./src', import.meta.url).pathname },
        },
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
          globalSetup: ['./test/global-setup.ts'],
          setupFiles: ['./test/setup.ts'],
          // One container serves the whole project, and each test truncates it.
          // Run files one at a time, or a worker wipes the rows another one is
          // still asserting on.
          fileParallelism: false,
        },
      },
    ],
  },
});
