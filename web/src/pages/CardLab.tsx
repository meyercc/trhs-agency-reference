import { useEffect, useState } from 'react';
import { Badge, Button, Radio, Slider, Toggle, ToggleButtonGroup } from '../components';
import '../widgets/widgets.css';
import './card-lab.css';

// ── Card & Modal Lab — the scalability report, rendered in live components ──
// Each plate visualizes one chapter of docs/card-modal-scalability-report.md.
// Specimens compose the real design system; captions carry the law and its
// § reference. Nothing here is a new DS surface — .clab-* is annotation chrome.

const Spark = ({ color = 'var(--accent-color)', dim = false }: { color?: string; dim?: boolean }) => (
  <svg viewBox="0 0 100 22" fill="none" preserveAspectRatio="none" style={{ width: '100%', height: 22, opacity: dim ? 0.45 : 1 }} aria-hidden="true">
    <path d="M0,17 L12,13 L24,15 L36,9 L48,11 L60,6 L72,9 L84,4 L100,6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M0,17 L12,13 L24,15 L36,9 L48,11 L60,6 L72,9 L84,4 L100,6 L100,22 L0,22Z" fill="var(--accent-dimmest)" />
  </svg>
);

// Sparkline with a GAP — sleep/dropout renders as absence, never interpolation (§5.2).
const GapSpark = () => (
  <svg viewBox="0 0 100 22" fill="none" preserveAspectRatio="none" style={{ width: '100%', height: 22 }} aria-hidden="true">
    <path d="M0,15 L14,11 L28,13 L40,8" stroke="var(--accent-color)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M64,10 L78,6 L90,9 L100,5" stroke="var(--accent-color)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="46" y1="4" x2="58" y2="18" stroke="var(--border-light)" strokeWidth="1" />
  </svg>
);

type Verb = 'signed' | 'managed' | 'driven' | 'armed' | 'locked' | 'gated';

const VERB_OPTIONS = (['signed', 'managed', 'driven', 'armed', 'locked', 'gated'] as Verb[]).map((v) => ({ label: v, value: v }));

function GovernanceRendering({ verb }: { verb: Verb }) {
  switch (verb) {
    case 'signed':
      return (
        <div className="clab-slot-row">
          <Badge variant="omen-ai">Set by OMEN AI</Badge>
          <span className="clab-meta">for Cyberpunk 2077 · </span>
          <Button variant="ghost" size="sm">Revert</Button>
        </div>
      );
    case 'managed':
      return (
        <div className="clab-strip">
          <span>Managed by SignalRGB</span>
          <span className="spacer" />
          <Button variant="ghost" size="sm">Release</Button>
        </div>
      );
    case 'driven':
      return (
        <div className="clab-slot-row">
          <Badge variant="status" tone="info">Following Valorant profile</Badge>
          <span className="clab-meta">auto-switched at launch</span>
        </div>
      );
    case 'armed':
      return (
        <div className="clab-slot-row">
          <Badge variant="status" tone="warn">Smart Sense will take fan control at game launch</Badge>
        </div>
      );
    case 'locked':
      return (
        <div className="clab-slot-row">
          <Badge variant="status">Locked by OEM</Badge>
          <span className="clab-meta">control stays visible — inert, never hidden</span>
        </div>
      );
    case 'gated':
      return (
        <div className="clab-slot-row">
          <Badge variant="status" tone="danger">Advanced tuning — requires opt-in</Badge>
          <span className="clab-meta">gate lives inside the modal</span>
        </div>
      );
  }
}

