import { useMemo, useState } from 'react';
import type { Action } from '@/game/engine';
import { MAX_PLAYERS } from '@/game/engine';
import { filterDeck, minimumDeckSize } from '@/game/deckFilter';
import { CATALOGUE } from '@/deck/catalogue';
import {
  DIFFICULTY_LABELS,
  GENRE_LABELS,
  type Decade,
  type Difficulty,
  type GameState,
  type Genre,
} from '@/game/types';
import { ONBOARDING } from '@/content/rules';
import { QrCode } from '@/ui/QrCode';
import { joinUrl } from '@/session/room';
import { Banner, PlayerChip, Sheet } from '@/ui/bits';

const DECADES: Decade[] = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const DECADE_LABEL = (d: Decade) => `${String(d).slice(2)}s`;

/**
 * The waiting room: who is playing, what the deck is made of, and the QR code.
 *
 * The card count under the filters is the important part. Choosing "chanson
 * française + années 50" is a perfectly reasonable-looking selection that
 * cannot actually seat four players, and finding that out after everyone has
 * joined is the kind of thing that ends a game before it starts.
 */
export function LobbyScreen({
  state,
  isHost,
  code,
  dispatch,
  onOpenSpotify,
  spotifyBanner,
}: {
  state: GameState;
  isHost: boolean;
  code: string;
  dispatch: (action: Action) => void;
  onOpenSpotify: () => void;
  spotifyBanner: string | null;
}) {
  const [showQr, setShowQr] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { settings, players } = state;

  const poolSize = useMemo(
    () => filterDeck(CATALOGUE, settings).length,
    [settings],
  );
  const needed = minimumDeckSize(Math.max(1, players.length), settings.targetCards);
  const tooThin = poolSize < needed;
  const canStart = players.length >= 1 && !tooThin;

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const set = (patch: Partial<typeof settings>) =>
    dispatch({ type: 'SET_SETTINGS', settings: patch });

  return (
    <div className="screen">
      <div className="row row--between">
        <div>
          <div className="eyebrow">Salon</div>
          <h1 className="title">{code === 'LOCAL' ? 'Sur ce téléphone' : code}</h1>
        </div>
        {code !== 'LOCAL' && (
          <button className="btn" onClick={() => setShowQr(true)}>
            📷 QR code
          </button>
        )}
      </div>

      {spotifyBanner && isHost && (
        <Banner tone="warn">
          {spotifyBanner}{' '}
          <button
            className="btn btn--ghost"
            style={{ minHeight: 32, padding: '0 8px', display: 'inline-flex' }}
            onClick={onOpenSpotify}
          >
            Configurer
          </button>
        </Banner>
      )}

      <section className="stack">
        <div className="row row--between">
          <span className="eyebrow">
            Joueurs ({players.length}/{MAX_PLAYERS})
          </span>
          <button className="btn btn--ghost" style={{ minHeight: 36 }} onClick={() => setShowHelp(true)}>
            Première partie ?
          </button>
        </div>
        {players.length === 0 && (
          <p className="subtitle">
            Personne n’a encore rejoint. Fais scanner le QR code, ou passe ce téléphone
            de main en main.
          </p>
        )}
        {players.map((player) => (
          <PlayerChip
            key={player.id}
            player={player}
            right={
              isHost && state.phase === 'lobby' ? (
                <button
                  className="btn btn--ghost"
                  style={{ minHeight: 36, padding: '0 10px' }}
                  onClick={() => dispatch({ type: 'REMOVE_PLAYER', playerId: player.id })}
                >
                  Retirer
                </button>
              ) : undefined
            }
          />
        ))}
      </section>

      {isHost && (
        <>
          <section className="stack">
            <span className="eyebrow">Décennies</span>
            <div className="chips">
              {DECADES.map((decade) => (
                <button
                  key={decade}
                  className={`chip${settings.decades.includes(decade) ? ' chip--on' : ''}`}
                  onClick={() => set({ decades: toggle(settings.decades, decade) })}
                >
                  {DECADE_LABEL(decade)}
                </button>
              ))}
            </div>
          </section>

          <section className="stack">
            <span className="eyebrow">Genres</span>
            <div className="chips">
              {(Object.keys(GENRE_LABELS) as Genre[]).map((genre) => (
                <button
                  key={genre}
                  className={`chip${settings.genres.includes(genre) ? ' chip--on' : ''}`}
                  onClick={() => set({ genres: toggle(settings.genres, genre) })}
                >
                  {GENRE_LABELS[genre]}
                </button>
              ))}
            </div>
            <p className="subtitle">
              Rien de sélectionné = tout est dans la pioche. Décennies et genres se
              combinent.
            </p>
          </section>

          <section className="stack">
            <span className="eyebrow">Difficulté</span>
            <div className="chips">
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((level) => (
                <button
                  key={level}
                  className={`chip${settings.difficulties.includes(level) ? ' chip--on' : ''}`}
                  onClick={() => set({ difficulties: toggle(settings.difficulties, level) })}
                >
                  {DIFFICULTY_LABELS[level]}
                </button>
              ))}
            </div>
          </section>

          <section className="panel stack">
            <label className="row row--between">
              <span>Cartes pour gagner</span>
              <span className="row">
                <button
                  className="btn"
                  style={{ minHeight: 40, width: 44 }}
                  onClick={() => set({ targetCards: Math.max(3, settings.targetCards - 1) })}
                >
                  −
                </button>
                <strong style={{ minWidth: 28, textAlign: 'center' }}>
                  {settings.targetCards}
                </strong>
                <button
                  className="btn"
                  style={{ minHeight: 40, width: 44 }}
                  onClick={() => set({ targetCards: Math.min(20, settings.targetCards + 1) })}
                >
                  +
                </button>
              </span>
            </label>

            <label className="row row--between">
              <span>
                Démarrer au refrain
                <br />
                <span className="subtitle">≈ 30 s dans le morceau</span>
              </span>
              <input
                type="checkbox"
                checked={settings.startOnHook}
                onChange={(e) => set({ startOnHook: e.target.checked })}
                style={{ width: 28, height: 28 }}
              />
            </label>

            <label className="row row--between">
              <span>
                Fenêtre de vol
                <br />
                <span className="subtitle">0 = pas de minuteur</span>
              </span>
              <span className="row">
                <button
                  className="btn"
                  style={{ minHeight: 40, width: 44 }}
                  onClick={() =>
                    set({ challengeSeconds: Math.max(0, settings.challengeSeconds - 5) })
                  }
                >
                  −
                </button>
                <strong style={{ minWidth: 40, textAlign: 'center' }}>
                  {settings.challengeSeconds}s
                </strong>
                <button
                  className="btn"
                  style={{ minHeight: 40, width: 44 }}
                  onClick={() =>
                    set({ challengeSeconds: Math.min(60, settings.challengeSeconds + 5) })
                  }
                >
                  +
                </button>
              </span>
            </label>
          </section>

          {tooThin ? (
            <Banner tone="error">
              {poolSize} carte{poolSize > 1 ? 's' : ''} dans la pioche, il en faut au moins{' '}
              {needed} pour {players.length} joueur{players.length > 1 ? 's' : ''}. Élargis
              les filtres ou baisse l’objectif.
            </Banner>
          ) : (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              {poolSize} cartes disponibles
            </p>
          )}

          <button
            className="btn btn--primary btn--big btn--block"
            disabled={!canStart}
            onClick={() =>
              dispatch({ type: 'START_GAME', seed: Math.floor(Math.random() * 2 ** 31) })
            }
          >
            Lancer la partie
          </button>
        </>
      )}

      {!isHost && (
        <p className="subtitle" style={{ textAlign: 'center' }}>
          <span className="spin">◍</span> En attente de l’hôte…
        </p>
      )}

      {showQr && (
        <Sheet title="Rejoindre la partie" onClose={() => setShowQr(false)}>
          <div className="stack" style={{ alignItems: 'center' }}>
            <p className="subtitle">
              Scannez avec l’appareil photo. Aucune installation, aucun compte.
            </p>
            <QrCode value={joinUrl(code)} />
            <div className="code">{code}</div>
            <p className="subtitle" style={{ wordBreak: 'break-all' }}>
              {joinUrl(code)}
            </p>
          </div>
        </Sheet>
      )}

      {showHelp && (
        <Sheet title="Première partie ?" onClose={() => setShowHelp(false)}>
          <div className="stack">
            {ONBOARDING.map((step) => (
              <div key={step.title} className="panel">
                <div style={{ fontSize: 28 }}>{step.emoji}</div>
                <h3 style={{ fontSize: 17, margin: '6px 0' }}>{step.title}</h3>
                <p className="subtitle" style={{ margin: 0 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
