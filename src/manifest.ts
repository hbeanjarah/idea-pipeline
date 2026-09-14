import { defineManifest } from '@crxjs/vite-plugin';

// Built from the resolved API address so host_permissions can never drift from
// the address the service worker actually calls.
export default function manifest(apiUrl: string) {
  return defineManifest({
    manifest_version: 3,
    name: 'Idea Pipeline',
    version: '0.0.0',
    action: {
      default_title: 'Idea Pipeline',
    },
    side_panel: {
      default_path: 'src/sidepanel/index.html',
    },
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module',
    },
    // Fixes the extension id, which the Google redirect URL is built from. An
    // unpacked extension otherwise derives its id from the folder path, so it
    // would change on another machine and break the registered redirect.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxMjEpBrq/jwevb11Qn202LvGHpmj+3HJ/H5G90NtJ7EGbVcm+ksO2xBx+34ZLDxdUtGq/zCwoj7FkdBHVwtTPo97q5qk+CxhAtPoSSmAkK8PFL6Z3chJA1yayi6j+2IW9JO77+RPuFwupuwzDKs0PbqjgF2bvEtTy1mGTZNmOYdI65ieeKoUygo5Y4cDRryHbPwSAH+8xiolISVzHBfCCEplz60SsI9pjyyttG4KUrV7YoE1+j3n6PdNvttSaG9Cnjwx+yfGE22KPRm5o7V0VWQvnJ9tys6Wl00kjEIFXBj1cIaukd+E+deqEWk8mSvTiTNz0mwGgSy/LKglrIFvHwIDAQAB',
    permissions: ['storage', 'sidePanel', 'identity'],
    // What exempts an extension page from CORS: no header is produced server
    // side, the browser grants the access instead.
    host_permissions: [`${apiUrl}/*`],
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    commands: {
      'open-panel': {
        suggested_key: {
          default: 'Ctrl+Shift+Y',
          mac: 'Command+Shift+Y',
        },
        description: 'Ouvrir le panneau Idea Pipeline',
      },
    },
  });
}
