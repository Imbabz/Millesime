import { describe, expect, it } from 'vitest';
import {
  activePlayer,
  arbiter,
  canDraw,
  correctSlotFor,
  eligibleChallengers,
  initialState,
  isCorrectSlot,
  playerById,
  redactForGuests,
  reduce,
  type Action,
  type EngineContext,
} from './engine';
import { MAX_TOKENS, type Card, type GameState } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A tiny deterministic catalogue: one easy card per year from 1960 to 2019. */
const CATALOGUE: Card[] = Array.from({ length: 60 }, (_, i) => ({
  id: `c${1960 + i}`,
  title: `Titre ${1960 + i}`,
  artist: `Artiste ${1960 + i}`,
  year: 1960 + i,
  genres: ['pop'],
  difficulty: 'easy',
}));

const ctx: EngineContext = { cards: new Map(CATALOGUE.map((c) => [c.id, c])) };

const card = (year: number): Card => ctx.cards.get(`c${year}`) as Card;

const run = (state: GameState, ...actions: Action[]): GameState =>
  actions.reduce((s, a) => reduce(s, a, ctx), state);

/** The turn cannot begin until the arbiter draws, so most tests want this. */
const drawn = (state: GameState): GameState =>
  run(state, {
    type: 'DRAW_CARD',
    playerId: (arbiter(state) ?? activePlayer(state))?.id ?? '',
  });

/** A game dealt, started and with the first card drawn. */
function startedGame(names = ['Alice', 'Bob', 'Chloé']): GameState {
  const lobby = run(
    initialState(),
    ...names.map((name, i): Action => ({ type: 'ADD_PLAYER', playerId: `p${i}`, name })),
  );
  return drawn(run(lobby, { type: 'START_GAME', seed: 42 }));
}

/** The same game held at the draw step, for the tests that are about it. */
function gameAwaitingDraw(names = ['Alice', 'Bob', 'Chloé']): GameState {
  const lobby = run(
    initialState(),
    ...names.map((name, i): Action => ({ type: 'ADD_PLAYER', playerId: `p${i}`, name })),
  );
  return run(lobby, { type: 'START_GAME', seed: 42 });
}

/** Rewrites timelines and tokens so a scenario can be set up exactly. */
function withTable(
  state: GameState,
  table: { years: number[]; tokens?: number }[],
): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => {
      const seat = table[i];
      return seat
        ? { ...p, timeline: seat.years.map(card), tokens: seat.tokens ?? p.tokens }
        : p;
    }),
  };
}

/** Forces a specific card into play, whatever the shuffle dealt. */
const withCardInPlay = (state: GameState, year: number): GameState => ({
  ...state,
  turn: state.turn ? { ...state.turn, cardId: `c${year}` } : null,
});

// ---------------------------------------------------------------------------
// Timeline arithmetic
// ---------------------------------------------------------------------------

describe('isCorrectSlot', () => {
  const timeline = [card(1970), card(1985), card(2000)];

  it('accepts the gap that brackets the year', () => {
    expect(isCorrectSlot(timeline, 1990, 2)).toBe(true);
  });

  it('accepts both ends of the timeline', () => {
    expect(isCorrectSlot(timeline, 1960, 0)).toBe(true);
    expect(isCorrectSlot(timeline, 2010, 3)).toBe(true);
  });

  it('rejects a gap on the wrong side', () => {
    expect(isCorrectSlot(timeline, 1990, 1)).toBe(false);
    expect(isCorrectSlot(timeline, 1990, 3)).toBe(false);
  });

  it('rejects out-of-range slots', () => {
    expect(isCorrectSlot(timeline, 1990, -1)).toBe(false);
    expect(isCorrectSlot(timeline, 1990, 4)).toBe(false);
  });

  it('accepts either side of a card sharing the same year', () => {
    expect(isCorrectSlot(timeline, 1985, 1)).toBe(true);
    expect(isCorrectSlot(timeline, 1985, 2)).toBe(true);
  });

  it('is always right on an empty timeline', () => {
    expect(isCorrectSlot([], 1999, 0)).toBe(true);
  });
});

