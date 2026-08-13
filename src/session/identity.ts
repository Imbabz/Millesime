/**
 * Who this phone is.
 *
 * A player is identified by a random id kept in `localStorage`, not by an
 * account. That is what lets someone close Safari mid-game, reopen the link and
 * drop straight back into their own seat with their timeline intact — no login,
 * no email, nothing to remember. It also means a guest never needs a Spotify
 * account: only the host authenticates.
 */

const ID_KEY = 'millesime.playerId';
const NAME_KEY = 'millesime.playerName';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function playerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export const playerName = (): string => localStorage.getItem(NAME_KEY) ?? '';

export const setPlayerName = (name: string): void => {
  localStorage.setItem(NAME_KEY, name.trim());
};
