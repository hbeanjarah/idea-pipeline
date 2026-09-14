// Stand-in for chrome.identity, for tests only. Never imported by production
// code. launchWebAuthFlow answers whatever the test decided: a redirect URL to
// return, or an error to throw.

export interface ChromeIdentityStub {
  getRedirectURL(): string;
  launchWebAuthFlow(details: {
    url: string;
  }): Promise<string | undefined>;
  // The redirect to hand back. `{state}` in it is replaced by the state the
  // request carried — the only way to play a nominal round-trip, since the
  // state is generated inside the flow and never leaves it.
  answerWith(redirect: string): void;
  rejectWith(message: string): void;
  lastUrl(): string | null;
}

const REDIRECT = 'https://abcdefghijklmnop.chromiumapp.org/';

export function createChromeIdentityStub(): ChromeIdentityStub {
  let answer: { redirect: string } | { error: string } = {
    error: 'not configured',
  };
  let seen: string | null = null;

  return {
    getRedirectURL: () => REDIRECT,

    async launchWebAuthFlow(details) {
      seen = details.url;
      if ('error' in answer) throw new Error(answer.error);

      const state =
        new URL(details.url).searchParams.get('state') ?? '';
      return answer.redirect.replace('{state}', state);
    },

    answerWith(redirect) {
      answer = { redirect };
    },

    rejectWith(message) {
      answer = { error: message };
    },

    lastUrl: () => seen,
  };
}
