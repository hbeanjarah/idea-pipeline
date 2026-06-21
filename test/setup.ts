import { beforeEach } from 'vitest';
import { createChromeStorageStub } from './chromeStorageStub';

// Install a fresh chrome.storage stub before every test so cases stay isolated.
beforeEach(() => {
  globalThis.chrome = { storage: createChromeStorageStub() } as unknown as typeof chrome;
});
