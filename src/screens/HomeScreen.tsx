import { useState } from 'react';
import { normaliseRoomCode, ROOM_CODE_LENGTH } from '@/session/room';
import { RulesButton } from '@/ui/RulesSheet';

export function HomeScreen({
  onCreate,
  onJoin,
  onLocal,
  onConfig,
}: {
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLocal: () => void;
  onConfig: () => void;
}) {
  const [code, setCode] = useState('');
  const ready = code.length === ROOM_CODE_LENGTH;

  return (
    <div className="screen screen--center">
      <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 48 }}>🎙</div>
        <h1 className="wordmark">Millésime</h1>
        <p className="subtitle">
          Devine l’année, place le morceau, vole la carte.
        </p>
      </div>

      <div className="stack" style={{ width: '100%', maxWidth: 380, marginTop: 12 }}>
        <button className="btn btn--primary btn--big btn--block" onClick={onCreate}>
          Créer une partie
        </button>

        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="field"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="CODE"
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
            style={{ textAlign: 'center', letterSpacing: '0.2em', fontWeight: 700 }}
          />
          <button className="btn" disabled={!ready} onClick={() => onJoin(code)}>
            Rejoindre
          </button>
        </div>

        <button className="btn btn--ghost btn--block" onClick={onLocal}>
          Jouer sur ce seul téléphone
        </button>
      </div>

      <button
        className="btn btn--ghost"
        style={{ marginTop: 'auto' }}
        onClick={onConfig}
      >
        ⚙ Configuration
      </button>

      <RulesButton />
    </div>
  );
}
