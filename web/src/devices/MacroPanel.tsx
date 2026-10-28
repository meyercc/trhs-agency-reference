import { useEffect, useRef, useState } from 'react';
import { Button, ContextMenu, ContextMenuLabel, Icon, Input, ListItem, Ng3Label, Textarea, ToggleButtonGroup } from '../components';
import {
  LAUNCH_APPS,
  MACRO_KEYS,
  MACRO_KIND_LABEL,
  MACRO_NAME_MAX,
  PLAY_LABEL,
  keyOf,
  macroSummary,
  newMacro,
  nextName,
  playMacro,
  useMacroKeys,
  useMacros,
  type Macro,
  type MacroKey,
  type MacroKind,
  type MacroPlay,
  type MacroRun,
  type MacroTiming,
} from '../state/macros';
import './macro-panel.css';

const DRAG_TYPE = 'text/macro-id';

/**
 * Macros on the macro keys (OpenGSW keys-macros), for the laptop with dedicated
 * macro keys P1–P4 (keys-macros.7). One editor whichever door it is reached
 * from (keys-macros.22). Follows OGH's key assignment page.
 *
 * Left: the player's macros, each with the key it sits on and Edit, Copy,
 * Delete; Create new. Right: the four keys. Put a macro on a key by dragging it
 * there, by the key's menu (New, Edit, Assign), or by the list beside the
 * key — the list is the keyboard way in (keys-macros.26).
 *
 * Changes to the keys wait for Apply; Discard drops them and Reset to default
 * clears every key (keys-macros.13; the question is keys-macros#open:2, here
 * answered the way OGH's page does). A macro's own content counts at Save, and
 * leaving with changes asks first (.14).
 */