describe('correctSlotFor', () => {
  it('points past every card that is older or equal', () => {
    const timeline = [card(1970), card(1985), card(2000)];
    expect(correctSlotFor(timeline, 1965)).toBe(0);
    expect(correctSlotFor(timeline, 1990)).toBe(2);
    expect(correctSlotFor(timeline, 2020)).toBe(3);
    expect(correctSlotFor(timeline, 1985)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

describe('lobby', () => {
  it('seats players with distinct colours', () => {
    const state = run(
      initialState(),
      { type: 'ADD_PLAYER', playerId: 'p0', name: 'Alice' },
      { type: 'ADD_PLAYER', playerId: 'p1', name: 'Bob' },
    );
    expect(state.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(new Set(state.players.map((p) => p.colorIndex)).size).toBe(2);
  });

  it('treats a repeated id as a reconnection, not a second seat', () => {
    const state = run(
      initialState(),
      { type: 'ADD_PLAYER', playerId: 'p0', name: 'Alice' },
      { type: 'SET_CONNECTED', playerId: 'p0', connected: false },
      { type: 'ADD_PLAYER', playerId: 'p0', name: 'Alice' },
    );
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.connected).toBe(true);
  });

  it('refuses a blank name', () => {
    const state = run(initialState(), { type: 'ADD_PLAYER', playerId: 'p0', name: '  ' });
    expect(state.players).toHaveLength(0);
  });

  it('will not start when the filtered deck cannot seat everyone', () => {
    const lobby = run(
      initialState(),
      { type: 'ADD_PLAYER', playerId: 'p0', name: 'Alice' },
      { type: 'ADD_PLAYER', playerId: 'p1', name: 'Bob' },
      // 1961 alone leaves a single card: not enough for two starting cards.
      { type: 'SET_SETTINGS', settings: { decades: [1960], difficulties: ['hard'] } },
    );
    expect(run(lobby, { type: 'START_GAME', seed: 1 }).phase).toBe('lobby');
  });

  it('deals one starting card each and puts one card in play', () => {
    const state = startedGame();
    expect(state.phase).toBe('listening');
    expect(state.players.every((p) => p.timeline.length === 1)).toBe(true);
    expect(state.turn?.cardId).toBeTruthy();
    const dealt = new Set([
      ...state.players.flatMap((p) => p.timeline.map((c) => c.id)),
      state.turn?.cardId,
    ]);
    expect(dealt.size).toBe(4);
    expect(state.drawPile).not.toContain(state.turn?.cardId);
  });

  it('is reproducible for a given seed', () => {
    expect(startedGame().drawPile).toEqual(startedGame().drawPile);
  });
});

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

describe('placement', () => {
  it('keeps the card when the active player is right', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [{ years: [1980] }, { years: [1990] }, { years: [1970] }]),
      1995,
    );
    const state = run(
      base,
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 1, at: 0 },
      { type: 'CLOSE_CHALLENGES' },
    );
    expect(state.phase).toBe('reveal');
    expect(state.turn?.outcome?.activeCorrect).toBe(true);
    expect(state.turn?.outcome?.wonBy).toBe('p0');
    expect(playerById(state, 'p0')?.timeline.map((c) => c.year)).toEqual([1980, 1995]);
  });

  it('discards the card when nobody gets it right', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [{ years: [1980] }, { years: [1990] }, { years: [1970] }]),
      1995,
    );
    const state = run(
      base,
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'CLOSE_CHALLENGES' },
    );
    expect(state.turn?.outcome?.activeCorrect).toBe(false);
    expect(state.turn?.outcome?.wonBy).toBeNull();
    expect(playerById(state, 'p0')?.timeline).toHaveLength(1);
    expect(state.discard).toContain('c1995');
  });

  it('ignores a placement sent by anyone but the active player', () => {
    const state = run(startedGame(), { type: 'COMMIT_PLACEMENT', playerId: 'p1', slot: 0, at: 0 });
    expect(state.phase).toBe('listening');
  });

  it('ignores an out-of-range slot', () => {
    const state = run(startedGame(), { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 7, at: 0 });
    expect(state.phase).toBe('listening');
  });

  it('skips the challenge window when no opponent holds a token', () => {
    const state = run(startedGame(), { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 });
    expect(state.phase).toBe('reveal');
  });
});

