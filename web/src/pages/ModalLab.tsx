import { useState } from 'react';
import { Badge, Button, Slider, Toggle, ToggleButtonGroup } from '../components';
import '../widgets/widgets.css';
import './card-lab.css';
import './modal-lab.css';

// ── Modal Lab — the modal side, rendered live ───────────────────────────────
// Plates visualize docs/modal-registry.md + report Part II (§7–§10) and the
// constants / fact-triggered anatomy. .mlab-* is annotation chrome only —
// nothing here is a new DS surface.

const MODES = [
  { label: 'Eco', value: 'eco' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Perf', value: 'perf' },
  { label: 'Unleash', value: 'unleash' },
];

function TrustRow({ children }: { children: React.ReactNode }) {
  return <div className="mlab-row mlab-trust">⚠ {children}</div>;
}

/* M1 — four constants; every other piece appears only when its fact is true. */
function AnatomyPlate() {
  const [risky, setRisky] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const [l2, setL2] = useState(true);
  const [explicit, setExplicit] = useState(true);
  return (
    <section className="clab-plate">
      <h2>M1 · What a modal must have <span className="clab-ref">anatomy</span></h2>
      <p className="clab-cap">
        <b>Four constants; everything else is fact-triggered.</b> Identity, one exit, a declared
        commit contract, an inert backdrop — the whole mandatory list. Flip the facts and watch each
        piece earn its place. A permanent explanation panel never appears: no fact triggers one.
      </p>
      <div className="mlab-facts">
        <label><Toggle checked={risky} onChange={setRisky} aria-label="Risky write" /> risky write → trust content</label>
        <label><Toggle checked={grouped} onChange={setGrouped} aria-label="Many groups" /> &gt;3 groups → nav rail</label>
        <label><Toggle checked={l2} onChange={setL2} aria-label="Parent L2 control" /> parent L2 → header controls</label>
        <label><Toggle checked={explicit} onChange={setExplicit} aria-label="Explicit commit" /> explicit commit → Apply footer</label>
      </div>
      <div className="mlab-backdrop">
        <div className="mlab-modal">
          <div className="mlab-header">
            <div>
              <div className="mlab-title">Advanced Tuning</div>
              <span className="clab-meta">lives in Unleash Mode · Power Mode — a label, not a back button</span>
            </div>
            {l2 && (
              <div className="mlab-l2">
                <ToggleButtonGroup options={MODES} value="unleash" onChange={() => {}} aria-label="Power mode" />
              </div>
            )}
            <button type="button" className="mlab-x" aria-label="Close">×</button>
          </div>
          <div className="mlab-body">
            {grouped && (
              <nav className="mlab-rail" aria-label="Domains">
                <span className="active">CPU</span><span>GPU</span><span>Memory</span><span>Thermal</span><span>Power</span>
              </nav>
            )}
            <div className="mlab-console">
              <div className="mlab-row">
                <span>Mode</span>
                <ToggleButtonGroup
                  options={[{ label: 'Auto', value: 'auto' }, { label: 'Manual', value: 'manual' }]}
                  value="manual"
                  onChange={() => {}}
                  aria-label="Mode"
                />
              </div>
              <div className="mlab-row"><span>Power limit</span><span className="mlab-val">125 W</span></div>
              {risky && <TrustRow>Improper configuration may pose risks to VRM, battery, or CPU longevity.</TrustRow>}
            </div>
          </div>
          {explicit && (
            <div className="mlab-footer">
              <Button variant="ghost" size="sm">Reset to Default</Button>
              <Button size="sm">Apply</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* M2 — the left panel on trial: same modal, with the panel vs dissolved. */
function PanelPlate() {
  const [variant, setVariant] = useState('dissolved');
  const [hint, setHint] = useState(true);
  return (
    <section className="clab-plate">
      <h2>M2 · The left panel, on trial <span className="clab-ref">amends P5 geometry</span></h2>
      <p className="clab-cap">
        <b>Three jobs, three better homes.</b> Identity → the header. Warnings → the row that carries
        the risk (structural — P5&apos;s intent survives the move). Education → a first-run state,
        dismissible. Only the nav rail earns a left column, and only past ~3 groups.
      </p>
      <ToggleButtonGroup
        options={[{ label: 'with explanation panel', value: 'panel' }, { label: 'dissolved', value: 'dissolved' }]}
        value={variant}
        onChange={(v) => { setVariant(v); setHint(true); }}
        aria-label="Panel variant"
      />
      <div className="mlab-backdrop" style={{ marginTop: 'var(--gutter-sm)' }}>
        <div className="mlab-modal">
          <div className="mlab-header">
            <div>
              <div className="mlab-title">OMEN AI</div>
              <span className="clab-meta">lives in Performance</span>
            </div>
            <button type="button" className="mlab-x" aria-label="Close">×</button>
          </div>
          <div className="mlab-body">
            {variant === 'panel' && (
              <aside className="mlab-panel">
                <b>What is OMEN AI?</b>
                <p>Optimizes supported games; switches performance mode at game launch.</p>
                <p>Tip: add games to the list to tune them individually.</p>
                <p>May override manual tweaks.</p>
              </aside>
            )}
            <div className="mlab-console">
              {variant === 'dissolved' && hint && (
                <div className="mlab-row mlab-firstrun">
                  <span>First time here? OMEN AI switches modes at game launch.</span>
                  <button type="button" onClick={() => setHint(false)}>Got it</button>
                </div>
              )}
              <div className="mlab-row"><span>OMEN AI</span><Toggle checked onChange={() => {}} aria-label="OMEN AI" /></div>
              <div className="mlab-row"><span>Cyberpunk 2077</span><span className="mlab-val">Unleash · +18 FPS</span></div>
              <div className="mlab-row"><span>Valorant</span><span className="mlab-val">Performance</span></div>
              {variant === 'dissolved' && <TrustRow>May override manual tweaks — your changes sign back to you.</TrustRow>}
            </div>
          </div>
        </div>
      </div>
      <p className="clab-cap" style={{ marginTop: 'var(--gutter-sm)' }}>
        The panel spends ~30% of the surface on text that dies after the first read — and even its
        author&apos;s examples keep smuggling working content (the game list) into it. Decide the zone
        with its owner, not by decree.
      </p>
    </section>
  );
}

/* M3 — console row grammar; the dependent row dims live, never hides. */
function RowGrammarPlate() {
  const [mode, setMode] = useState('auto');
  const [boost, setBoost] = useState(true);
  const [pl, setPl] = useState(64);
  const auto = mode === 'auto';
  return (
    <section className="clab-plate">
      <h2>M3 · Console row grammar <span className="clab-ref">a row is a micro-card</span></h2>
      <p className="clab-cap">
        <b>label = title · value = readout · control = key control · chip = attribution.</b> Group by
        domain; the mode row is the firstborn; dependents dim + indent + say why — never hide; one
        indent level max — the second indent is a drill. Flip Auto/Manual and watch the dependent row.
      </p>
      <div className="mlab-console mlab-standalone">
        <div className="mlab-group">CPU</div>
        <div className="mlab-row">
          <span>Mode</span>
          <ToggleButtonGroup
            options={[{ label: 'Auto', value: 'auto' }, { label: 'Manual', value: 'manual' }]}
            value={mode}
            onChange={setMode}
            aria-label="CPU mode"
          />
        </div>
        <div className="mlab-row">
          <span>Power limit</span>
          <div className="mlab-slider"><Slider value={pl} onChange={setPl} aria-label="Power limit" /></div>
          <span className="mlab-val">{Math.round(64 + pl * 0.95)} W</span>
        </div>
        <div className="mlab-row">
          <span>Boost <Badge variant="omen-ai">OMEN AI</Badge></span>
          <Toggle checked={boost} onChange={setBoost} aria-label="Boost" />
        </div>
        <div className={`mlab-row mlab-dep${auto ? ' is-dim' : ''}`}>
          <span>Voltage offset{auto && <em className="clab-meta"> — managed by Auto mode · visible, never hidden</em>}</span>
          <span className="mlab-val">{auto ? '—' : '-25 mV'}</span>
        </div>
        <div className="mlab-row mlab-drill" role="button" tabIndex={0}>
          <span>Per-core tuning</span><span className="mlab-val">8 cores ▸</span>
        </div>
        <TrustRow>Improper configuration may pose risks to VRM, battery, or CPU longevity.</TrustRow>
      </div>
    </section>
  );
}

/* M4 — stacking: the editor is the elevation floor; one gate; Esc peels one layer. */
function StackPlate() {
  const [gate, setGate] = useState(true);
  return (
    <section className="clab-plate">
      <h2>M4 · Stacking — one gate, Esc peels one layer <span className="clab-ref">R-M1…R-M4</span></h2>
      <p className="clab-cap">
        <b>An editor-scale modal is the elevation floor.</b> It may host exactly one gate
        (role=alertdialog); pickers host nothing; each layer fully inerts the one beneath — no
        half-modals; Esc closes one layer per press. All verified 3-0 against ARIA APG + Material.
      </p>
      <Button variant="ghost" size="sm" onClick={() => setGate(!gate)}>
        {gate ? 'dismiss the gate (what Esc would do)' : 'open the L4 gate'}
      </Button>
      <div className="mlab-backdrop" style={{ marginTop: 'var(--gutter-sm)' }}>
        <div className="mlab-modal">
          <div className="mlab-header">
            <div>
              <div className="mlab-title">Unleashed — Advanced Tuning</div>
              <span className="clab-meta">lives in Power Mode</span>
            </div>
            <button type="button" className="mlab-x" aria-label="Close">×</button>
          </div>
          <div className="mlab-body">
            <div className="mlab-console">
              <div className="mlab-row"><span>IccMax</span><span className="mlab-val">280 A</span></div>
              <div className="mlab-row"><span>PL4 ceiling</span><span className="mlab-val">210 W</span></div>
            </div>
          </div>
          {gate && (
            <div className="mlab-gatescrim">
              <div className="mlab-gate" role="alertdialog" aria-label="Risk gate">
                <b>Enter raw controls?</b>
                <p className="clab-meta">Improper configuration may pose risks to VRM, battery, or CPU longevity.</p>
                <div className="mlab-gate-actions">
                  <Button variant="ghost" size="sm" onClick={() => setGate(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => setGate(false)}>I understand</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* M5 — the registry: six live modals, two ghosts. */
const REGISTRY = [
  { name: 'SpecCanvas (long tail)', type: 'Device', tpl: 'device — maximized state', commit: 'stubs', esc: true, flags: ['no identity header'] },
  { name: 'DeviceCanvas (mouse)', type: 'Device', tpl: 'device — maximized state', commit: 'stubs', esc: true, flags: ['no identity header'] },
  { name: 'UnleashModal', type: 'Detail', tpl: 'feature (rail)', commit: 'explicit Apply', esc: true, flags: ['dead back ‹'] },
  { name: 'WidgetPicker', type: 'picker', tpl: 'simple', commit: 'immediate', esc: true, flags: [] },
  { name: 'Metro add-section', type: 'picker', tpl: 'simple', commit: 'immediate', esc: false, flags: ['no Esc', 'bespoke scrim'] },
  { name: 'Metro add-widget', type: 'picker', tpl: 'simple', commit: 'immediate', esc: false, flags: ['no Esc', 'duplicate impl'] },
];

function RegistryPlate() {
  return (
    <section className="clab-plate">
      <h2>M5 · The registry — who exists today <span className="clab-ref">docs/modal-registry.md</span></h2>
      <p className="clab-cap">
        <b>Six live modals, two ghosts.</b> Settings and onboarding are promised in the IA and absent
        in code — the first tenants to get templates assigned instead of improvised.
      </p>
      <div className="mlab-reg">
        <div className="mlab-reg-row mlab-reg-head">
          <span>modal</span><span>type</span><span>template</span><span>commit</span><span>Esc</span><span>flags</span>
        </div>
        {REGISTRY.map((m) => (
          <div className="mlab-reg-row" key={m.name}>
            <span>{m.name}</span>
            <span>{m.type}</span>
            <span>{m.tpl}</span>
            <span>{m.commit}</span>
            <span>{m.esc ? '✓' : <Badge variant="status" tone="danger">no</Badge>}</span>
            <span className="mlab-flags">
              {m.flags.length ? m.flags.map((f) => <Badge key={f} variant="status" tone="warn">{f}</Badge>) : '—'}
            </span>
          </div>
        ))}
        <div className="mlab-reg-row mlab-ghost">
          <span>Settings</span><span>—</span><span>feature?</span><span>—</span><span>—</span>
          <span>promised in the IA · no surface exists</span>
        </div>
        <div className="mlab-reg-row mlab-ghost">
          <span>Onboarding</span><span>—</span><span>simple wizard?</span><span>—</span><span>—</span>
          <span>promised in the IA · no surface exists</span>
        </div>
      </div>
    </section>
  );
}

export function ModalLab() {
  return (
    <div>
      <h1 className="page-title">Modal Lab</h1>
      <p className="page-sub">
        The modal side, rendered live — anatomy, the left-panel trial, console row grammar, stacking,
        and the registry. Sources: docs/modal-registry.md · scalability report Part II (§7–§10).
      </p>
      <AnatomyPlate />
      <PanelPlate />
      <RowGrammarPlate />
      <StackPlate />
      <RegistryPlate />
    </div>
  );
}
