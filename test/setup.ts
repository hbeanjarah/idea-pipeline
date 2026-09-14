import { beforeEach } from 'vitest';
import { createChromeStorageStub } from './chromeStorageStub';
import { createChromeRuntimeStub } from './chromeRuntimeStub';

// Fresh stubs before every test so cases stay isolated.
beforeEach(() => {
  globalThis.chrome = {
    storage: createChromeStorageStub(),
    runtime: createChromeRuntimeStub(),
  } as unknown as typeof chrome;
});
