/** Domain types shared by the engine, the deck and every screen. */

export type Genre =
  | 'pop'
  | 'rock'
  | 'rap'
  | 'electro'
  | 'funk'
  | 'chanson'
  | 'rnb'
  | 'metal'
  | 'reggae'
  | 'latino'
  | 'ost';

export type Decade = 1950 | 1960 | 1970 | 1980 | 1990 | 2000 | 2010 | 2020;

/**
 * How hard the card is to *date*, which is not how famous it is. `hard` is the
 * heart of the game: a track everybody can hum but nobody can pin to a year —
 * Indeep's "Last Night a DJ Saved My Life" (1982), Alphaville's "Big in Japan".
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

export type Card = {
  id: string;
  title: string;
  artist: string;
  /** Year of *first* commercial release — never the remaster date Spotify reports. */
  year: number;
  genres: Genre[];
  difficulty: Difficulty;
  /** Offset of a recognisable hook, so playback starts on the chorus. */
  hookMs?: number;
  /** Filled in by deck resolution against the Spotify catalogue. */
  spotifyUri?: string;
};

export type PlayerId = string;

export type Player = {
  id: PlayerId;
  name: string;
  /** Index into `PLAYER_COLORS`, so every phone paints the player identically. */
  colorIndex: number;
  /** Always sorted ascending by year. */
  timeline: Card[];
  tokens: number;
  connected: boolean;
};

/** A bet placed by an opponent on a different slot of the active player's timeline. */
export type Challenge = {
  playerId: PlayerId;
  slot: number;
  /** Host-assigned receipt time; decides who "shouted" first. */
  at: number;
};

export type Turn = {
  cardId: string;
  /** The arbiter who drew this card; `null` until they do. */
  drawnBy: PlayerId | null;
  /** Slot chosen by the active player; `null` until they commit. */
  placement: number | null;
  /** The active player announced they can name the title *and* the artist. */
  claimsTitleArtist: boolean;
  challenges: Challenge[];
  /** Players who explicitly declined to challenge, so the window can close early. */
  passed: PlayerId[];
  /**
   * Epoch milliseconds at which the host will close the window, or `null` when
   * the table plays without a timer. Stamped by the host so every phone counts
   * down to the same instant instead of to its own idea of "ten seconds".
   */
  challengeEndsAt: number | null;
  /** Resolution, computed when the challenge window closes. */
  outcome: TurnOutcome | null;
};

export type TurnOutcome = {
  activeCorrect: boolean;
  /** Who ends up with the card, if anyone. */
  wonBy: PlayerId | null;
  /** The slot the card actually belonged in, for the reveal animation. */
  correctSlot: number;
  /** `null` while the table has not yet judged the title+artist announcement. */
  claimGranted: boolean | null;
  /** The card was bought with 3 tokens instead of being guessed. */
  traded: boolean;
};

export type Phase =
  | 'lobby'
  /** Waiting for the arbiter to draw the top card and start the song. */
  | 'draw'
  | 'listening'
  | 'challenge'
  | 'reveal'
  | 'karaoke'
  | 'gameover';

export type GameSettings = {
  /** Cards needed on a timeline to win. The free starting card counts. */
  targetCards: number;
  decades: Decade[];
  genres: Genre[];
  difficulties: Difficulty[];
  /** Relative weights used to interleave difficulties when building the deck. */
  difficultyMix: Record<Difficulty, number>;
  /** Start playback at the card's `hookMs` instead of at 0:00. */
  startOnHook: boolean;
  /** Seconds the "HITSTER !" window stays open. 0 disables the timer. */
  challengeSeconds: number;
  /**
   * Tokens dealt to each player at the start. At zero the steal mechanic is
   * dormant for the first turns: a token can only be earned by naming a title
   * and artist, so nobody can spend one until somebody has.
   */
  startingTokens: number;
};

export type GameState = {
  phase: Phase;
  /** Seating order; the active player is `players[activeIndex]`. */
  players: Player[];
  activeIndex: number;
  /** Remaining card ids, top of the pile first. */
  drawPile: string[];
  discard: string[];
  turn: Turn | null;
  settings: GameSettings;
  winner: PlayerId | null;
  /** Shuffle seed, kept so a game can be replayed or audited. */
  seed: number;
  /** Bumped on every accepted action, so clients can drop out-of-order snapshots. */
  version: number;
};

export const MAX_TOKENS = 5;

/**
 * Where playback starts when `startOnHook` is on and the card carries no
 * curated offset. Half a minute in, most records are past the intro and into
 * something recognisable, which keeps turns short.
 */
export const DEFAULT_HOOK_MS = 30_000;
export const TOKENS_PER_FREE_CARD = 3;

export const PLAYER_COLORS = [
  '#f5a524', // ambre
  '#3ba7f0', // azur
  '#4ec9a0', // menthe
  '#e84c3d', // corail
  '#b47cf0', // violet
  '#f06fa8', // rose
  '#8fd14f', // citron
  '#e6d24a', // or
] as const;

export const DEFAULT_SETTINGS: GameSettings = {
  targetCards: 10,
  decades: [],
  genres: [],
  difficulties: [],
  difficultyMix: { easy: 6, medium: 3, hard: 1 },
  startOnHook: true,
  challengeSeconds: 10,
  startingTokens: 1,
};

export const decadeOf = (year: number): Decade =>
  (Math.floor(year / 10) * 10) as Decade;

export const GENRE_LABELS: Record<Genre, string> = {
  pop: 'Pop',
  rock: 'Rock',
  rap: 'Rap / Hip-hop',
  electro: 'Électro / Dance',
  funk: 'Funk / Soul / Disco',
  chanson: 'Chanson française',
  rnb: 'R&B',
  metal: 'Metal',
  reggae: 'Reggae',
  latino: 'Latino',
  ost: 'Musique de film',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Grand public',
  medium: 'Intermédiaire',
  hard: 'Piège à dater',
};
