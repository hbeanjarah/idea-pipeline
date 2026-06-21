import { describe, it, expect } from 'vitest';

describe('vitest runner', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('chrome.storage.local stub', () => {
  it('round-trips set then get', async () => {
    await chrome.storage.local.set({ ideas: ['a'] });
    expect(await chrome.storage.local.get('ideas')).toEqual({
      ideas: ['a'],
    });
  });

  it('is reset between tests', async () => {
    expect(await chrome.storage.local.get('ideas')).toEqual({});
  });
});
