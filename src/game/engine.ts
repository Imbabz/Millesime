import {
  DEFAULT_SETTINGS,
  MAX_TOKENS,
  TOKENS_PER_FREE_CARD,
  PLAYER_COLORS,
  type Card,
  type GameSettings,
  type GameState,
  type Player,
  type PlayerId,
  type TurnOutcome,
} from './types';
import { buildDrawPile, filterDeck } from './deckFilter';
import { mulberry32 } from './rng';

/**
 * The rules of Millésime, as a pure reducer.
 *
 * Nothing here touches React, the network or Spotify, which is what makes the
 * whole game testable and what lets the host arbitrate a contested turn without
 * any device disagreeing about the outcome. Invalid actions — a guest tapping a
 * button the host has already moved past, a duplicate message, an outright
 * forged intent — return the state untouched rather than throwing, because they
 * arrive over an unreliable channel by design.
 */

export type EngineContext = {
  /** The full catalogue, keyed by card id. */
  cards: ReadonlyMap<string, Card>;
};

export type Action =
  | { type: 'ADD_PLAYER'; playerId: PlayerId; name: string }
  | { type: 'REMOVE_PLAYER'; playerId: PlayerId }
  | { type: 'SET_CONNECTED'; playerId: PlayerId; connected: boolean }
  | { type: 'SET_SETTINGS'; settings: Partial<GameSettings> }
  | {
      type: 'START_GAME';
      seed: number;
      /** Cards this table already heard in earlier games; dealt last. */
      stale?: readonly string[];
    }
  | { type: 'DRAW_CARD'; playerId: PlayerId }
  | { type: 'SET_CLAIM'; playerId: PlayerId; value: boolean }
  | { type: 'COMMIT_PLACEMENT'; playerId: PlayerId; slot: number; at: number }
  | { type: 'TRADE_TOKENS'; playerId: PlayerId }
  | { type: 'GRANT_TOKEN'; playerId: PlayerId; byId: PlayerId }
  | { type: 'CHALLENGE'; playerId: PlayerId; slot: number; at: number }
  | { type: 'PASS_CHALLENGE'; playerId: PlayerId }
  | { type: 'CLOSE_CHALLENGES' }
  | { type: 'RESOLVE_CLAIM'; playerId: PlayerId; granted: boolean }
  | { type: 'OPEN_KARAOKE' }
  | { type: 'CLOSE_KARAOKE' }
  | { type: 'NEXT_TURN' }
  | { type: 'RESET_TO_LOBBY' };

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = PLAYER_COLORS.length;

export function initialState(): GameState {
  return {
    phase: 'lobby',
    players: [],
    activeIndex: 0,
    drawPile: [],
    discard: [],
    turn: null,
    settings: { ...DEFAULT_SETTINGS },
    winner: null,
    seed: 0,
    version: 0,
  };
}

// ---------------------------------------------------------------------------
// Timeline helpers — the actual "is this the right place?" logic
// ---------------------------------------------------------------------------

/**
 * A slot is the gap *before* index `slot`, so a timeline of n cards has n+1
 * slots. Exactly one of them is correct — ties included.
 *
 * When the card shares its year with one already on the table, a *poteau*, it
 * belongs immediately to the right of it and nowhere else. The physical game
 * accepts either side, but either side means a tie hands the player two winning
 * gaps instead of one: the card that is hardest to date becomes the easiest to
 * place, which is backwards. Here equal years stack in the order they arrived
 * and the newcomer goes last, so a poteau is read like any other card — and
 * getting it right means actually knowing it is the same year, not merely
 * landing nearby.
 */
export function isCorrectSlot(
  timeline: readonly Card[],
  year: number,
  slot: number,
): boolean {
  if (slot < 0 || slot > timeline.length) return false;
  const before = timeline[slot - 1];
  const after = timeline[slot];
  if (before && before.year > year) return false;
  // `<=` rather than `<` is the whole poteau rule: a card of the same year to
  // the right of this gap means the card belongs one slot further on.
  if (after && after.year <= year) return false;
  return true;
}

