import { useRef, useState } from 'react';
import { appUrl, hasSpotify, loadConfig, saveConfig, type AppConfig } from '@/config';
import { beginLogin, isSignedIn, signOut } from '@/spotify/auth';
import { CATALOGUE } from '@/deck/catalogue';
import { checkDeck, forgetAllUris, resolvedCount, type DeckCheckProgress } from '@/spotify/resolve';
import { Banner } from '@/ui/bits';

/**
 * Setup, kept inside the app rather than in CI.
 *
 * The whole project is meant to be operated from a phone, so the three
 * third-party values live here and in `localStorage`, where they can be pasted
 * and changed in Safari without redeploying anything. None of them is a secret:
 * the Supabase anon key is published by design and the PKCE flow exists so that
 * no client secret ever exists.
 */
export function ConfigScreen({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<DeckCheckProgress | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const signedIn = isSignedIn();
  const redirect = appUrl();

  const update = (patch: Partial<AppConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
    setSaved(true);
  };

  const runCheck = async () => {
    setChecking(true);
    abortRef.current = new AbortController();
    try {
      await checkDeck(config.spotifyClientId, CATALOGUE, setCheck, abortRef.current.signal);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="screen">
      <div className="row row--between">
        <h1 className="title">Configuration</h1>
        <button className="btn" onClick={onBack}>
          Retour
        </button>
      </div>

      {saved && <Banner tone="warn">Enregistré sur ce téléphone.</Banner>}

      <div className="scroll grow stack">
        {/* ------------------------------------------------------ Spotify */}
        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>🎧 Spotify</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            Seul l’hôte se connecte. Il faut un compte <strong>Premium</strong> : la
            lecture à distance n’existe pas sur les comptes gratuits.
          </p>

          <label className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Client ID</span>
            <input
              className="field"
              value={config.spotifyClientId}
              placeholder="32 caractères depuis le dashboard Spotify"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => update({ spotifyClientId: e.target.value.trim() })}
            />
          </label>

          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Redirect URI à déclarer</span>
            <code
              style={{
                fontSize: 13,
                wordBreak: 'break-all',
                background: 'var(--ink-sunken)',
                padding: 10,
                borderRadius: 12,
              }}
            >
              {redirect}
            </code>
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(redirect);
                setCopied(true);
              }}
            >
              {copied ? 'Copié ✓' : 'Copier'}
            </button>
            <p className="subtitle" style={{ margin: 0 }}>
              Colle-la telle quelle dans <em>Redirect URIs</em> sur
              developer.spotify.com, et ajoute ton compte dans la liste des
              utilisateurs autorisés (5 maximum en Development Mode).
            </p>
          </div>

          {signedIn ? (
            <button className="btn btn--block" onClick={() => { signOut(); setSaved(false); onBack(); }}>
              Se déconnecter de Spotify
            </button>
          ) : (
            <button
              className="btn btn--primary btn--block"
              disabled={!hasSpotify(config)}
              onClick={() => void beginLogin(config.spotifyClientId)}
            >
              Se connecter à Spotify
            </button>
          )}
        </section>

        {/* ----------------------------------------------------- Supabase */}
        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>📡 Salons multi-téléphones</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            Crée un projet gratuit sur supabase.com et recopie les deux valeurs.
            Aucune table à créer : seuls les canaux temps réel sont utilisés. Sans
            ça, le jeu reste jouable sur un seul téléphone.
          </p>
          <label className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Project URL</span>
            <input
              className="field"
              value={config.supabaseUrl}
              placeholder="https://xxxx.supabase.co"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => update({ supabaseUrl: e.target.value.trim() })}
            />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Clé anon (publishable)</span>
            <input
              className="field"
              value={config.supabaseAnonKey}
              placeholder="eyJ…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => update({ supabaseAnonKey: e.target.value.trim() })}
            />
          </label>
        </section>

        {/* --------------------------------------------------------- deck */}
        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>🗂 Vérifier le deck</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            Associe chaque carte à un morceau du catalogue Spotify, une fois pour
            toutes. À faire avant la soirée : {CATALOGUE.length} recherches, c’est
            long, et ça évite un blanc au milieu d’un tour.
          </p>
          <p className="subtitle" style={{ margin: 0 }}>
            {resolvedCount()} / {CATALOGUE.length} cartes déjà associées.
          </p>

          {check && (
            <>
              <p className="subtitle" style={{ margin: 0 }}>
                {check.done} / {check.total} · {check.missing.length} introuvable
                {check.missing.length > 1 ? 's' : ''}
              </p>
              {!checking && check.missing.length > 0 && (
                <details>
                  <summary className="subtitle">Voir les cartes introuvables</summary>
                  <ul style={{ paddingLeft: 18 }}>
                    {check.missing.map((c) => (
                      <li key={c.id} className="subtitle">
                        {c.artist} — {c.title}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {checking ? (
            <button className="btn btn--block" onClick={() => abortRef.current?.abort()}>
              Arrêter
            </button>
          ) : (
            <button
              className="btn btn--block"
              disabled={!hasSpotify(config) || !signedIn}
              onClick={() => void runCheck()}
            >
              Lancer la vérification
            </button>
          )}
          <button
            className="btn btn--ghost btn--block"
            onClick={() => {
              forgetAllUris();
              setCheck(null);
            }}
          >
            Vider le cache d’association
          </button>
        </section>

        <p className="subtitle" style={{ textAlign: 'center', fontSize: 12 }}>
          Millésime — mécaniques inspirées des jeux de placement musical.
          Paroles : LRCLIB. Musique : Spotify.
        </p>
      </div>
    </div>
  );
}
