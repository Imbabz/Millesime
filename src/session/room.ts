import { appUrl } from '@/config';

/**
 * Room codes and join links.
 *
 * The alphabet leaves out every character that gets misread across a table —
 * O/0, I/1, S/5 — because someone will always end up reading the code out loud
 * instead of scanning the QR.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

export const ROOM_CODE_LENGTH = 4;

export function newRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Accepts what a human typed — lowercase, spaces, stray dashes. */
export function normaliseRoomCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((c) => ALPHABET.includes(c))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

export const isRoomCode = (code: string): boolean =>
  code.length === ROOM_CODE_LENGTH && normaliseRoomCode(code) === code;

/** The URL encoded into the QR code guests scan with their camera app. */
export const joinUrl = (code: string): string => `${appUrl()}#/join/${code}`;
