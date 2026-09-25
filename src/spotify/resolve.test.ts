import { describe, expect, it } from 'vitest';
import { normalise, pickBestMatch } from './resolve';
import type { Card } from '@/game/types';

/**
 * The matcher decides which recording actually plays, and a wrong choice is
 * invisible: the deck check reports a card as resolved either way, and the
 * mistake only surfaces at the party, when a karaoke backing track comes out of
 * the speaker. Hence the emphasis here on what must be *rejected* rather than on
 * what scores highest.
 *
 * Candidates are hand-built rather than fetched — the point is the ranking, and
 * a test that needs Spotify to be reachable is a test nobody runs.
 */

const card = (title: string, artist: string): Card => ({
  id: 'x',
  title,
  artist,
  year: 1975,
  genres: ['rock'],
  difficulty: 'medium',
});

type Candidate = Parameters<typeof pickBestMatch>[1][number];

let counter = 0;
/** A plausible three-and-a-half minutes, so the length guard is exercised. */
const track = (
  name: string,
  artists: string[],
  album = name,
  extra: Partial<Candidate> = {},
): Candidate =>
  ({
    id: `t${++counter}`,
    uri: `spotify:track:t${counter}`,
    name,
    duration_ms: 213_000,
    album: { name: album },
    artists: artists.map((a) => ({ name: a })),
    ...extra,
  }) as Candidate;

describe('normalise', () => {
  it('folds accents, case and punctuation', () => {
    expect(normalise('Voilà, Les Bébés!')).toBe('voila les bebes');
  });

  it('drops the reissue cruft that pads Spotify titles', () => {
    expect(normalise('Heroes - 2017 Remaster')).toBe('heroes');
    expect(normalise('Dancing Queen (Radio Edit)')).toBe('dancing queen');
    expect(normalise('Thriller - Single Version')).toBe('thriller');
  });

  it('leaves a bare title alone', () => {
    expect(normalise('Bohemian Rhapsody')).toBe('bohemian rhapsody');
  });
});

describe('pickBestMatch', () => {
  it('takes the exact recording', () => {
    const wanted = track('Bohemian Rhapsody', ['Queen']);
    const match = pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [
      track('Bohemian Rhapsody - Live Aid', ['Queen']),
      wanted,
    ]);
    expect(match?.uri).toBe(wanted.uri);
  });

  it('sees through a remaster suffix', () => {
    const match = pickBestMatch(card('Heroes', 'David Bowie'), [
      track('Heroes - 2017 Remaster', ['David Bowie']),
    ]);
    expect(match).not.toBeNull();
  });

  // Every one of these is a real thing Spotify returns for a classic, and each
  // would be a small disaster at a party.
  it.each([
    ['karaoke', track('Bohemian Rhapsody (Karaoke Version)', ['Karaoke Crew'])],
    ['tribute', track('Bohemian Rhapsody', ['Queen Tribute Band'])],
    ['made famous by', track('Bohemian Rhapsody (Made Famous By Queen)', ['The Hit Co'])],
    ['instrumental', track('Bohemian Rhapsody - Instrumental', ['Queen'])],
    ['lullaby', track('Bohemian Rhapsody', ['Rockabye Baby'], 'Lullaby Renditions')],
  ])('rejects the %s impostor rather than ranking it down', (_label, impostor) => {
    expect(pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [impostor])).toBeNull();
  });

  it('still allows a remix when the card asks for one', () => {
    const match = pickBestMatch(card('Cold Heart (PNAU Remix)', 'Elton John'), [
      track('Cold Heart - PNAU Remix', ['Elton John', 'Dua Lipa']),
    ]);
    expect(match).not.toBeNull();
  });

  it('refuses the right song by the wrong band', () => {
    expect(
      pickBestMatch(card('Hurt', 'Johnny Cash'), [track('Hurt', ['Nine Inch Nails'])]),
    ).toBeNull();
  });

  it('prefers the studio take over a live one', () => {
    const studio = track('Wish You Were Here', ['Pink Floyd']);
    const match = pickBestMatch(card('Wish You Were Here', 'Pink Floyd'), [
      track('Wish You Were Here - Live', ['Pink Floyd']),
      studio,
    ]);
    expect(match?.uri).toBe(studio.uri);
  });

  it('matches a featured artist on the credited lead alone', () => {
    const match = pickBestMatch(card('Umbrella', 'Rihanna'), [
      track('Umbrella', ['Rihanna', 'JAY-Z']),
    ]);
    expect(match).not.toBeNull();
  });

  it('handles an ampersand where the catalogue wrote "and"', () => {
    const match = pickBestMatch(card('Under Pressure', 'Queen and David Bowie'), [
      track('Under Pressure', ['Queen', 'David Bowie']),
    ]);
    expect(match).not.toBeNull();
  });

  it('returns null on an empty result rather than inventing a match', () => {
    expect(pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [])).toBeNull();
  });

  it('refuses a track this account cannot play', () => {
    // The market-scoped search says so outright; taking it would resolve the
    // card and then produce silence in the middle of a turn.
    expect(
      pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [
        track('Bohemian Rhapsody', ['Queen'], 'A Night at the Opera', {
          is_playable: false,
        }),
      ]),
    ).toBeNull();
  });

  it('refuses album furniture wearing the song title', () => {
    // Starting thirty seconds into a forty-second intro is three seconds of
    // nothing, then the next turn.
    expect(
      pickBestMatch(card('Papaoutai', 'Stromae'), [
        track('Intro', ['Stromae'], 'Racine carrée', { duration_ms: 41_000 }),
      ]),
    ).toBeNull();
  });

  it.each([
    ['skit', 'Papaoutai (Skit)'],
    ['interlude', 'Papaoutai - Interlude'],
    ['outro', 'Papaoutai Outro'],
  ])('refuses a %s even at a normal length', (_label, name) => {
    expect(
      pickBestMatch(card('Papaoutai', 'Stromae'), [track(name, ['Stromae'])]),
    ).toBeNull();
  });

  it('keeps a song whose album happens to be called Intro', () => {
    // The filter reads the track title, not the record's — rejecting a whole
    // album for its name would cost more than it saves.
    expect(
      pickBestMatch(card('Papaoutai', 'Stromae'), [
        track('Papaoutai', ['Stromae'], 'Intro'),
      ]),
    ).not.toBeNull();
  });

  it.each([
    ['a snippet', 44_000],
    ['a full live side', 46 * 60_000],
  ])('refuses %s', (_label, duration_ms) => {
    expect(
      pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [
        track('Bohemian Rhapsody', ['Queen'], 'A Night at the Opera', { duration_ms }),
      ]),
    ).toBeNull();
  });

  it('accepts a long song that is simply long', () => {
    expect(
      pickBestMatch(card('Hey Jude', 'The Beatles'), [
        track('Hey Jude', ['The Beatles'], 'Hey Jude', { duration_ms: 431_000 }),
      ]),
    ).not.toBeNull();
  });

  it('treats a missing length as unknown rather than suspect', () => {
    expect(
      pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [
        track('Bohemian Rhapsody', ['Queen'], 'A Night at the Opera', {
          duration_ms: undefined as unknown as number,
        }),
      ]),
    ).not.toBeNull();
  });

  it('returns null when nothing clears the confidence bar', () => {
    // A wrong track is worse than a missing one: the deck check can show a gap
    // but has no way to notice a mismatch.
    expect(
      pickBestMatch(card('Bohemian Rhapsody', 'Queen'), [
        track('Bohemian Like You', ['The Dandy Warhols']),
      ]),
    ).toBeNull();
  });
});
