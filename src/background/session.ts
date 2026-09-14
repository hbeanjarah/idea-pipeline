const KEY = 'sessionToken';

// storage.session is in memory only, never written to disk, and not exposed to
// content scripts. The worker is stopped after ~30s idle, so the token is read
// back from here on every wake — a module variable would not survive.
export async function readToken(): Promise<string | null> {
  const stored = await chrome.storage.session.get(KEY);
  const token = stored[KEY];

  return typeof token === 'string' ? token : null;
}

export async function writeToken(token: string): Promise<void> {
  await chrome.storage.session.set({ [KEY]: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.session.remove(KEY);
}