/**
 * Where the card belongs — now the *only* slot `isCorrectSlot` accepts, since
 * ties resolve to the right. Used to animate the reveal and to insert a card
 * bought with tokens.
 */
export function correctSlotFor(timeline: readonly Card[], year: number): number {
  let slot = 0;
  while (slot < timeline.length && (timeline[slot] as Card).year <= year) slot++;
  return slot;
}

function insertSorted(timeline: readonly Card[], card: Card): Card[] {
  const next = timeline.slice();
  next.splice(correctSlotFor(timeline, card.year), 0, card);
  return next;
}

// ---------------------------------------------------------------------------
// Small accessors
// ---------------------------------------------------------------------------

export const activePlayer = (state: GameState): Player | undefined =>
  state.players[state.activeIndex];

export const playerById = (state: GameState, id: PlayerId): Player | undefined =>
  state.players.find((p) => p.id === id);

export const currentCard = (state: GameState, ctx: EngineContext): Card | undefined =>
  state.turn ? ctx.cards.get(state.turn.cardId) : undefined;

/**
 * The arbiter of this turn: the player to the active player's left.
 *
 * Derived from `activeIndex` rather than stored, so the role rotates on its own
 * and there is nothing extra to keep in sync. The arbiter draws the card and
 * runs the music — which is what keeps the active player away from anything
 * that could give the answer away — and rules on the spoken title-and-artist
 * announcement once the card is face up.
 *
 * They do *not* see the answer any earlier than anyone else: like the player
 * who scans a face-down card in the physical game, they handle it without
 * turning it over. So they keep playing normally, steal included.
 *
 * Undefined in a solo game, where there is nobody to hand the role to.
 */
export const arbiter = (state: GameState): Player | undefined =>
  state.players.length < 2
    ? undefined
    : state.players[(state.activeIndex + 1) % state.players.length];

/** Solo play has no arbiter, so the active player draws for themselves. */
export const canDraw = (state: GameState, playerId: PlayerId): boolean =>
  (arbiter(state) ?? activePlayer(state))?.id === playerId;

/** Same fallback for ruling on the announcement. */
export const canJudge = (state: GameState, playerId: PlayerId): boolean =>
  (arbiter(state) ?? activePlayer(state))?.id === playerId;

/** Opponents who still hold a token, and so could still shout "HITSTER !". */
export const eligibleChallengers = (state: GameState): Player[] =>
  state.players.filter((p, i) => i !== state.activeIndex && p.tokens > 0);

const clampTokens = (n: number): number =>
  Math.max(0, Math.min(MAX_TOKENS, Math.floor(n)));

const mapPlayer = (
  state: GameState,
  id: PlayerId,
  fn: (p: Player) => Player,
): Player[] => state.players.map((p) => (p.id === id ? fn(p) : p));

