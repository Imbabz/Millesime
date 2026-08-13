import { useState } from 'react';
import { playerName, setPlayerName } from '@/session/identity';
import { hasRealtime, loadConfig } from '@/config';
import { Banner } from '@/ui/bits';

/**
 * Where a scanned QR code lands.
 *
 * This is the first thing a guest ever sees, so it asks for exactly one thing:
 * a first name. No account, no install, no Spotify, no permissions prompt.
 */
export function JoinScreen({
  code,
  onEnter,
  onBack,
}: {
  code: string;
  onEnter: (name: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(playerName);
  const realtime = hasRealtime(loadConfig());

  return (
    <div className="screen screen--center">
      <div className="eyebrow">Salon</div>
      <div className="code">{code}</div>

      {!realtime && (
        <Banner tone="error">
          Ce téléphone n’a pas la configuration du salon. Demande à l’hôte de te
          transmettre le lien, ou renseigne Supabase dans ⚙ Configuration.
        </Banner>
      )}

      <h1 className="title">Ton prénom</h1>
      <input
        className="field"
        value={name}
        maxLength={14}
        autoFocus
        placeholder="Alex"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) {
            setPlayerName(name);
            onEnter(name.trim());
          }
        }}
      />
      <button
        className="btn btn--primary btn--big btn--block"
        disabled={!name.trim()}
        onClick={() => {
          setPlayerName(name);
          onEnter(name.trim());
        }}
      >
        Rejoindre la partie
      </button>
      <button className="btn btn--ghost" onClick={onBack}>
        Retour
      </button>
    </div>
  );
}
