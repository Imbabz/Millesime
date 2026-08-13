import { describe, expect, it } from 'vitest';
import { interpolatePosition, lineIndexAt, parseLrc, plainToLines } from './lrc';

describe('parseLrc', () => {
  it('reads minutes, seconds and hundredths', () => {
    expect(parseLrc('[00:12.34]Bonjour')).toEqual([{ atMs: 12_340, text: 'Bonjour' }]);
  });

  it('reads thousandths when three digits are given', () => {
    expect(parseLrc('[01:02.500]Salut')).toEqual([{ atMs: 62_500, text: 'Salut' }]);
  });

  it('accepts a colon before the fraction', () => {
    expect(parseLrc('[00:05:50]Ok')).toEqual([{ atMs: 5_500, text: 'Ok' }]);
  });

  it('expands a line carrying several timestamps', () => {
    expect(parseLrc('[00:10.00][01:10.00]Refrain')).toEqual([
      { atMs: 10_000, text: 'Refrain' },
      { atMs: 70_000, text: 'Refrain' },
    ]);
  });

  it('drops metadata tags', () => {
    expect(parseLrc('[ar:Queen]\n[ti:Bohemian Rhapsody]\n[00:01.00]Is this')).toEqual([
      { atMs: 1000, text: 'Is this' },
    ]);
  });

  it('keeps timed blank lines so the scroller can go quiet', () => {
    expect(parseLrc('[00:01.00]Un\n[00:20.00]')).toEqual([
      { atMs: 1000, text: 'Un' },
      { atMs: 20_000, text: '' },
    ]);
  });

  it('sorts out-of-order stamps', () => {
    expect(parseLrc('[00:30.00]B\n[00:10.00]A').map((l) => l.text)).toEqual(['A', 'B']);
  });

  it('returns nothing for lyrics with no timestamps at all', () => {
    expect(parseLrc('Just some words\nAnd more')).toEqual([]);
  });

  it('handles minutes past 99', () => {
    expect(parseLrc('[100:00.00]Long')).toEqual([{ atMs: 6_000_000, text: 'Long' }]);
  });
});

describe('plainToLines', () => {
  it('keeps the words and marks them untimed', () => {
    expect(plainToLines('Un\n\n  Deux  ')).toEqual([
      { atMs: -1, text: 'Un' },
      { atMs: -1, text: 'Deux' },
    ]);
  });
});

describe('lineIndexAt', () => {
  const lines = parseLrc('[00:00.00]A\n[00:10.00]B\n[00:20.00]C');

  it('is -1 before the first line', () => {
    expect(lineIndexAt(parseLrc('[00:05.00]A'), 0)).toBe(-1);
  });

  it('lands on the line that has started', () => {
    expect(lineIndexAt(lines, 0)).toBe(0);
    expect(lineIndexAt(lines, 9_999)).toBe(0);
    expect(lineIndexAt(lines, 10_000)).toBe(1);
    expect(lineIndexAt(lines, 999_999)).toBe(2);
  });

  it('copes with an empty script', () => {
    expect(lineIndexAt([], 1000)).toBe(-1);
  });
});

describe('interpolatePosition', () => {
  const base = { playing: true, positionMs: 30_000, atEpochMs: 1_000_000, durationMs: 200_000 };

  it('advances with the wall clock while playing', () => {
    expect(interpolatePosition(base, 1_002_500)).toBe(32_500);
  });

  it('freezes when paused', () => {
    expect(interpolatePosition({ ...base, playing: false }, 1_090_000)).toBe(30_000);
  });

  it('never runs past the end of the track', () => {
    expect(interpolatePosition(base, 9_000_000)).toBe(200_000);
  });

  it('does not extrapolate before the first report', () => {
    expect(interpolatePosition({ ...base, atEpochMs: 0 }, 5_000_000)).toBe(30_000);
  });

  it('ignores a clock that went backwards', () => {
    expect(interpolatePosition(base, 900_000)).toBe(30_000);
  });
});