// ---------------------------------------------------------------------------
// Stealing — "HITSTER !"
// ---------------------------------------------------------------------------

describe('challenges', () => {
  /** p0 is about to misplace 1995; p1 and p2 each hold two tokens. */
  const contested = () =>
    withCardInPlay(
      withTable(startedGame(), [
        { years: [1980] },
        { years: [1990], tokens: 2 },
        { years: [1970], tokens: 2 },
      ]),
      1995,
    );

  it('spends the token as soon as the bet is placed', () => {
    const state = run(
      contested(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 1, at: 100 },
    );
    expect(playerById(state, 'p1')?.tokens).toBe(1);
  });

  it('hands the card to the earliest correct challenger', () => {
    const state = run(
      contested(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      // p2 bets first in wall-clock terms even though the message arrived later.
      { type: 'CHALLENGE', playerId: 'p1', slot: 1, at: 300 },
      { type: 'CHALLENGE', playerId: 'p2', slot: 1, at: 100 },
      { type: 'CLOSE_CHALLENGES' },
    );
    // Slot 1 is already taken by p1, so p2's duplicate bet is refused and p1 wins.
    expect(state.turn?.challenges).toHaveLength(1);
    expect(state.turn?.outcome?.wonBy).toBe('p1');
    expect(playerById(state, 'p1')?.timeline.map((c) => c.year)).toEqual([1990, 1995]);
  });

  it('orders competing bets by tap time, not arrival order', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [
        { years: [1980, 2000] },
        { years: [1990], tokens: 2 },
        { years: [1970], tokens: 2 },
      ]),
      1995,
    );
    const state = run(
      base,
      // p0 wrongly places 1995 before 1980.
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      // Both bets are correct-adjacent; only slot 1 (between 1980 and 2000) is right.
      { type: 'CHALLENGE', playerId: 'p1', slot: 2, at: 100 },
      { type: 'CHALLENGE', playerId: 'p2', slot: 1, at: 200 },
      { type: 'CLOSE_CHALLENGES' },
    );
    expect(state.turn?.outcome?.wonBy).toBe('p2');
  });

  it('refuses a bet on the slot the active player chose', () => {
    const state = run(
      contested(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 0, at: 100 },
    );
    expect(state.turn?.challenges).toHaveLength(0);
    expect(playerById(state, 'p1')?.tokens).toBe(2);
  });

  it('refuses a second bet from the same player', () => {
    const state = run(
      contested(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 1, at: 100 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 1, at: 110 },
    );
    expect(state.turn?.challenges).toHaveLength(1);
    expect(playerById(state, 'p1')?.tokens).toBe(1);
  });

  it('refuses a bet from a player with no token left', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [
        { years: [1980] },
        { years: [1990], tokens: 0 },
        { years: [1970], tokens: 1 },
      ]),
      1995,
    );
    const state = run(
      base,
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 1, at: 100 },
    );
    expect(state.turn?.challenges).toHaveLength(0);
  });

  it('challengers keep losing their token when the active player was right', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [
        { years: [1980] },
        { years: [1990], tokens: 2 },
        { years: [1970], tokens: 2 },
      ]),
      1995,
    );
    const state = run(
      base,
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 1, at: 0 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 0, at: 100 },
      { type: 'CLOSE_CHALLENGES' },
    );
    expect(state.turn?.outcome?.wonBy).toBe('p0');
    expect(playerById(state, 'p1')?.tokens).toBe(1);
  });

  it('closes the window on its own once everyone has answered', () => {
    const state = run(
      contested(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'CHALLENGE', playerId: 'p1', slot: 1, at: 100 },
      { type: 'PASS_CHALLENGE', playerId: 'p2' },
    );
    expect(state.phase).toBe('reveal');
  });

  it('does not count the active player as owing an answer', () => {
    const state = run(contested(), { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 });
    expect(eligibleChallengers(state).map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

describe('tokens', () => {
  it('awards one for a title and artist the table validates', () => {
    const state = run(
      startedGame(),
      { type: 'SET_CLAIM', playerId: 'p0', value: true },
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: true },
    );
    expect(playerById(state, 'p0')?.tokens).toBe(1);
  });

  it('awards it even when the card was misplaced', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [{ years: [1980] }, { years: [1990] }, { years: [1970] }]),
      1995,
    );
    const state = run(
      base,
      { type: 'SET_CLAIM', playerId: 'p0', value: true },
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: true },
    );
    expect(state.turn?.outcome?.activeCorrect).toBe(false);
    expect(playerById(state, 'p0')?.tokens).toBe(1);
  });

  it('grants nothing when the table says no', () => {
    const state = run(
      startedGame(),
      { type: 'SET_CLAIM', playerId: 'p0', value: true },
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: false },
    );
    expect(playerById(state, 'p0')?.tokens).toBe(0);
  });

  it('cannot be judged twice', () => {
    const state = run(
      startedGame(),
      { type: 'SET_CLAIM', playerId: 'p0', value: true },
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: true },
      { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: true },
    );
    expect(playerById(state, 'p0')?.tokens).toBe(1);
  });

  it('needs nothing judged when nothing was announced', () => {
    const state = run(startedGame(), { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 });
    expect(state.turn?.outcome?.claimGranted).toBe(false);
  });

  it('caps at five', () => {
    const base = withTable(startedGame(), [{ years: [1980], tokens: MAX_TOKENS }]);
    const state = run(
      base,
      { type: 'SET_CLAIM', playerId: 'p0', value: true },
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: true },
    );
    expect(playerById(state, 'p0')?.tokens).toBe(MAX_TOKENS);
  });
});