const bump = (state: GameState, patch: Partial<GameState>): GameState => ({
  ...state,
  ...patch,
  version: state.version + 1,
});

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: GameState, action: Action, ctx: EngineContext): GameState {
  switch (action.type) {
    case 'ADD_PLAYER': {
      if (state.phase !== 'lobby') return state;
      if (state.players.length >= MAX_PLAYERS) return state;
      // Reconnecting under the same id must not create a duplicate seat.
      const existing = playerById(state, action.playerId);
      if (existing) {
        return bump(state, {
          players: mapPlayer(state, action.playerId, (p) => ({
            ...p,
            name: action.name.trim() || p.name,
            connected: true,
          })),
        });
      }
      const name = action.name.trim();
      if (!name) return state;
      const used = new Set(state.players.map((p) => p.colorIndex));
      const free = PLAYER_COLORS.findIndex((_, i) => !used.has(i));
      const colorIndex = free === -1 ? state.players.length % PLAYER_COLORS.length : free;
      const player: Player = {
        id: action.playerId,
        name,
        colorIndex,
        timeline: [],
        tokens: 0,
        connected: true,
      };
      return bump(state, { players: [...state.players, player] });
    }

    case 'REMOVE_PLAYER': {
      if (state.phase !== 'lobby') return state;
      return bump(state, {
        players: state.players.filter((p) => p.id !== action.playerId),
      });
    }

    case 'SET_CONNECTED': {
      if (!playerById(state, action.playerId)) return state;
      return bump(state, {
        players: mapPlayer(state, action.playerId, (p) => ({
          ...p,
          connected: action.connected,
        })),
      });
    }

    case 'SET_SETTINGS': {
      if (state.phase !== 'lobby') return state;
      return bump(state, { settings: { ...state.settings, ...action.settings } });
    }

    case 'START_GAME': {
      if (state.phase !== 'lobby') return state;
      if (state.players.length < MIN_PLAYERS) return state;

      const pool = filterDeck([...ctx.cards.values()], state.settings);
      // One starting card each, plus the first card in play.
      if (pool.length < state.players.length + 1) return state;

      const rng = mulberry32(action.seed);
      const pile = buildDrawPile(
        pool,
        state.settings.difficultyMix,
        rng,
        new Set(action.stale ?? []),
      );

      const opening = clampTokens(state.settings.startingTokens);
      const players = state.players.map((p) => {
        const card = ctx.cards.get(pile.shift() as string) as Card;
        return { ...p, timeline: [card], tokens: opening };
      });

      return bump(state, {
        phase: 'draw',
        players,
        activeIndex: 0,
        drawPile: pile.slice(1),
        discard: [],
        seed: action.seed,
        winner: null,
        turn: {
          cardId: pile[0] as string,
          drawnBy: null,
          placement: null,
          claimsTitleArtist: false,
          challenges: [],
          passed: [],
          challengeEndsAt: null,
          outcome: null,
        },
      });
    }

    case 'DRAW_CARD': {
      if (state.phase !== 'draw' || !state.turn) return state;
      if (!canDraw(state, action.playerId)) return state;
      return bump(state, {
        phase: 'listening',
        turn: { ...state.turn, drawnBy: action.playerId },
      });
    }

    case 'SET_CLAIM': {
      if (state.phase !== 'listening' || !state.turn) return state;
      if (activePlayer(state)?.id !== action.playerId) return state;
      return bump(state, {
        turn: { ...state.turn, claimsTitleArtist: action.value },
      });
    }

    case 'COMMIT_PLACEMENT': {
      if (state.phase !== 'listening' || !state.turn) return state;
      const active = activePlayer(state);
      if (!active || active.id !== action.playerId) return state;
      if (action.slot < 0 || action.slot > active.timeline.length) return state;

      const seconds = state.settings.challengeSeconds;
      const committed = bump(state, {
        phase: 'challenge',
        turn: {
          ...state.turn,
          placement: action.slot,
          challengeEndsAt: seconds > 0 ? action.at + seconds * 1000 : null,
        },
      });
      // With nobody able to bet, the challenge window would only be dead air.
      return eligibleChallengers(committed).length === 0
        ? reduce(committed, { type: 'CLOSE_CHALLENGES' }, ctx)
        : committed;
    }

    /**
     * The arbiter hands somebody a token by hand.
     *
     * The app scores the game, but a table still overrules it: a near-miss the
     * group decides to reward, a house rule, a forfeit, an announcement judged
     * generously after the fact. Without this the only recourse is to argue
     * with a phone, so the arbiter — who already rules on the announcement —
     * can simply add one, capped like every other route to a token.
     */
    case 'GRANT_TOKEN': {
      if (state.phase === 'lobby' || state.phase === 'gameover') return state;
      if (!canJudge(state, action.byId)) return state;
      const target = state.players.find((p) => p.id === action.playerId);
      if (!target || target.tokens >= MAX_TOKENS) return state;
      return bump(state, {
        players: mapPlayer(state, target.id, (p) => ({
          ...p,
          tokens: clampTokens(p.tokens + 1),
        })),
      });
    }

    case 'TRADE_TOKENS': {
      if (state.phase !== 'listening' || !state.turn) return state;
      const active = activePlayer(state);
      if (!active || active.id !== action.playerId) return state;
      if (active.tokens < TOKENS_PER_FREE_CARD) return state;

      const card = ctx.cards.get(state.turn.cardId);
      if (!card) return state;

      const correctSlot = correctSlotFor(active.timeline, card.year);
      const players = mapPlayer(state, active.id, (p) => ({
        ...p,
        tokens: p.tokens - TOKENS_PER_FREE_CARD,
        timeline: insertSorted(p.timeline, card),
      }));
      const outcome: TurnOutcome = {
        activeCorrect: true,
        wonBy: active.id,
        correctSlot,
        claimGranted: false,
        traded: true,
      };
      return bump(state, {
        phase: 'reveal',
        players,
        turn: { ...state.turn, placement: correctSlot, outcome },
        winner: findWinner(players, state.settings.targetCards),
      });
    }

    case 'CHALLENGE': {
      if (state.phase !== 'challenge' || !state.turn) return state;
      const active = activePlayer(state);
      const challenger = playerById(state, action.playerId);
      if (!active || !challenger || challenger.id === active.id) return state;
      if (challenger.tokens < 1) return state;
      if (state.turn.challenges.some((c) => c.playerId === challenger.id)) return state;
      if (action.slot < 0 || action.slot > active.timeline.length) return state;
      // The rulebook is explicit: you must bet on a *different* gap, and no two
      // challengers may occupy the same one.
      if (action.slot === state.turn.placement) return state;
      if (state.turn.challenges.some((c) => c.slot === action.slot)) return state;

      const players = mapPlayer(state, challenger.id, (p) => ({
        ...p,
        tokens: p.tokens - 1,
      }));
      const turn = {
        ...state.turn,
        challenges: [
          ...state.turn.challenges,
          { playerId: challenger.id, slot: action.slot, at: action.at },
        ],
        passed: state.turn.passed.filter((id) => id !== challenger.id),
      };
      const next = bump(state, { players, turn });
      return everyoneAnswered(next) ? reduce(next, { type: 'CLOSE_CHALLENGES' }, ctx) : next;
    }

    case 'PASS_CHALLENGE': {
      if (state.phase !== 'challenge' || !state.turn) return state;
      if (action.playerId === activePlayer(state)?.id) return state;
      if (state.turn.passed.includes(action.playerId)) return state;
      if (!playerById(state, action.playerId)) return state;

      const next = bump(state, {
        turn: { ...state.turn, passed: [...state.turn.passed, action.playerId] },
      });
      return everyoneAnswered(next) ? reduce(next, { type: 'CLOSE_CHALLENGES' }, ctx) : next;
    }

    case 'CLOSE_CHALLENGES': {
      if (state.phase !== 'challenge' || !state.turn) return state;
      return resolveTurn(state, ctx);
    }

    case 'RESOLVE_CLAIM': {
      if (state.phase !== 'reveal' && state.phase !== 'karaoke') return state;
      // The ruling belongs to the arbiter of this turn, and to nobody else.
      if (!canJudge(state, action.playerId)) return state;
      const turn = state.turn;
      if (!turn?.outcome || !turn.claimsTitleArtist) return state;
      if (turn.outcome.claimGranted !== null) return state;

      const active = activePlayer(state);
      if (!active) return state;
      const players = action.granted
        ? mapPlayer(state, active.id, (p) => ({
            ...p,
            tokens: Math.min(p.tokens + 1, MAX_TOKENS),
          }))
        : state.players;

      return bump(state, {
        players,
        turn: { ...turn, outcome: { ...turn.outcome, claimGranted: action.granted } },
      });
    }

    case 'OPEN_KARAOKE':
      return state.phase === 'reveal' ? bump(state, { phase: 'karaoke' }) : state;

    case 'CLOSE_KARAOKE':
      return state.phase === 'karaoke' ? bump(state, { phase: 'reveal' }) : state;

    case 'NEXT_TURN': {
      if (state.phase !== 'reveal' && state.phase !== 'karaoke') return state;
      if (state.winner) return bump(state, { phase: 'gameover' });
      if (state.drawPile.length === 0) {
        return bump(state, {
          phase: 'gameover',
          winner: leaderOf(state.players),
          turn: null,
        });
      }
      const [next, ...rest] = state.drawPile;
      return bump(state, {
        phase: 'draw',
        activeIndex: (state.activeIndex + 1) % state.players.length,
        drawPile: rest,
        turn: {
          cardId: next as string,
          drawnBy: null,
          placement: null,
          claimsTitleArtist: false,
          challenges: [],
          passed: [],
          challengeEndsAt: null,
          outcome: null,
        },
      });
    }

    case 'RESET_TO_LOBBY':
      // Keeps the table and their settings; only the game itself is thrown away.
      return {
        ...initialState(),
        players: state.players.map((p) => ({ ...p, timeline: [], tokens: 0 })),
        settings: state.settings,
        version: state.version + 1,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** True once every opponent holding a token has either bet or passed. */
function everyoneAnswered(state: GameState): boolean {
  if (!state.turn) return false;
  const answered = new Set([
    ...state.turn.challenges.map((c) => c.playerId),
    ...state.turn.passed,
  ]);
  return eligibleChallengers(state).every((p) => answered.has(p.id));
}

function resolveTurn(state: GameState, ctx: EngineContext): GameState {
  const turn = state.turn;
  const active = activePlayer(state);
  if (!turn || !active || turn.placement === null) return state;

  const card = ctx.cards.get(turn.cardId);
  if (!card) return state;

  const correctSlot = correctSlotFor(active.timeline, card.year);
  const activeCorrect = isCorrectSlot(active.timeline, card.year, turn.placement);

  let players = state.players;
  let wonBy: PlayerId | null = null;

  if (activeCorrect) {
    wonBy = active.id;
    players = mapPlayer(state, active.id, (p) => ({
      ...p,
      timeline: insertSorted(p.timeline, card),
    }));
  } else {
    // Challenges are judged against the *active* player's timeline — that is
    // what was bet on — but the card lands in the winner's own timeline.
    // Earliest tap wins, exactly like the first player to shout.
    const thief = [...turn.challenges]
      .sort((a, b) => a.at - b.at)
      .find((c) => isCorrectSlot(active.timeline, card.year, c.slot));
    if (thief) {
      wonBy = thief.playerId;
      players = mapPlayer(state, thief.playerId, (p) => ({
        ...p,
        timeline: insertSorted(p.timeline, card),
      }));
    }
  }

  const outcome: TurnOutcome = {
    activeCorrect,
    wonBy,
    correctSlot,
    // Nothing was announced, so there is nothing for the table to judge.
    claimGranted: turn.claimsTitleArtist ? null : false,
    traded: false,
  };

  return bump(state, {
    phase: 'reveal',
    players,
    discard: wonBy ? state.discard : [...state.discard, card.id],
    turn: { ...turn, outcome },
    winner: findWinner(players, state.settings.targetCards),
  });
}

function findWinner(players: readonly Player[], targetCards: number): PlayerId | null {
  return players.find((p) => p.timeline.length >= targetCards)?.id ?? null;
}

/** Fallback when the pile runs dry: most cards, tokens break the tie. */
function leaderOf(players: readonly Player[]): PlayerId | null {
  const ranked = [...players].sort(
    (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens,
  );
  const [first, second] = ranked;
  if (!first) return null;
  if (second && second.timeline.length === first.timeline.length && second.tokens === first.tokens) {
    return null;
  }
  return first.id;
}

// ---------------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------------

/**
 * Strips everything a guest must not be able to read out of the payload.
 *
 * Timelines are already face-up, but the card in play and the rest of the pile
 * are not — and a phone that could see the answer in a websocket frame would
 * quietly ruin the game. Guests get the card id only once the reveal has
 * happened.
 */
export function redactForGuests(state: GameState): GameState {
  const hideCard =
    state.phase === 'draw' ||
    state.phase === 'listening' ||
    state.phase === 'challenge';
  return {
    ...state,
    drawPile: [],
    discard: [],
    turn: state.turn && hideCard ? { ...state.turn, cardId: '' } : state.turn,
  };
}
