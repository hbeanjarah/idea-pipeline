import { ApiFailure, signInWithGoogle } from './api';
import { challengeOf, randomToken } from './pkce';
import type { User } from '@/storage/types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export async function signIn(): Promise<{
  token: string;
  user: User;
}> {
  // Vite substitutes this at build time. Empty means .env was never filled —
  // worth its own failure, because Google would answer with an opaque error.
  const clientId = String(
    import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  );
  if (clientId === '') throw new ApiFailure({ reason: 'server' });

  const verifier = randomToken(32);
  const state = randomToken(16);

  const url = `${AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: chrome.identity.getRedirectURL(),
    response_type: 'code',
    scope: 'openid email',
    code_challenge: await challengeOf(verifier),
    code_challenge_method: 'S256',
    state,
    // Without it Google reuses the only signed-in account silently, which
    // makes "connect as someone else" impossible to reach.
    prompt: 'select_account',
  }).toString()}`;

  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({
      url,
      interactive: true,
    });
  } catch {
    // Chrome rejects on a closed window, and does not distinguish that from
    // anything else it refuses. Treating it as a cancellation is the safe
    // reading: the sign-in screen stays put and retrying costs one click.
    throw new ApiFailure({ reason: 'cancelled' });
  }

  if (redirect === undefined) {
    throw new ApiFailure({ reason: 'cancelled' });
  }

  const params = new URL(redirect).searchParams;
  if (params.get('error') !== null) {
    throw new ApiFailure({ reason: 'cancelled' });
  }

  const code = params.get('code');
  // A mismatched state is not the user's doing, and not something to retry
  // into: something answered that we did not ask.
  if (code === null || params.get('state') !== state) {
    throw new ApiFailure({ reason: 'server' });
  }

  return signInWithGoogle(code, verifier);
}