export function MacroPanel() {
  const { macros, save, remove, duplicate } = useMacros();
  const { keys, dirty, assign, apply, discard, restore } = useMacroKeys();
  const [editing, setEditing] = useState<{ macro: Macro; forKey: MacroKey | null } | null>(null);
  const [menu, setMenu] = useState<MacroKey | null>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState<MacroKey | null>(null);

  // Escape closes the key menu.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const names = macros.map((m) => m.name);
  const create = (forKey: MacroKey | null = null) => setEditing({ macro: newMacro('keystroke', names), forKey });

  if (editing) {
    return (
      <MacroEditor
        initial={editing.macro}
        isNew={!macros.some((m) => m.id === editing.macro.id)}
        names={names}
        onSave={(m) => {
          save(m);
          if (editing.forKey) assign(editing.forKey, m.id);
          setEditing(null);
        }}
        onDelete={(id) => {
          remove(id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    );
  }

  const byId = (id: string | null) => macros.find((m) => m.id === id) ?? null;

  return (
    <div className="mp mp-keys" data-testid="macro-keys">
      <div className="mp-cols">
        <div className="mp-lib">
          <Ng3Label strong>Macros</Ng3Label>
          {macros.length === 0 && <p className="mp-empty">No macros yet. Create one, then put it on a key.</p>}
          <ul className="mp-list" aria-label="Macros">
            {macros.map((m) => {
              const k = keyOf(keys, m.id);
              return (
                <li
                  key={m.id}
                  className="mp-row"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, m.id);
                    e.dataTransfer.setData('text/plain', m.name);
                    e.dataTransfer.effectAllowed = 'copyMove';
                    setDragging(true);
                  }}
                  onDragEnd={() => {
                    setDragging(false);
                    setOver(null);
                  }}
                >
                  <div className="mp-row-text">
                    <span className="mp-row-name">{m.name}</span>
                    <span className="mp-row-sub">{macroSummary(m)}</span>
                  </div>
                  {k && <span className="mp-tag">{k}</span>}
                  <span className="mp-row-tools">
                    <button type="button" className="ds-btn sm ghost" aria-label={`Edit ${m.name}`} onClick={() => setEditing({ macro: m, forKey: null })}>
                      Edit
                    </button>
                    <button type="button" className="ds-btn sm ghost" aria-label={`Copy ${m.name}`} onClick={() => duplicate(m)}>
                      Copy
                    </button>
                    <button type="button" className="ds-btn sm ghost" aria-label={`Delete ${m.name}`} onClick={() => remove(m.id)}>
                      Delete
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <Button size="sm" onClick={() => create()}>
            <Icon name="add" size={14} />
            Create new
          </Button>
        </div>

        <div className="mp-board">
          <ul className="mp-keylist" aria-label="Macro keys">
            {MACRO_KEYS.map((k) => {
              const m = byId(keys[k]);
              return (
                <li key={k} className="mp-keyrow" data-key={k}>
                  <label className="mp-keylabel">
                    <span className="ds-sr-only">{k} plays</span>
                    <select
                      className={'mp-select' + (m ? '' : ' empty')}
                      aria-label={`${k} plays`}
                      value={keys[k] ?? ''}
                      onChange={(e) => assign(k, e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {macros.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="mp-line" aria-hidden="true" />
                  <div className="mp-capwrap">
                    <button
                      type="button"
                      className={'mp-cap' + (m ? ' set' : '') + (dragging ? ' drop' : '') + (over === k ? ' over' : '')}
                      aria-haspopup="menu"
                      aria-expanded={menu === k}
                      aria-label={`${k} menu`}
                      onClick={() => setMenu(menu === k ? null : k)}
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                        e.preventDefault();
                        setOver(k);
                      }}
                      onDragLeave={() => setOver((o) => (o === k ? null : o))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData(DRAG_TYPE);
                        if (id) assign(k, id);
                        setDragging(false);
                        setOver(null);
                      }}
                    >
                      {k}
                    </button>
                    {menu === k && (
                      <ContextMenu className="mp-menu" aria-label={`${k} menu`}>
                        <ListItem
                          label="New"
                          onClick={() => {
                            setMenu(null);
                            create(k);
                          }}
                        />
                        <ListItem
                          label="Edit"
                          disabled={!m}
                          onClick={() => {
                            if (!m) return;
                            setMenu(null);
                            setEditing({ macro: m, forKey: null });
                          }}
                        />
                        <ContextMenuLabel>Assign</ContextMenuLabel>
                        {macros.map((x) => (
                          <ListItem
                            key={x.id}
                            label={x.name}
                            selected={keys[k] === x.id}
                            onClick={() => {
                              assign(k, x.id);
                              setMenu(null);
                            }}
                          />
                        ))}
                        <ListItem
                          label="Unassigned"
                          selected={!m}
                          onClick={() => {
                            assign(k, null);
                            setMenu(null);
                          }}
                        />
                      </ContextMenu>
                    )}
                  </div>
                  <span className="mp-dim" aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mp-foot">
        <button type="button" className="ds-btn sm ghost" onClick={restore}>
          Reset to default
        </button>
        <span className="mp-state">{dirty ? 'Not applied' : 'Applied'}</span>
        <button type="button" className="ds-btn sm" disabled={!dirty} onClick={discard}>
          Discard changes
        </button>
        <Button size="sm" variant="accent" disabled={!dirty} onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

const MODS = ['Control', 'Alt', 'Shift', 'Meta'];
const KEY_NAME: Record<string, string> = { ' ': 'Space', Control: 'Ctrl', Meta: 'Win', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const keyName = (k: string) => KEY_NAME[k] ?? (k.length === 1 ? k.toUpperCase() : k);

/** Reads a key combination from a key press. Captured, never run (keys-macros.29). */
function comboOf(e: React.KeyboardEvent): string {
  const parts = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Win'].filter(Boolean) as string[];
  if (!MODS.includes(e.key)) parts.push(keyName(e.key));
  return parts.join(' + ');
}

const AUTO_NAME = /^(KEYSTROKE|MULTI-KEY|LAUNCHER|TEXT) \d+$/;

function MacroEditor({
  initial,
  isNew,
  names,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Macro;
  isNew: boolean;
  names: string[];
  onSave: (m: Macro) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [m, setM] = useState<Macro>(initial);
  const [recording, setRecording] = useState(false);
  const [asking, setAsking] = useState(false);
  const last = useRef(0);
  const [out, setOut] = useState('');
  const [trying, setTrying] = useState(false);
  const run = useRef<MacroRun | null>(null);
  // Leaving the editor stops a macro still playing into the test area.
  useEffect(() => () => run.current?.stop(), []);
  const start = () => {
    run.current = playMacro(m, (f) => setOut(f), () => setTrying(false));
    setTrying(true);
  };
  const stop = () => run.current?.stop();
  const dirty = JSON.stringify(m) !== JSON.stringify(initial);
  const set = (patch: Partial<Macro>) => setM((x) => ({ ...x, ...patch }));
  const setKind = (kind: MacroKind) => {
    setRecording(false);
    setM((x) => ({ ...x, kind, name: AUTO_NAME.test(x.name) ? nextName(kind, names) : x.name }));
  };

  // While recording, every key goes to the recorder and nowhere else.
  useEffect(() => {
    if (!recording) return;
    last.current = performance.now();
    const take = (dir: 'down' | 'up') => (e: KeyboardEvent) => {
      if (e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      const now = performance.now();
      const gap = Math.round(now - last.current);
      last.current = now;
      const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      setM((x) => ({ ...x, steps: [...x.steps, { dir, key, gap: x.steps.length ? gap : 0 }] }));
    };
    const down = take('down');
    const up = take('up');
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [recording]);

  const leave = () => (dirty ? setAsking(true) : onClose());
  const gapShown = (gap: number) => (m.timing === 'none' ? 0 : m.timing === 'fixed' ? m.fixedMs : gap);

  const textEmpty = m.kind === 'text' && !m.text.trim();
  const ready =
    !!m.name.trim() &&
    !recording &&
    (m.kind === 'keystroke' ? !!m.combo : m.kind === 'multikey' ? m.steps.length > 0 : m.kind === 'launcher' ? !!m.app : !textEmpty);
  const canTry = (m.kind === 'multikey' && m.steps.length > 0) || (m.kind === 'text' && !textEmpty);

  return (
    <div className="mp mp-editor">
      <div className="mp-head">
        <button type="button" className="mp-back" onClick={leave}>
          <Icon name="chevron-left" size={14} /> Macros
        </button>
        <span className="mp-state">{isNew ? 'New' : dirty ? 'Not saved' : 'Saved'}</span>
      </div>

      <ToggleButtonGroup
        aria-label="Macro type"
        value={m.kind}
        onChange={(v) => setKind(v as MacroKind)}
        options={(Object.keys(MACRO_KIND_LABEL) as MacroKind[]).map((k) => ({ label: MACRO_KIND_LABEL[k], value: k }))}
      />

      <div className="mp-field">
        <span className="mp-label">Macro name</span>
        <Input aria-label="Macro name" value={m.name} maxLength={MACRO_NAME_MAX} onChange={(e) => set({ name: e.target.value })} />
        <span className="mp-hint">Maximum {MACRO_NAME_MAX} characters</span>
      </div>

      {m.kind === 'keystroke' && (
        <div className="mp-field">
          <span className="mp-label">Key combination</span>
          <div className="mp-combo">
            <input
              className="ds-input"
              aria-label="Key combination"
              placeholder="Type a shortcut"
              readOnly
              value={m.combo}
              onKeyDown={(e) => {
                if (e.key === 'Tab') return;
                e.preventDefault();
                e.stopPropagation();
                set({ combo: comboOf(e) });
              }}
            />
            <button type="button" className="ds-btn sm ghost" onClick={() => set({ combo: '' })}>
              Clear
            </button>
          </div>
          <span className="mp-hint">Press the keys together. They are read, not run.</span>
        </div>
      )}

      {m.kind === 'launcher' && (
        <div className="mp-field">
          <span className="mp-label">Program</span>
          <select className="mp-select" aria-label="Program to open" value={m.app} onChange={(e) => set({ app: e.target.value })}>
            <option value="">Choose a program</option>
            {LAUNCH_APPS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {m.kind === 'text' && (
        <>
          <Textarea
            aria-label="Custom text"
            rows={4}
            placeholder="Custom text"
            value={m.text}
            error={textEmpty && (m.text.length > 0 || dirty) ? 'Custom text cannot be left blank.' : undefined}
            onChange={(e) => set({ text: e.target.value })}
          />
          <div className="mp-field">
            <span className="mp-label">Key modifier</span>
            <input
              className="ds-input"
              aria-label="Key modifier"
              placeholder="Enter a key"
              readOnly
              value={m.modifier}
              onKeyDown={(e) => {
                if (e.key === 'Tab') return;
                e.preventDefault();
                e.stopPropagation();
                set({ modifier: e.key === 'Backspace' || e.key === 'Delete' ? '' : keyName(e.key) });
              }}
            />
            <span className="mp-hint">The key that opens the game's chat before the text is typed.</span>
          </div>
        </>
      )}

      {m.kind === 'multikey' && (
        <>
          <div className="mp-record">
            <Button variant={recording ? 'accent' : 'default'} size="sm" onClick={() => setRecording((r) => !r)} aria-pressed={recording}>
              <span className={'mp-rec-dot' + (recording ? ' on' : '')} aria-hidden="true" />
              {recording ? 'Stop' : m.steps.length ? 'Record again' : 'Record'}
            </Button>
            {recording ? (
              <span className="mp-rec-note">Recording — press the keys in order. Keys go to the recorder, not the page.</span>
            ) : (
              m.steps.length > 0 && (
                <button type="button" className="ds-btn sm ghost" onClick={() => set({ steps: [] })}>
                  Clear steps
                </button>
              )
            )}
          </div>

          <ol className="mp-steps" aria-label="Steps">
            {m.steps.length === 0 && <li className="mp-step-empty">No steps yet.</li>}
            {m.steps.map((s, i) => (
              <li key={i} className={'mp-step ' + s.dir}>
                {i > 0 && <span className="mp-gap">{gapShown(s.gap)} ms</span>}
                <span className="mp-step-dir" aria-hidden="true">{s.dir === 'down' ? '↓' : '↑'}</span>
                <span className="mp-step-key">{s.key}</span>
                <button
                  type="button"
                  className="mp-step-del"
                  aria-label={`Remove step ${i + 1}`}
                  onClick={() => set({ steps: m.steps.filter((_, j) => j !== i) })}
                >
                  <Icon name="close" size={12} />
                </button>
              </li>
            ))}
          </ol>

          <div className="mp-field">
            <span className="mp-label">Delays</span>
            <ToggleButtonGroup
              aria-label="Delays between steps"
              value={m.timing}
              onChange={(v) => set({ timing: v as MacroTiming })}
              options={[
                { label: 'As recorded', value: 'recorded' },
                { label: `Fixed ${m.fixedMs} ms`, value: 'fixed' },
                { label: 'None', value: 'none' },
              ]}
            />
          </div>
          <div className="mp-field">
            <span className="mp-label">Plays</span>
            <ToggleButtonGroup
              aria-label="How the macro plays"
              value={m.play}
              onChange={(v) => set({ play: v as MacroPlay })}
              options={(Object.keys(PLAY_LABEL) as MacroPlay[]).map((p) => ({ label: PLAY_LABEL[p], value: p }))}
            />
            {m.play === 'repeat' && (
              <label className="mp-repeat">
                <input
                  type="number"
                  min={2}
                  max={99}
                  value={m.repeat}
                  onChange={(e) => set({ repeat: Math.max(2, Math.min(99, Number(e.target.value) || 2)) })}
                />
                times
              </label>
            )}
          </div>
        </>
      )}

      {(m.kind === 'multikey' || m.kind === 'text') && (
        <div className="mp-field mp-test">
          <span className="mp-label">Try it</span>
          <textarea className="mp-out" aria-label="Test area" readOnly rows={3} value={out} placeholder="The macro types here, nowhere else." />
          <div className="mp-test-actions">
            {m.kind === 'multikey' && m.play === 'toggle' ? (
              <Button size="sm" disabled={!canTry || recording} aria-pressed={trying} onClick={trying ? stop : start}>
                {trying ? 'Turn off' : 'Turn on'}
              </Button>
            ) : m.kind === 'multikey' && m.play === 'held' ? (
              <button
                type="button"
                className="ds-btn sm"
                disabled={!canTry || recording}
                onPointerDown={start}
                onPointerUp={() => run.current?.release()}
                onPointerLeave={() => run.current?.release()}
                onKeyDown={(e) => e.key === ' ' && !e.repeat && start()}
                onKeyUp={(e) => e.key === ' ' && run.current?.release()}
              >
                Hold to play
              </button>
            ) : (
              <Button size="sm" disabled={!canTry || recording || trying} onClick={start}>
                Play
              </Button>
            )}
            <button type="button" className="ds-btn sm ghost" onClick={() => setOut('')}>
              Clear
            </button>
          </div>
        </div>
      )}

      {asking ? (
        <div className="mp-ask" role="alert">
          <span>Leave without saving? The changes to {m.name} are lost.</span>
          <button type="button" className="ds-btn sm" onClick={() => setAsking(false)}>
            Keep editing
          </button>
          <button type="button" className="ds-btn sm ghost" onClick={onClose}>
            Discard
          </button>
        </div>
      ) : (
        <div className="mp-actions">
          {!isNew && (
            <button type="button" className="ds-btn sm ghost mp-delete" onClick={() => onDelete(m.id)}>
              Delete
            </button>
          )}
          <button type="button" className="ds-btn sm" onClick={leave}>
            Cancel
          </button>
          <Button size="sm" variant="accent" disabled={!ready} onClick={() => onSave({ ...m, name: m.name.trim() })}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
