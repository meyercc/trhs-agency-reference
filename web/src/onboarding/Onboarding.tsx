import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toggle, Icon, Input, type IconName } from '../components';
import { useSettings } from '../state/Settings';
import { useModules } from '../state/Modules';
import { MODULES, WIDGET_MODULE } from '../modules/registry';
import { META_BY_ID, DEVICE_WIDGET_SKU } from '../widgets/catalog';
import { deviceCardModel } from '../widgets/DeviceCard';
import { CONNECTED_DEVICE_IDS } from '../devices/connectedDevices';
import { HyperXLogo } from '../app/HyperXLogo';
import './onboarding.css';

type Motivation = 'enthusiast' | 'minimalist';
type Expertise = 'novice' | 'pro';
type StepId = 'welcome' | 'legal' | 'signin' | 'intent' | 'expertise' | 'devices' | 'modules' | 'build';

// Persona = motivation × expertise. The fork skips expertise for minimalists, so
// the 2×2 collapses to three. Persona is stored in Settings and curates defaults.
function personaOf(m: Motivation | null, e: Expertise | null): string {
  if (m === 'minimalist') return 'minimalist';
  if (m === 'enthusiast') return e === 'pro' ? 'tinkerer' : 'learner';
  return '';
}

// Which modules each persona seeds "on" in the selection step (minimalist gets none).
const PRESET: Record<string, Record<string, boolean>> = {
  tinkerer: { omenai: true, booster: true, vitals: true, cleaner: true, fancleaner: true, lightstudio: true, gallery: true, shop: false },
  learner: { omenai: true, booster: true, vitals: true, cleaner: false, fancleaner: false, lightstudio: true, gallery: false, shop: false },
  minimalist: { omenai: false, booster: false, vitals: false, cleaner: false, fancleaner: false, lightstudio: false, gallery: false, shop: false },
};
const presetFor = (persona: string): Record<string, boolean> =>
  PRESET[persona] ?? Object.fromEntries(MODULES.map((m) => [m.id, false]));

// ── Board seeding ────────────────────────────────────────────────────────────
// Connected SKU → its dashboard device widget, inverted from the board catalog
// so every device the onboarding offers has a card to seed (it used to list
// only three, silently dropping the keyboard and mic the user had toggled on).
const DEV_WIDGET: Record<string, string> = Object.fromEntries(
  Object.entries(DEVICE_WIDGET_SKU).map(([widget, sku]) => [sku, widget]),
);
// A module → the board widget(s) it contributes (mirror of WIDGET_MODULE).
const MOD_WIDGET: Record<string, string[]> = { omenai: ['omenai'], booster: ['booster'], vitals: ['vitals'], lightstudio: ['light'], shop: ['deals'] };

/**
 * Build the actual dashboard layout from the onboarding choices. Persona sets the
 * density (ungated base widgets), selected modules add their widgets, and the
 * devices toggled "on" add their cards. Written to `board-layout` so the board
 * renders exactly what she set up — not the generic default.
 */
function seedBoard(persona: string, mods: Record<string, boolean>, addDevice: Record<string, boolean>): { id: string; span: number; rows: number }[] {
  const devs = Object.entries(DEV_WIDGET).filter(([sku]) => addDevice[sku] !== false).map(([, w]) => w);
  const modWidgets = Object.entries(MOD_WIDGET).filter(([m]) => mods[m]).flatMap(([, w]) => w);

  let ids: string[];
  if (persona === 'minimalist') {
    ids = [...(devs.length ? devs : ['dev-headset']), 'profile'];
  } else if (persona === 'tinkerer') {
    ids = ['cpu-status', 'gpu-status', 'cpu', 'thermal', 'fanspeed', 'storage', 'power', 'profile', ...modWidgets, ...devs];
  } else {
    ids = ['power', 'profile', 'lastplayed', ...modWidgets, ...devs];
  }

  const seen = new Set<string>();
  return ids
    .filter((id) => {
      if (!META_BY_ID[id] || seen.has(id)) return false;
      const mod = WIDGET_MODULE[id];
      if (mod && !mods[mod]) return false; // never seed a widget whose module is off
      seen.add(id);
      return true;
    })
    .map((id) => ({ id, span: META_BY_ID[id].span, rows: META_BY_ID[id].rows }));
}

