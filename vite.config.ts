import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';
import { DEFAULT_API_URL } from './src/lib/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const apiUrl = env.VITE_API_URL || DEFAULT_API_URL;

  return {
    resolve: {
      // pathname rather than fileURLToPath: @types/node is not installed at
      // the root, and this build only ever runs on a POSIX path.
      alias: { '@': new URL('./src', import.meta.url).pathname },
    },
    // Resolved once, then handed to both consumers: the manifest that grants
    // access to the host, and the worker that calls it.
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    plugins: [react(), crx({ manifest: manifest(apiUrl) })],
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
  };
});
