import { useState } from 'react';
import { RULES } from '@/content/rules';
import { Sheet } from './bits';

/**
 * The floating "?" and the rules it opens.
 *
 * Mounted on every screen for every player, host or guest, at every phase. The
 * rules question always arrives mid-turn and from whoever is not playing, so
 * answering it must never cost anyone their place in the game.
 */
export function RulesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="help-button" onClick={() => setOpen(true)} aria-label="Les règles">
        ?
      </button>
      {open && (
        <Sheet title="Les règles" onClose={() => setOpen(false)}>
          <div className="stack" style={{ paddingBottom: 8 }}>
            {RULES.map((section) => (
              <section key={section.id} className="panel">
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>{section.title}</h3>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                  {section.lines.map((line) => (
                    <li key={line} style={{ fontSize: 15, color: 'var(--text-dim)' }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
