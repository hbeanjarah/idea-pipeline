import { ApiError } from '#config/api-error';
import { googleConfig } from '#config/env';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface GoogleIdentity {
  sub: string;
  email: string;
}

const rejected = () =>
  new ApiError(400, "Code d'autorisation invalide.");
const unreachable = () =>
  new ApiError(502, "Service d'authentification indisponible.");

// Google's own documentation: an ID token the server fetched itself over HTTPS,
// authenticated by its client secret, needs no signature check. Validation is
// only required when the token travelled through another component.
const readIdentity = (idToken: string): GoogleIdentity => {
  const payload = idToken.split('.')[1];
  if (payload === undefined) throw rejected();

  const claims = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { sub?: string; email?: string };

  if (!claims.sub || !claims.email) throw rejected();

  return { sub: claims.sub, email: claims.email };
};

export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleIdentity> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
  } catch {
    // Network failure: ours or Google's, but never the client's fault.
    throw unreachable();
  }

  if (response.status >= 500) throw unreachable();
  if (!response.ok) throw rejected();

  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw rejected();

  return readIdentity(body.id_token);
}