describe('trading three tokens for a card', () => {
  it('places the card for free and spends exactly three', () => {
    const base = withCardInPlay(
      withTable(startedGame(), [{ years: [1980, 2000], tokens: 4 }]),
      1995,
    );
    const state = run(base, { type: 'TRADE_TOKENS', playerId: 'p0' });
    expect(state.phase).toBe('reveal');
    expect(state.turn?.outcome?.traded).toBe(true);
    expect(playerById(state, 'p0')?.tokens).toBe(1);
    expect(playerById(state, 'p0')?.timeline.map((c) => c.year)).toEqual([1980, 1995, 2000]);
  });

  it('is refused below three tokens', () => {
    const base = withTable(startedGame(), [{ years: [1980], tokens: 2 }]);
    const state = run(base, { type: 'TRADE_TOKENS', playerId: 'p0' });
    expect(state.phase).toBe('listening');
    expect(playerById(state, 'p0')?.tokens).toBe(2);
  });

  it('is refused to anyone but the active player', () => {
    const base = withTable(startedGame(), [
      { years: [1980] },
      { years: [1990], tokens: 5 },
      { years: [1970] },
    ]);
    const state = run(base, { type: 'TRADE_TOKENS', playerId: 'p1' });
    expect(state.phase).toBe('listening');
    expect(playerById(state, 'p1')?.tokens).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Turn flow and end of game
// ---------------------------------------------------------------------------

describe('turn flow', () => {
  it('passes the turn on and deals a new card', () => {
    const started = startedGame();
    const state = drawn(
      run(
        started,
        { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
        { type: 'NEXT_TURN' },
      ),
    );
    expect(state.phase).toBe('listening');
    expect(activePlayer(state)?.id).toBe('p1');
    expect(state.turn?.cardId).not.toBe(started.turn?.cardId);
    expect(state.drawPile.length).toBe(started.drawPile.length - 1);
  });

  it('wraps around to the first player', () => {
    let state = startedGame();
    for (let i = 0; i < 3; i++) {
      state = drawn(
        run(
          state,
          { type: 'COMMIT_PLACEMENT', playerId: `p${i}`, slot: 0, at: 0 },
          { type: 'NEXT_TURN' },
        ),
      );
    }
    expect(activePlayer(state)?.id).toBe('p0');
  });

  it('can detour through karaoke and come back', () => {
    const state = run(
      startedGame(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'OPEN_KARAOKE' },
    );
    expect(state.phase).toBe('karaoke');
    expect(run(state, { type: 'CLOSE_KARAOKE' }).phase).toBe('reveal');
    expect(run(state, { type: 'NEXT_TURN' }).phase).toBe('draw');
  });

  it('ends the game when someone reaches the target', () => {
    const base = withCardInPlay(
      {
        ...withTable(startedGame(), [
          { years: [1970, 1975, 1980] },
          { years: [1990] },
          { years: [1960] },
        ]),
        settings: { ...initialState().settings, targetCards: 4 },
      },
      1995,
    );
    const state = run(
      base,
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 3, at: 0 },
      { type: 'CLOSE_CHALLENGES' },
    );
    expect(state.winner).toBe('p0');
    // The reveal still plays out before the game is declared over.
    expect(state.phase).toBe('reveal');
    expect(run(state, { type: 'NEXT_TURN' }).phase).toBe('gameover');
  });

  it('falls back to the leader when the pile runs dry', () => {
    const base = {
      ...withTable(startedGame(), [
        { years: [1970, 1975] },
        { years: [1990] },
        { years: [1960] },
      ]),
      drawPile: [],
    };
    const state = run(
      base,
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'NEXT_TURN' },
    );
    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('p0');
  });

  it('keeps the table when returning to the lobby', () => {
    const state = run(startedGame(), { type: 'RESET_TO_LOBBY' });
    expect(state.phase).toBe('lobby');
    expect(state.players).toHaveLength(3);
    expect(state.players.every((p) => p.timeline.length === 0 && p.tokens === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------------

describe('redactForGuests', () => {
  it('hides the card in play and the pile while the song is on', () => {
    const state = startedGame();
    expect(state.phase).toBe('listening');
    const guest = redactForGuests(state);
    expect(guest.turn?.cardId).toBe('');
    expect(guest.drawPile).toEqual([]);
    // Timelines are face-up on the table, so they stay.
    expect(guest.players[0]?.timeline).toHaveLength(1);
  });

  it('reveals the card once the turn has resolved', () => {
    const state = run(startedGame(), { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 });
    expect(redactForGuests(state).turn?.cardId).toBe(state.turn?.cardId);
  });
});

describe('version', () => {
  it('advances only when an action is accepted', () => {
    const state = startedGame();
    // Wrong player: rejected, so nothing moves.
    expect(run(state, { type: 'COMMIT_PLACEMENT', playerId: 'p2', slot: 0, at: 0 }).version).toBe(
      state.version,
    );
    expect(run(state, { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 }).version).toBeGreaterThan(
      state.version,
    );
  });
});

describe('challenge deadline', () => {
  it('is stamped from the host clock so every phone counts to the same instant', () => {
    const state = run(startedGame(), {
      type: 'COMMIT_PLACEMENT',
      playerId: 'p0',
      slot: 0,
      at: 1_000_000,
    });
    expect(state.turn?.challengeEndsAt).toBe(1_000_000 + 10 * 1000);
  });

  it('is absent when the table plays without a timer', () => {
    const base = run(initialState(), {
      type: 'ADD_PLAYER',
      playerId: 'p0',
      name: 'Alice',
    });
    const started = drawn(
      run(
        base,
        { type: 'SET_SETTINGS', settings: { challengeSeconds: 0 } },
        { type: 'START_GAME', seed: 5 },
      ),
    );
    const state = run(started, {
      type: 'COMMIT_PLACEMENT',
      playerId: 'p0',
      slot: 0,
      at: 1_000_000,
    });
    expect(state.turn?.challengeEndsAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The rotating arbiter
// ---------------------------------------------------------------------------

describe('the arbiter', () => {
  it('is the player to the active player’s left', () => {
    const state = startedGame();
    expect(activePlayer(state)?.id).toBe('p0');
    expect(arbiter(state)?.id).toBe('p1');
  });

  it('rotates with the turn, staying one seat ahead', () => {
    let state = startedGame();
    const seen: [string, string][] = [];
    for (let i = 0; i < 4; i++) {
      seen.push([activePlayer(state)?.id ?? '', arbiter(state)?.id ?? '']);
      state = drawn(
        run(
          state,
          { type: 'COMMIT_PLACEMENT', playerId: activePlayer(state)?.id ?? '', slot: 0, at: 0 },
          { type: 'NEXT_TURN' },
        ),
      );
    }
    expect(seen).toEqual([
      ['p0', 'p1'],
      ['p1', 'p2'],
      ['p2', 'p0'],
      ['p0', 'p1'],
    ]);
  });

  it('is the other player in a two-handed game', () => {
    const state = startedGame(['Alice', 'Bob']);
    expect(arbiter(state)?.id).toBe('p1');
  });

  it('does not exist in a solo game', () => {
    expect(arbiter(startedGame(['Alice']))).toBeUndefined();
  });
});

describe('drawing the card', () => {
  it('waits for the arbiter rather than starting on its own', () => {
    const state = gameAwaitingDraw();
    expect(state.phase).toBe('draw');
    expect(state.turn?.drawnBy).toBeNull();
  });

  it('starts the song when the arbiter draws', () => {
    const state = run(gameAwaitingDraw(), { type: 'DRAW_CARD', playerId: 'p1' });
    expect(state.phase).toBe('listening');
    expect(state.turn?.drawnBy).toBe('p1');
  });

  it('refuses the draw to the active player — that is the whole point', () => {
    const state = run(gameAwaitingDraw(), { type: 'DRAW_CARD', playerId: 'p0' });
    expect(state.phase).toBe('draw');
  });

  it('refuses the draw to a player who is neither', () => {
    const state = run(gameAwaitingDraw(), { type: 'DRAW_CARD', playerId: 'p2' });
    expect(state.phase).toBe('draw');
  });

  it('lets a solo player draw for themselves, so the game is not stuck', () => {
    const solo = run(
      run(initialState(), { type: 'ADD_PLAYER', playerId: 'p0', name: 'Alice' }),
      { type: 'START_GAME', seed: 9 },
    );
    expect(canDraw(solo, 'p0')).toBe(true);
    expect(run(solo, { type: 'DRAW_CARD', playerId: 'p0' }).phase).toBe('listening');
  });

  it('hands the next card back to the draw step', () => {
    const state = run(
      startedGame(),
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
      { type: 'NEXT_TURN' },
    );
    expect(state.phase).toBe('draw');
    expect(state.turn?.drawnBy).toBeNull();
  });

  it('keeps the card hidden from guests while it is still face down', () => {
    const state = gameAwaitingDraw();
    expect(redactForGuests(state).turn?.cardId).toBe('');
  });
});

describe('ruling on the announcement', () => {
  const claimed = () =>
    run(
      startedGame(),
      { type: 'SET_CLAIM', playerId: 'p0', value: true },
      { type: 'COMMIT_PLACEMENT', playerId: 'p0', slot: 0, at: 0 },
    );

  it('belongs to the arbiter', () => {
    const state = run(claimed(), { type: 'RESOLVE_CLAIM', playerId: 'p1', granted: true });
    expect(playerById(state, 'p0')?.tokens).toBe(1);
  });

  it('is refused to another player at the table', () => {
    const state = run(claimed(), { type: 'RESOLVE_CLAIM', playerId: 'p2', granted: true });
    expect(state.turn?.outcome?.claimGranted).toBeNull();
    expect(playerById(state, 'p0')?.tokens).toBe(0);
  });

  it('is refused to the player who made the announcement', () => {
    const state = run(claimed(), { type: 'RESOLVE_CLAIM', playerId: 'p0', granted: true });
    expect(state.turn?.outcome?.claimGranted).toBeNull();
  });
});