export function Onboarding() {
  const navigate = useNavigate();
  const { setPersona, setOnboarded } = useSettings();
  const { install, remove } = useModules();

  const [idx, setIdx] = useState(0);
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [expertise, setExpertise] = useState<Expertise | null>(null);
  const [eula, setEula] = useState(false);
  const [telemetry, setTelemetry] = useState(true);
  const [addDevice, setAddDevice] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONNECTED_DEVICE_IDS.map((id) => [id, true])),
  );
  const [modsOverride, setModsOverride] = useState<Record<string, boolean>>({});

  const persona = personaOf(motivation, expertise);
  const effectiveMods = useMemo(() => ({ ...presetFor(persona), ...modsOverride }), [persona, modsOverride]);

  const detected = useMemo(() => CONNECTED_DEVICE_IDS.map((id) => deviceCardModel(id)).filter(Boolean) as NonNullable<ReturnType<typeof deviceCardModel>>[], []);
  const primary = detected.find((d) => d.skuId === 'cloud-iii') ?? detected[0];

  // The step sequence depends on the intent fork.
  const steps = useMemo<StepId[]>(() => {
    const base: StepId[] = ['welcome', 'legal', 'signin', 'intent'];
    if (motivation === 'enthusiast') return [...base, 'expertise', 'devices', 'modules', 'build'];
    if (motivation === 'minimalist') return [...base, 'devices', 'build'];
    return base;
  }, [motivation]);
  const current = steps[Math.min(idx, steps.length - 1)];

  const next = () => setIdx((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIdx((i) => Math.max(i - 1, 0));

  const finish = () => {
    const p = persona || 'minimalist';
    MODULES.forEach((m) => (effectiveMods[m.id] ? install(m.id) : remove(m.id)));
    // Seed the real dashboard layout from her choices (persona density + selected
    // modules + added devices). The board reads `board-layout` on next mount.
    try {
      localStorage.setItem('board-layout', JSON.stringify(seedBoard(p, effectiveMods, addDevice)));
    } catch { /* ignore quota / private-mode */ }
    setPersona(p);
    setOnboarded(true);
    navigate('/');
  };
  const skip = () => {
    setOnboarded(true);
    navigate('/');
  };

  // The "building" step runs a short scripted install, then lands on the board.
  const buildItems = useMemo(
    () => [
      ...MODULES.filter((m) => effectiveMods[m.id]).map((m) => ({ icon: m.icon as IconName, label: m.name })),
      ...detected.filter((d) => addDevice[d.skuId]).map((d) => ({ icon: 'devices' as IconName, label: d.name })),
    ],
    [effectiveMods, addDevice, detected],
  );
  const [built, setBuilt] = useState(0);
  useEffect(() => {
    if (current !== 'build') return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setBuilt(buildItems.length);
      const t = setTimeout(finish, 400);
      return () => clearTimeout(t);
    }
    setBuilt(0);
    const per = Math.min(360, 2200 / Math.max(1, buildItems.length));
    const timers = buildItems.map((_, i) => setTimeout(() => setBuilt(i + 1), per * (i + 1)));
    const done = setTimeout(finish, per * buildItems.length + 700);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const stepNo = idx + 1;
  const stepTotal = steps.length;
  const canNext = current === 'legal' ? eula : true;

  return (
    <div className="onb">
      <div className="onb-frame">
        <header className="onb-top">
          <HyperXLogo />
          {current !== 'build' && (
            <button type="button" className="onb-skip" onClick={skip}>
              Skip setup
            </button>
          )}
        </header>

        {current !== 'build' && (
          <div className="onb-progress" aria-label={`Step ${stepNo} of ${stepTotal}`}>
            {steps.slice(0, -1).map((s, i) => (
              <span key={s} className={'onb-pip' + (i < idx ? ' done' : i === idx ? ' now' : '')} />
            ))}
          </div>
        )}

        <main className="onb-body">
          {current === 'welcome' && (
            <Step center>
              <div className="onb-hero-mark"><HyperXLogo /></div>
              <h1 className="onb-h1">Welcome to Treehouse</h1>
              <p className="onb-lede">
                Your command center for everything HyperX and OMEN.{' '}
                {primary && (
                  <>
                    We found your <strong>{primary.name}</strong>
                    {detected.length > 1 ? ` and ${detected.length - 1} other device${detected.length - 1 > 1 ? 's' : ''}` : ''}.
                  </>
                )}
              </p>
              {primary?.image && <div className="onb-hero-photo" style={{ backgroundImage: `url(${primary.image})` }} />}
            </Step>
          )}

          {current === 'legal' && (
            <Step title="Terms & privacy" sub="A little housekeeping before we set up your space.">
              <div className="onb-eula" tabIndex={0} aria-label="End User License Agreement">
                <p>This End User License Agreement governs your use of Treehouse. By accepting, you agree to the terms of service and acknowledge the privacy policy. Treehouse manages your connected HyperX and OMEN devices, their settings, and optional performance features.</p>
                <p>You may withdraw optional data sharing at any time in Settings. Required device functionality does not depend on data sharing.</p>
              </div>
              <label className="onb-consent">
                <Toggle checked={eula} onChange={setEula} aria-label="Accept the End User License Agreement" />
                <span>I accept the <a href="#eula" onClick={(e) => e.preventDefault()}>End User License Agreement</a> <em>(required)</em></span>
              </label>
              <label className="onb-consent">
                <Toggle checked={telemetry} onChange={setTelemetry} aria-label="Share anonymous usage data" />
                <span>Share anonymous usage data to help improve Treehouse <em>(optional)</em></span>
              </label>
            </Step>
          )}

          {current === 'signin' && (
            <Step title="Sign in with HP ID" sub="Sync your setup across devices — or skip and stay local.">
              <div className="onb-form">
                <Input placeholder="Email" aria-label="Email" />
                <Input type="password" placeholder="Password" aria-label="Password" />
                <Button variant="accent" onClick={next}>Sign in</Button>
                <button type="button" className="onb-link">Create an HP ID</button>
              </div>
              <p className="onb-restore"><Icon name="info" size={13} /> Returning? Signing in restores your modules, layout, and device settings.</p>
            </Step>
          )}

          {current === 'intent' && (
            <Step title="What brings you here?" sub="This tailors how much Treehouse sets up for you — you can change it later.">
              <div className="onb-choices">
                <ChoiceCard
                  icon="performance"
                  title="Master my whole setup"
                  body="I want to monitor, tune, and personalize everything — and get better at gaming."
                  selected={motivation === 'enthusiast'}
                  onClick={() => { setMotivation('enthusiast'); setIdx((i) => i + 1); }}
                />
                <ChoiceCard
                  icon="devices"
                  title="Just manage my device"
                  body="I bought a HyperX device and mainly want to control that. Keep it simple."
                  selected={motivation === 'minimalist'}
                  onClick={() => { setMotivation('minimalist'); setExpertise(null); setIdx((i) => i + 1); }}
                />
              </div>
            </Step>
          )}

          {current === 'expertise' && (
            <Step title="How hands-on do you want to be?" sub="So we show the right level of control from the start.">
              <div className="onb-choices">
                <ChoiceCard
                  icon="ai"
                  title="Guide me"
                  body="Keep it approachable. Let OMEN AI and automation do the heavy lifting."
                  selected={expertise === 'novice'}
                  onClick={() => { setExpertise('novice'); setIdx((i) => i + 1); }}
                />
                <ChoiceCard
                  icon="settings"
                  title="I've got this"
                  body="Give me the dials. I want manual control and the advanced surfaces."
                  selected={expertise === 'pro'}
                  onClick={() => { setExpertise('pro'); setIdx((i) => i + 1); }}
                />
              </div>
            </Step>
          )}

          {current === 'devices' && (
            <Step title="Your devices" sub="We detected these. They're ready to add to your dashboard.">
              <div className="onb-devices">
                {detected.map((d) => (
                  <div key={d.skuId} className="onb-device">
                    {d.image ? <div className="onb-device-img" style={{ backgroundImage: `url(${d.image})` }} /> : <Icon name="devices" size={22} />}
                    <div className="onb-device-meta">
                      <div className="onb-device-name">{d.name}</div>
                      <div className="onb-device-sub">{d.subtitle}</div>
                    </div>
                    <label className="onb-device-add">
                      <span>Add to dashboard</span>
                      <Toggle checked={addDevice[d.skuId] !== false} onChange={(v) => setAddDevice((a) => ({ ...a, [d.skuId]: v }))} aria-label={`Add ${d.name} to dashboard`} />
                    </label>
                  </div>
                ))}
              </div>
            </Step>
          )}

          {current === 'modules' && (
            <Step title="Choose your modules" sub="Picked for you from your answers and devices. Add or drop anything.">
              <ModuleGroup label="Recommended for you" ids={MODULES.filter((m) => effectiveMods[m.id]).map((m) => m.id)} mods={effectiveMods} onToggle={(id, v) => setModsOverride((o) => ({ ...o, [id]: v }))} />
              <ModuleGroup label="More modules" ids={MODULES.filter((m) => !effectiveMods[m.id]).map((m) => m.id)} mods={effectiveMods} onToggle={(id, v) => setModsOverride((o) => ({ ...o, [id]: v }))} />
            </Step>
          )}

          {current === 'build' && (
            <Step center>
              <h1 className="onb-h1">Building your dashboard…</h1>
              <p className="onb-lede">Setting up {persona === 'minimalist' ? 'your device' : `${buildItems.length} things`} the way you like it.</p>
              <div className="onb-build">
                {buildItems.map((it, i) => (
                  <div key={it.label + i} className={'onb-build-row' + (i < built ? ' in' : '')}>
                    <span className="onb-build-ic"><Icon name={it.icon} size={16} /></span>
                    <span className="onb-build-label">{it.label}</span>
                    <span className="onb-build-check">{i < built ? <Icon name="check" size={15} /> : <span className="onb-spin" />}</span>
                  </div>
                ))}
              </div>
              <div className="onb-buildbar"><span style={{ width: `${buildItems.length ? (built / buildItems.length) * 100 : 100}%` }} /></div>
            </Step>
          )}
        </main>

        {current !== 'build' && current !== 'intent' && current !== 'expertise' && (
          <footer className="onb-footer">
            {idx > 0 ? <Button variant="ghost" onClick={back}>Back</Button> : <span />}
            <Button variant="accent" onClick={next} disabled={!canNext}>
              {current === 'welcome' ? 'Get started' : current === 'signin' ? 'Skip for now' : current === 'modules' ? 'Build my dashboard' : current === 'devices' && motivation === 'minimalist' ? 'Finish' : 'Continue'}
            </Button>
          </footer>
        )}
        {(current === 'intent' || current === 'expertise') && idx > 0 && (
          <footer className="onb-footer">
            <Button variant="ghost" onClick={back}>Back</Button>
            <span />
          </footer>
        )}
      </div>
    </div>
  );
}

// ── little building blocks ───────────────────────────────────────────────────
function Step({ title, sub, center, children }: { title?: string; sub?: string; center?: boolean; children: ReactNode }) {
  return (
    <div className={'onb-step' + (center ? ' center' : '')}>
      {title && <h2 className="onb-h2">{title}</h2>}
      {sub && <p className="onb-sub">{sub}</p>}
      <div className="onb-step-body">{children}</div>
    </div>
  );
}

function ChoiceCard({ icon, title, body, selected, onClick }: { icon: IconName; title: string; body: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'onb-choice' + (selected ? ' selected' : '')} onClick={onClick} aria-pressed={selected}>
      <span className="onb-choice-ic"><Icon name={icon} size={22} /></span>
      <span className="onb-choice-title">{title}</span>
      <span className="onb-choice-body">{body}</span>
      <span className="onb-choice-go"><Icon name="chevron-right" size={16} /></span>
    </button>
  );
}

function ModuleGroup({ label, ids, mods, onToggle }: { label: string; ids: string[]; mods: Record<string, boolean>; onToggle: (id: string, v: boolean) => void }) {
  if (!ids.length) return null;
  return (
    <div className="onb-modgroup">
      <div className="onb-modgroup-label">{label}</div>
      {ids.map((id) => {
        const m = MODULES.find((x) => x.id === id);
        if (!m) return null;
        return (
          <div key={id} className="onb-mod">
            <span className="onb-mod-ic"><Icon name={m.icon} size={18} /></span>
            <span className="onb-mod-meta">
              <span className="onb-mod-name">{m.name}</span>
              <span className="onb-mod-tag">{m.tagline}</span>
            </span>
            <Toggle checked={mods[id] === true} onChange={(v) => onToggle(id, v)} aria-label={m.name} />
          </div>
        );
      })}
    </div>
  );
}