function StateSpecimen({ kind }: { kind: string }) {
  const head = (
    <div className="clab-slot-row" style={{ justifyContent: 'space-between' }}>
      <span className="wg-sub" style={{ margin: 0 }}>CPU</span>
      <span className="clab-ai-dot" aria-hidden="true" />
    </div>
  );
  switch (kind) {
    case 'ready':
      return (
        <div className="clab-card clab-state">
          {head}
          <div className="clab-slot-row"><span className="wg-stat wg-stat-md">72°</span><span className="wg-unit">C</span><span className="clab-health-dot" /></div>
          <Spark />
          <span className="clab-meta">updated 2s ago</span>
        </div>
      );
    case 'loading':
      return (
        <div className="clab-card clab-state" aria-label="loading specimen">
          {head}
          <div className="clab-skel" style={{ width: '55%', height: 22 }} />
          <div className="clab-skel" style={{ height: 22 }} />
          <div className="clab-skel" style={{ width: '40%' }} />
        </div>
      );
    case 'no-signal':
      return (
        <div className="clab-card clab-state">
          {head}
          <div className="clab-slot-row"><span className="wg-stat wg-stat-md">—</span><span className="wg-unit">no signal</span></div>
          <Spark dim />
          <span className="clab-meta">self-retrying · no CTA on read-only telemetry</span>
        </div>
      );
    case 'stale':
      return (
        <div className="clab-card clab-state">
          {head}
          <div className="clab-slot-row clab-dim"><span className="wg-stat wg-stat-md">72°</span><span className="wg-unit">C</span></div>
          <GapSpark />
          <span className="clab-meta">as of 42s ago · motion frozen</span>
        </div>
      );
    case 'disconnected':
      return (
        <div className="clab-card clab-state">
          {head}
          <div className="clab-slot-row clab-dim"><span className="wg-stat wg-stat-md">64°</span><span className="wg-unit">last known</span></div>
          <div className="clab-slot-row">
            <Toggle checked={false} onChange={() => {}} disabled aria-label="disabled write control" />
            <span className="clab-meta">writes inert · reads persist</span>
          </div>
          <span className="clab-meta">last seen 3m ago</span>
        </div>
      );
    case 'empty':
      return (
        <div className="clab-card clab-state clab-ghost">
          {head}
          <span className="clab-meta">No HyperX headset paired — ghost preview keeps the slot meaningful</span>
          <Button variant="ghost" size="sm">Add device</Button>
        </div>
      );
    default:
      return (
        <div className="clab-card clab-state">
          {head}
          <div className="clab-slot-row"><span className="wg-stat wg-stat-md">72°</span><span className="wg-unit">C</span></div>
          <div className="clab-error-row">⚠ Telemetry service stopped</div>
          <Button variant="ghost" size="sm">Restart service</Button>
        </div>
      );
  }
}

