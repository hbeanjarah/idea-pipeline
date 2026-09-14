import { describe, expect, it } from 'vitest';

import { challengeOf, randomToken } from '@/background/pkce';

// RFC 7636 appendix B. The published pair is what proves the encoding is the
// one Google expects, which a round-trip against our own code could not.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('the PKCE challenge', () => {
  it('matches the published RFC 7636 vector', async () => {
    expect(await challengeOf(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });
});

describe('the random token', () => {
  it('is base64url: no padding, no plus, no slash', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(randomToken(32)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('is long enough for a verifier and never repeats', () => {
    const seen = new Set<string>();

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const token = randomToken(32);
      expect(token.length).toBeGreaterThanOrEqual(43);
      seen.add(token);
    }

    expect(seen.size).toBe(200);
  });
});
