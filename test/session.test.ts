import { describe, expect, it } from 'vitest';

import {
  clearToken,
  readToken,
  writeToken,
} from '../src/background/session';

describe('the session token', () => {
  it('starts absent', async () => {
    expect(await readToken()).toBeNull();
  });

  it('survives a read after being written', async () => {
    await writeToken('abc');

    expect(await readToken()).toBe('abc');
  });

  it('is read fresh every time, never cached in a module', async () => {
    await writeToken('first');
    await writeToken('second');

    // The worker dies every 30s; a module-level cache would serve a stale
    // token after Chrome restarted it.
    expect(await readToken()).toBe('second');
  });

  it('is gone after clearing', async () => {
    await writeToken('abc');

    await clearToken();

    expect(await readToken()).toBeNull();
  });

  it('never leaks into the persisted area', async () => {
    await writeToken('abc');

    // storage.local survives a browser restart and is exposed to content
    // scripts. The token must not be there.
    expect(await chrome.storage.local.get(null)).toEqual({});
  });
});