function RevertCountdown() {
  const [t, setT] = useState(15);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => (v <= 1 ? 15 : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <Button variant="accent" size="sm">Keep settings ({t}s)</Button>;
}

export function CardLab() {
  const [verb, setVerb] = useState<Verb>('signed');
  const [preset, setPreset] = useState('aurora');
  const [spg, setSpg] = useState(true);

  return (
    <div>
      <h1 className="page-title">Card &amp; Modal Lab</h1>
      <p className="page-sub">
        The scalability report, rendered in live components — each plate is one chapter of
        docs/card-modal-scalability-report.md. Specimens are real DS parts; captions carry the law.
      </p>

      {/* ── P1 · Anatomy ── */}
      <section className="clab-plate">
        <h2>P1 · The slot contract <span className="clab-ref">§1</span></h2>
        <p className="clab-cap">
          <b>One anatomy, four configurations.</b> A card kind is a switch matrix over one slot vocabulary.
          Dashed frames are slot boundaries; top-right always holds card-object verbs; footer:meta is the
          home of freshness stamps and signatures; a value block requires unit + qualifier — a bare number
          is a schema error.
        </p>
        <div className="clab-card clab-anatomy">
          <div className="clab-slot" data-slot="header">
            <div className="clab-slot-row">
              <span className="clab-ai-dot" aria-hidden="true" title="sourceMark" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>Fan Control</span>
              <span className="clab-mini-glyph" aria-hidden="true">⋯</span>
            </div>
          </div>
          <div className="clab-slot" data-slot="governanceStrip">
            <Badge variant="omen-ai">Set by OMEN AI</Badge>
          </div>
          <div className="clab-slot" data-slot="glance">
            <div className="clab-slot-row">
              <span className="wg-stat wg-stat-md">1840</span>
              <span className="wg-unit">RPM · rear</span>
              <span className="clab-health-dot" aria-hidden="true" />
            </div>
          </div>
          <div className="clab-slot" data-slot="keyControl (L2)">
            <ToggleButtonGroup
              options={[{ label: 'Auto', value: 'auto' }, { label: 'Max', value: 'max' }]}
              value="auto"
              onChange={() => {}}
              aria-label="Fan mode"
            />
          </div>
          <div className="clab-slot" data-slot="footer:meta">
            <span className="clab-meta">updated 2m ago · signed: omen_ai</span>
          </div>
        </div>
      </section>

      {/* ── P2 · Interaction archetypes ── */}
      <section className="clab-plate">
        <h2>P2 · Interaction archetypes <span className="clab-ref">§2</span></h2>
        <p className="clab-cap">
          <b>Interaction is an enum, not a vibe.</b> Whole-card click and on-face controls never coexist
          (except across a visible seam); a click that writes is never a click that opens; affordances
          derive from the archetype — try hovering each card.
        </p>
        <div className="clab-row">
          <div className="clab-mini inert">
            <span className="clab-arch-tag">inert</span>
            <span>5.6 GHz boost · 72°C</span>
            <span className="clab-arch-note">Display only — text stays selectable (the right form for telemetry)</span>
          </div>
          <button type="button" className="clab-mini navigate" aria-label="Game Library — opens page">
            <span className="clab-arch-tag">navigate</span>
            <span className="clab-slot-row">Game Library <span className="clab-mini-glyph">›</span></span>
            <span className="clab-arch-note">Whole card = one link to a page; card-level hover</span>
          </button>
          <button type="button" className="clab-mini launcher" aria-label="Cloud III — opens device modal">
            <span className="clab-arch-tag">launcher</span>
            <span className="clab-slot-row">Cloud III · 80% <span className="clab-mini-glyph">⤢</span></span>
            <span className="clab-arch-note">Whole card = one button to the canonical modal</span>
          </button>
          <div className="clab-mini" role="radiogroup" aria-label="Preset picker specimen">
            <span className="clab-arch-tag">selection</span>
            <Radio name="clab-preset" checked={preset === 'aurora'} onChange={() => setPreset('aurora')} label="Aurora" />
            <Radio name="clab-preset" checked={preset === 'ember'} onChange={() => setPreset('ember')} label="Ember" />
            <span className="clab-arch-note">Real radio semantics; the selection color is never AI purple</span>
          </div>
          <div className="clab-mini console">
            <span className="clab-arch-tag">console</span>
            <div className="clab-slot-row">
              <span style={{ flex: 1 }}>Smart Perf Gain</span>
              <Toggle checked={spg} onChange={setSpg} aria-label="Smart Performance Gain" />
            </div>
            <span className="clab-arch-note">Surface inert, controls are the targets; the door is explicit ↗</span>
          </div>
          <div className="clab-mini console">
            <div className="clab-hybrid-head" role="button" tabIndex={0} aria-label="Lighting — header opens modal">
              <span className="clab-arch-tag">hybrid-header</span>
              <span className="clab-mini-glyph">›</span>
            </div>
            <div className="clab-seam" aria-hidden="true" />
            <Slider value={64} onChange={() => {}} aria-label="Brightness" />
            <span className="clab-arch-note">Header navigates + control band, with a visible seam between</span>
          </div>
        </div>
      </section>

      {/* ── P3 · Label grammar ── */}
      <section className="clab-plate">
        <h2>P3 · The label grammar <span className="clab-ref">§3</span></h2>
        <p className="clab-cap">
          <b>Every "someone else did this" is one sentence: [scope][verb][agent].</b> Switch the verb to see
          six statements on one card — the agent is always named, and the label is a door, not a sticker
          (opening it must answer: who wrote this · what else do they hold · how do I take it back).
        </p>
        <ToggleButtonGroup options={VERB_OPTIONS} value={verb} onChange={(v) => setVerb(v as Verb)} aria-label="Label verb" />
        <div className="clab-card" style={{ maxWidth: 420 }}>
          <div className="clab-slot-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>Fan Control</span>
            <span className="clab-mini-glyph">⋯</span>
          </div>
          <GovernanceRendering verb={verb} />
          <Slider value={62} onChange={() => {}} disabled={verb === 'locked' || verb === 'managed'} aria-label="Fan curve aggressiveness" />
          <span className="clab-meta">history: Smart Sense 3:41pm → you 3:44pm</span>
        </div>
        <p className="clab-cap">
          <b>Write scope picks the rendering, never drama</b> — one control written = chip; a domain held = strip;
          every control agent-owned = scrim (the release affordance always visible):
        </p>
        <div className="clab-row">
          <div className="clab-card" style={{ width: 200 }}>
            <span className="clab-arch-tag">1 · control chip</span>
            <div className="clab-slot-row"><span style={{ flex: 1, fontSize: 'var(--text-caption)' }}>Fan curve</span><Badge variant="omen-ai">✦</Badge></div>
          </div>
          <div className="clab-card" style={{ width: 240 }}>
            <span className="clab-arch-tag">2 · card strip</span>
            <div className="clab-strip"><span>Managed by SignalRGB</span></div>
          </div>
          <div className="clab-card clab-scrim-host" style={{ width: 240, minHeight: 96 }}>
            <span className="clab-arch-tag">3 · full scrim</span>
            <div className="clab-slot-row"><span className="wg-stat wg-stat-md">—</span></div>
            <div className="clab-scrim">
              <span className="clab-meta">Every control agent-owned</span>
              <Button variant="ghost" size="sm">Release</Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── P4 · States ── */}
      <section className="clab-plate">
        <h2>P4 · The state lifecycle <span className="clab-ref">§4</span></h2>
        <p className="clab-cap">
          <b>Seven states, one footprint — data lifecycle never changes card dimensions</b> (every card below is
          the same size). Empty ≠ error ≠ no-signal; "Retry" is banned on read-only telemetry; on disconnect
          writes go inert while reads persist; stale dims the value, freezes motion, and draws gaps.
        </p>
        <div className="clab-row">
          {['ready', 'loading', 'no-signal', 'stale', 'disconnected', 'empty', 'error'].map((k) => (
            <div key={k}>
              <StateSpecimen kind={k} />
              <div className="clab-size-label">{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── P5 · Size ladder ── */}
      <section className="clab-plate">
        <h2>P5 · The size ladder <span className="clab-ref">§5–6</span></h2>
        <p className="clab-cap">
          <b>Below a threshold, swap the representation — never shrink it</b>: dot → value+trend →
          value+sparkline → full chart. Every size is a designed state; the <b>never-drop set</b>
          (health color + purple attribution dot) survives to the smallest size — dropping the signature
          there would under-report coupling exactly where users glance fastest.
        </p>
        <div className="clab-row" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="clab-card clab-size s clab-rel">
              <div className="clab-corner"><span className="clab-ai-dot" /></div>
              <div className="clab-slot-row" style={{ marginTop: 'var(--gutter-sm)' }}>
                <span className="wg-stat wg-stat-md">72°</span>
                <span className="clab-health-dot" />
              </div>
            </div>
            <div className="clab-size-label">S · T1 + fixtures</div>
          </div>
          <div>
            <div className="clab-card clab-size m clab-rel">
              <div className="clab-corner"><span className="clab-ai-dot" /></div>
              <span className="wg-sub" style={{ margin: 0 }}>CPU</span>
              <div className="clab-slot-row">
                <span className="wg-stat wg-stat-md">72°</span>
                <span className="wg-unit">C ↑</span>
                <span className="clab-health-dot" />
              </div>
            </div>
            <div className="clab-size-label">M · value + trend</div>
          </div>
          <div>
            <div className="clab-card clab-size l clab-rel">
              <div className="clab-corner"><span className="clab-ai-dot" /></div>
              <span className="wg-sub" style={{ margin: 0 }}>CPU</span>
              <div className="clab-slot-row">
                <span className="wg-stat wg-stat-md">72°</span>
                <span className="wg-unit">C · 5.6 GHz</span>
                <span className="clab-health-dot" />
              </div>
              <Spark />
            </div>
            <div className="clab-size-label">L · + sparkline (60s)</div>
          </div>
          <div>
            <div className="clab-card clab-size xl clab-rel">
              <div className="clab-corner"><span className="clab-ai-dot" /></div>
              <span className="wg-sub" style={{ margin: 0 }}>CPU · full history</span>
              <div className="clab-slot-row">
                <span className="wg-stat wg-stat-md">72°</span>
                <span className="wg-unit">C</span>
                <span className="clab-health-dot" />
                <span className="clab-meta" style={{ marginLeft: 'auto' }}>load 25% · 5.6 GHz · 64W</span>
              </div>
              <Spark />
              <Spark color="var(--orange)" />
            </div>
            <div className="clab-size-label">XL · full chart + secondary metrics</div>
          </div>
        </div>
      </section>

      {/* ── P6 · Commit models ── */}
      <section className="clab-plate">
        <h2>P6 · Commit semantics — the footer is the signature <span className="clab-ref">§9</span></h2>
        <p className="clab-cap">
          <b>Chosen per risk, never per taste.</b> The footer is generated from the commit model — users learn
          to read the footer to know what closing means. A Cancel button on an instant-apply surface is a
          lie; a non-revertible operation must say Stop.
        </p>
        <div className="clab-footers">
          <div className="clab-footer">
            <span className="clab-footer-label">instant</span>
            <span className="clab-footer-note">Frequent, low-risk, independently valid — L2/L3 face controls</span>
            <div className="clab-footer-actions"><Button variant="ghost" size="sm">Reset</Button><Button variant="ghost" size="sm">Close</Button></div>
          </div>
          <div className="clab-footer">
            <span className="clab-footer-label">select-commit</span>
            <span className="clab-footer-note">Single-choice pickers: selecting commits and closes — preset popovers</span>
          </div>
          <div className="clab-footer">
            <span className="clab-footer-label">explicit</span>
            <span className="clab-footer-note">Lands as an atomic set — EQ curves / fan curves / per-key maps</span>
            <div className="clab-footer-actions"><Button variant="ghost" size="sm">Cancel</Button><Button variant="accent" size="sm">Apply</Button></div>
          </div>
          <div className="clab-footer">
            <span className="clab-footer-label">preview-write</span>
            <span className="clab-footer-note">Streaming preview to device… attribution signs the session (snapshot → Apply/restore)</span>
            <div className="clab-footer-actions"><Button variant="ghost" size="sm">Hold to A/B</Button><Button variant="ghost" size="sm">Cancel</Button><Button variant="accent" size="sm">Apply</Button></div>
          </div>
          <div className="clab-footer">
            <span className="clab-footer-label">revert-timer</span>
            <span className="clab-footer-note">The write can destroy the ability to confirm it — firmware owns the countdown; reverts even if the app dies</span>
            <div className="clab-footer-actions"><Button variant="ghost" size="sm">Revert now</Button><RevertCountdown /></div>
          </div>
          <div className="clab-footer">
            <span className="clab-footer-label">staged-batch</span>
            <span className="clab-footer-note">3 devices will be written · keyboard ✓ mouse ✓ headset — itemized results; no clean signature over a half-applied set</span>
            <div className="clab-footer-actions"><Button variant="ghost" size="sm">Review</Button><Button variant="accent" size="sm">Apply to all</Button></div>
          </div>
        </div>
      </section>

      {/* ── P7 · Device vs Detail ── */}
      <section className="clab-plate">
        <h2>P7 · Device Modal vs Detail Modal <span className="clab-ref">§7.4</span></h2>
        <p className="clab-cap">
          <b>The one-line test: can this capability's writes be scoped to one device?</b> Yes → it is a section
          of that device's Device Modal; no → its own Detail Modal (left panel = the trust surface: status,
          benefits <b>and</b> considerations, attribution, vitals). One canonical console — the other side
          doors into it, never copies it.
        </p>
        <div className="clab-row">
          <div>
            <div className="clab-modal">
              <div className="clab-modal-hero">
                <span style={{ fontSize: 24 }} aria-hidden="true">⌨</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>Alloy Origins 65</div>
                  <Badge variant="status" tone="positive">Connected</Badge>
                </div>
              </div>
              <div className="clab-modal-body">
                <div className="clab-modal-row">Lighting <span className="clab-mini-glyph">›</span></div>
                <div className="clab-modal-row">Key assignments <span className="clab-mini-glyph">›</span></div>
                <div className="clab-modal-row">Onboard memory <span className="clab-mini-glyph">›</span></div>
                <div className="clab-modal-row clab-meta" style={{ borderTop: '1px solid var(--border-light)' }}>
                  Lighting sync (cross-device) → door-chains to its Detail Modal
                </div>
              </div>
            </div>
            <div className="clab-size-label">device modal · thing (hero top · multi-capability sections)</div>
          </div>
          <div>
            <div className="clab-modal clab-detail">
              <div className="clab-detail-left">
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>Lighting Sync</div>
                <Badge variant="status" tone="info">Active · 3 devices</Badge>
                <div className="clab-vitals"><span>KB · Aurora</span><span>Mouse · Aurora</span><span>Headset · Aurora</span></div>
                <div className="clab-consider">May override per-device lighting. Release any time.</div>
              </div>
              <div className="clab-modal-body">
                <div className="clab-modal-row"><span style={{ flex: 1 }}>Sync enabled</span><Toggle checked onChange={() => {}} aria-label="Sync enabled" /></div>
                <div className="clab-modal-row"><span style={{ flex: 1 }}>Brightness</span></div>
                <Slider value={70} onChange={() => {}} aria-label="Synced brightness" />
                <div className="clab-footer" style={{ border: 'none', padding: 0, background: 'transparent' }}>
                  <div className="clab-footer-actions"><Button variant="ghost" size="sm">Cancel</Button><Button variant="accent" size="sm">Apply</Button></div>
                </div>
              </div>
            </div>
            <div className="clab-size-label">detail modal · capability (trust panel left · console right)</div>
          </div>
        </div>
      </section>
    </div>
  );
}
