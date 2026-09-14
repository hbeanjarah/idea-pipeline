// A service worker has no Buffer, so base64url goes through btoa over a binary
// string. The three substitutions are what separates base64url from base64.
const base64url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const randomToken = (bytes: number): string =>
  base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );

  return base64url(new Uint8Array(digest));
}
