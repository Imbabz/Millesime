/**
 * Runtime configuration.
 *
 * The three third-party values the game needs are read from build-time env
 * vars, but can be overridden from the in-app Configuration screen and kept in
 * `localStorage`. That override matters more than it sounds: the whole point of
 * this project is that it can be operated from a phone, and re-running a CI
 * deploy just to rotate a Spotify client id is not something anyone wants to do
 * from an iPhone.
 *
 * None of these are secrets. The Supabase `anon` key is designed to be public,
 * and the Spotify client id is public by construction — the PKCE flow exists
 * precisely so that no client secret is ever shipped.
 */

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  spotifyClientId: string;
};

const STORAGE_KEY = 'millesime.config';

const BUILD_DEFAULTS: AppConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '',
};

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...BUILD_DEFAULTS };
    const stored = JSON.parse(raw) as Partial<AppConfig>;
    return {
      supabaseUrl: stored.supabaseUrl || BUILD_DEFAULTS.supabaseUrl,
      supabaseAnonKey: stored.supabaseAnonKey || BUILD_DEFAULTS.supabaseAnonKey,
      spotifyClientId: stored.spotifyClientId || BUILD_DEFAULTS.spotifyClientId,
    };
  } catch {
    return { ...BUILD_DEFAULTS };
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export const hasRealtime = (c: AppConfig): boolean =>
  Boolean(c.supabaseUrl && c.supabaseAnonKey);

export const hasSpotify = (c: AppConfig): boolean => Boolean(c.spotifyClientId);

/**
 * The origin + path the app is served from, which doubles as the Spotify
 * redirect URI and as the base of the QR join link. Derived rather than
 * configured so it stays correct on GitHub Pages, on localhost and on any
 * future host.
 */
export function appUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`;
}
