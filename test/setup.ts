import { beforeEach } from 'vitest';
import { createChromeStorageStub } from './chromeStorageStub';
import { createChromeRuntimeStub } from './chromeRuntimeStub';
import { createChromeIdentityStub } from './chromeIdentityStub';

// Fresh stubs before every test so cases stay isolated.
beforeEach(() => {
  globalThis.chrome = {
    storage: createChromeStorageStub(),
    runtime: createChromeRuntimeStub(),
    identity: createChromeIdentityStub(),
  } as unknown as typeof chrome;
});
