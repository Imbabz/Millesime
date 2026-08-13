import { accessToken } from './auth';

const API = 'https://api.spotify.com/v1';

export class SpotifyError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    /** True when the only fix is for the host to sign in again. */
    readonly needsAuth = false,
  ) {
    super(message);
    this.name = 'SpotifyError';
  }
}

/**
 * One place where every Spotify call goes through.
 *
 * Failure messages are written for the person holding the phone at a party, not
 * for a developer console: "aucun appareil actif" is actionable, "404 Not
 * Found" is not. The player endpoints in particular return bare 403/404s for
 * situations that are completely ordinary — no speaker awake, a free account —
 * so they are translated here rather than at each call site.
 */
export async function spotifyFetch<T>(
  clientId: string,
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const token = await accessToken(clientId);
  if (!token) throw new SpotifyError('Connecte-toi à Spotify.', 401, true);

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  // Playback commands answer 204 with an empty body; so does an empty player.
  if (response.status === 204 || response.status === 205) return null;

  if (response.ok) {
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  if (response.status === 429) {
    const retry = Number(response.headers.get('Retry-After') ?? '1');
    throw new SpotifyError(
      `Spotify limite les requêtes. Réessaie dans ${retry} s.`,
      429,
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string; reason?: string } }
    | null;
  const reason = body?.error?.reason;
  const detail = body?.error?.message ?? '';

  if (response.status === 401) {
    throw new SpotifyError('Session Spotify expirée. Reconnecte-toi.', 401, true);
  }
  if (reason === 'NO_ACTIVE_DEVICE' || response.status === 404) {
    throw new SpotifyError(
      'Aucun appareil Spotify actif. Ouvre Spotify sur ton téléphone ou allume l’enceinte, puis réessaie.',
      404,
    );
  }
  if (reason === 'PREMIUM_REQUIRED') {
    throw new SpotifyError(
      'La lecture à distance demande un compte Spotify Premium.',
      403,
    );
  }
  if (response.status === 403) {
    throw new SpotifyError(
      detail ||
        'Spotify a refusé la requête. Vérifie que ton compte est autorisé sur l’app dans le dashboard Spotify.',
      403,
    );
  }
  throw new SpotifyError(detail || `Erreur Spotify (${response.status}).`, response.status);
}

// --------------------------------------------------------------- responses

export type SpotifyDevice = {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
};

export type PlayerState = {
  is_playing: boolean;
  progress_ms: number | null;
  device: SpotifyDevice | null;
  item: { id: string; name: string; duration_ms: number } | null;
};

export type SearchResponse = {
  tracks?: {
    items: {
      id: string;
      uri: string;
      name: string;
      duration_ms: number;
      artists: { name: string }[];
      album: { name: string; release_date: string };
    }[];
  };
};

// ----------------------------------------------------------------- calls

export const listDevices = (clientId: string) =>
  spotifyFetch<{ devices: SpotifyDevice[] }>(clientId, '/me/player/devices');

export const getPlayerState = (clientId: string) =>
  spotifyFetch<PlayerState>(clientId, '/me/player');

export const startPlayback = (
  clientId: string,
  uri: string,
  positionMs: number,
  deviceId: string | null,
) =>
  spotifyFetch<null>(
    clientId,
    `/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`,
    { method: 'PUT', body: JSON.stringify({ uris: [uri], position_ms: positionMs }) },
  );

export const resumePlayback = (clientId: string, deviceId: string | null) =>
  spotifyFetch<null>(clientId, `/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
    method: 'PUT',
  });

export const pausePlayback = (clientId: string, deviceId: string | null) =>
  spotifyFetch<null>(clientId, `/me/player/pause${deviceId ? `?device_id=${deviceId}` : ''}`, {
    method: 'PUT',
  });

export const seekTo = (clientId: string, positionMs: number, deviceId: string | null) =>
  spotifyFetch<null>(
    clientId,
    `/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}${
      deviceId ? `&device_id=${deviceId}` : ''
    }`,
    { method: 'PUT' },
  );

/**
 * Development Mode caps search at 10 results, which is plenty: the query is
 * already narrowed by exact title and artist.
 */
export const searchTracks = (clientId: string, query: string) =>
  spotifyFetch<SearchResponse>(
    clientId,
    `/search?type=track&limit=10&q=${encodeURIComponent(query)}`,
  );
