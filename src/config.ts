/**
 * Runtime configuration.
 *
 * Resolved in three layers, most specific first: what this device saved in the
 * Configuration screen, then a build-time env var, then the constants below.
 *
 * The constants exist because of the guest. A guest scans a QR code and lands
 * on a phone with an empty `localStorage`; without a shipped default it has no
 * way to reach the room, and the game's central promise — nothing to install,
 * no account, no setup — dies at the first person who is not the host. Leaving
 * these blank made the app configurable and unusable at the same time.
 *
 * None of the three is a secret, and this is not a resigned "well, it leaks
 * anyway": each is public *by design*. The Supabase `anon` key is meant to be
 * shipped to browsers, and it guards nothing here — the game creates no table
 * and touches no row, it only opens a Realtime channel, so there is no data
 * behind it to protect. The Spotify client id is public by construction: PKCE
 * exists precisely so that no client secret is ever shipped, and the id is
 * useless without a redirect URI its owner registered. All three are already
 * readable in the built bundle of any deployment.
 *
 * The env vars still win when set, so these can be moved into Vercel — or
 * rotated after a fork — without touching the code.
 */

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  spotifyClientId: string;
};

const STORAGE_KEY = 'millesime.config';

/** The deployment at millesime-weld.vercel.app. See the note above. */
const SHIPPED: AppConfig = {
  supabaseUrl: 'https://zqcvfzzosmszpdkxetsc.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxY3Zmenpvc21zenBka3hldHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTUzMDAsImV4cCI6MjEwMjM3MTMwMH0.KCGVF37_z-p5vWD4vemyOUfntsiTsX-TJrhb88cfRbo',
  spotifyClientId: '6ad2f31510944827b258f524ea3e96f0',
};

const BUILD_DEFAULTS: AppConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || SHIPPED.supabaseUrl,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || SHIPPED.supabaseAnonKey,
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || SHIPPED.spotifyClientId,
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
 * configured, so it stays correct on localhost, on the production domain, and
 * on a Vercel preview — the last one being why it is worth showing on screen:
 * a preview URL is unique per commit and will never match the redirect URI
 * registered with Spotify.
 */
export function appUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`;
}

/**
 * When this bundle was built, in local time.
 *
 * An installed PWA can keep serving an old precache, so "is the fix live on my
 * phone?" has no answer from a home-screen icon. This gives one: compare it
 * with the time of the deploy. Falls back gracefully under Vitest, where Vite's
 * `define` never runs.
 */
export function buildStamp(): string {
  try {
    return new Date(__BUILD_TIME__).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return 'développement';
  }
}
