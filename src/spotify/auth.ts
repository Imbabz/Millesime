import { appUrl } from '@/config';

/**
 * Spotify sign-in, Authorization Code + PKCE.
 *
 * PKCE is not a preference here, it is the only option: the app is a static
 * page, so there is no server to hold a client secret and nowhere to hide one.
 * Only the host ever runs this flow — guests never touch Spotify, which also
 * keeps the game inside Development Mode's five-user allowlist with four seats
 * to spare.
 *
 * The redirect URI is whatever origin the app is served from, so it matches the
 * one registered with Spotify only on the production domain. A Vercel preview
 * gets a fresh URL per commit and will be refused; the Configuration screen
 * shows the current one so that refusal is at least legible.
 */

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-private',
  // Not used by the Connect path, but requested up front so that adding the
  // in-browser player later does not force everyone to re-consent.
  'streaming',
].join(' ');

const TOKENS_KEY = 'millesime.spotify.tokens';
const VERIFIER_KEY = 'millesime.spotify.verifier';
const RETURN_KEY = 'millesime.spotify.return';

type Tokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

// --------------------------------------------------------------------- PKCE

function randomVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

// -------------------------------------------------------------- token store

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

const writeTokens = (t: Tokens) => localStorage.setItem(TOKENS_KEY, JSON.stringify(t));

export const isSignedIn = (): boolean => readTokens() !== null;

export function signOut(): void {
  localStorage.removeItem(TOKENS_KEY);
}

// ------------------------------------------------------------------- flow

/**
 * Sends the browser to Spotify. The current hash route is stashed first,
 * because Spotify redirects back to the bare redirect URI with a `?code=`
 * query and would otherwise drop whatever room the host was in.
 */
export async function beginLogin(clientId: string): Promise<void> {
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_KEY, window.location.hash || '#/');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: appUrl(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    scope: SCOPES,
  });
  window.location.assign(`${AUTH_ENDPOINT}?${params}`);
}

export type LoginResult = { ok: true } | { ok: false; error: string } | null;

/**
 * Call once at start-up. Returns `null` when this was an ordinary page load,
 * and otherwise consumes the `?code=` Spotify appended, restoring the route the
 * host left from.
 */
export async function completeLogin(clientId: string): Promise<LoginResult> {
  const query = new URLSearchParams(window.location.search);
  const code = query.get('code');
  const error = query.get('error');
  if (!code && !error) return null;

  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '#/';
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  // Clean the URL before anything can go wrong, so a failed exchange cannot be
  // retried with a code Spotify has already burned.
  window.history.replaceState({}, '', `${appUrl()}${returnTo}`);

  if (error) return { ok: false, error: describe(error) };
  if (!verifier) return { ok: false, error: 'Session de connexion perdue. Réessaie.' };

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: appUrl(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error_description?: string };
    return { ok: false, error: body.error_description ?? `Spotify a refusé (${response.status}).` };
  }

  store(await response.json());
  return { ok: true };
}

function store(payload: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): void {
  writeTokens({
    accessToken: payload.access_token,
    // A refresh response may omit the refresh token, in which case the old one
    // stays valid.
    refreshToken: payload.refresh_token ?? readTokens()?.refreshToken ?? '',
    // A minute of slack, so a request never leaves with a token about to die.
    expiresAt: Date.now() + payload.expires_in * 1000 - 60_000,
  });
}

let refreshing: Promise<string | null> | null = null;

/** A valid access token, refreshed on demand. `null` means "sign in again". */
export async function accessToken(clientId: string): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt) return tokens.accessToken;
  if (!tokens.refreshToken) {
    signOut();
    return null;
  }
  // Several callers hit this at once on wake-up; they must share one refresh.
  refreshing ??= refresh(clientId, tokens.refreshToken).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function refresh(clientId: string, refreshToken: string): Promise<string | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    signOut();
    return null;
  }
  store(await response.json());
  return readTokens()?.accessToken ?? null;
}

function describe(error: string): string {
  if (error === 'access_denied') return 'Connexion annulée.';
  return `Spotify a refusé la connexion (${error}).`;
}
