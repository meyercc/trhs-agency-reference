import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Icon,
  Input,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  Textarea,
  Toggle,
  Slider,
} from '../components';
import { allSkus, resolveSku, type Sku, type Features } from '../devices/skus';
import { DeviceCanvas } from '../devices/DeviceCanvas';
import { KeyboardCanvas } from '../devices/KeyboardCanvas';
import { HeadsetCanvas } from '../devices/HeadsetCanvas';
import { MonitorCanvas } from '../devices/MonitorCanvas';
import { MicCanvas } from '../devices/MicCanvas';
// The colorway editor renders .reg-cw-dot swatches, whose colors live with the
// registry's swatch rules.
import './registry.css';
import './configurator.css';

/**
 * SKU Configurator — the React home of configurator/index.html for the five
 * canvas device types (mouse / keyboard / headset / monitor / microphone).
 * Left: identity + feature spec form. Right: the *actual* NG3 device canvas
 * rendered live from the draft spec (no iframe — the canvases render in a
 * scaled stage), plus save-to-registry / share-link / copy-JSON outputs.
 *
 * Semantics mirror the vanilla editor and the schema doc: a SKU only stores
 * what it overrides vs peripheral-defaults.json — a feature toggled off writes
 * `false`, toggled on deletes the key so the default inherits. Long-tail types
 * (notebook, desktop, components…) still edit in configurator/index.html.
 */

const TYPES = ['mouse', 'keyboard', 'headset', 'monitor', 'microphone'];
const STATUSES = ['in-design', 'engineering', 'shipping', 'eol'];
const CONNECTIVITY = ['wired', 'wireless', 'dual'];
const KB_LAYOUTS = ['60', '65', '75', 'tkl', 'full', '96', 'numpad'];
const SAVE_ENDPOINT = 'http://localhost:8081/save-sku';

/** A mouse button callout: which overlay slot on the hero, and what it says. */
interface Callout {
  slot: string;
  id: string;
  label: string;
}
/**
 * The six callout slots the mouse canvas hero can anchor to — left/right side,
 * top/middle/bottom. Order here is the order the canvas draws them.
 */
const CALLOUT_SLOTS: { slot: string; label: string; defaultId: string }[] = [
  { slot: 'lt', label: 'Mouse Left', defaultId: 'mouse-l' },
  { slot: 'lm', label: 'Mouse 5', defaultId: 'mouse-5' },
  { slot: 'lb', label: 'Mouse 4', defaultId: 'mouse-4' },
  { slot: 'rt', label: 'Mouse Right', defaultId: 'mouse-r' },
  { slot: 'rm', label: 'Mouse Middle', defaultId: 'mouse-m' },
  { slot: 'rb', label: 'DPI', defaultId: 'dpi' },
];

function blankFeatures(type: string): Features {
  switch (type) {
    case 'mouse':
      return {
        sensor: { dpi: { max: 26000 } },
        // A new mouse starts with the full standard callout set, like vanilla.
        buttons: { callouts: CALLOUT_SLOTS.map(({ slot, label, defaultId }) => ({ slot, id: defaultId, label })) },
        connectivity: 'wired',
      };
    case 'keyboard':
      return { keys: { layout: '65' }, connectivity: 'wired' };
    case 'headset':
      return { audio: {}, spatial: {}, connectivity: 'wireless' };
    case 'monitor':
      return { display: {}, color: {}, connectivity: {}, osd: {} };
    case 'microphone':
      return { audio: {}, effects: {}, lighting: {}, connectivity: 'wired' };
    default:
      return {};
  }
}

function blankSku(type: string): Sku {
  return { id: '', name: '', type, status: 'in-design', codenames: [], links: { figma: [] }, features: blankFeatures(type) };
}

// Strip empties so the saved spec stays minimal (mirrors vanilla cleanState).
function cleanSku(sku: Sku): Sku {
  const clone: any = JSON.parse(JSON.stringify({ $schema: 1, ...sku }));
  if (clone.links) {
    if (Array.isArray(clone.links.figma)) {
      clone.links.figma = clone.links.figma.filter((f: any) => f?.url?.trim());
      if (!clone.links.figma.length) delete clone.links.figma;
    }
    if (!clone.links.swpd) delete clone.links.swpd;
    if (!Object.keys(clone.links).length) delete clone.links;
  }
  if (Array.isArray(clone.codenames)) {
    clone.codenames = clone.codenames.filter((c: string) => c?.trim());
    if (!clone.codenames.length) delete clone.codenames;
  }
  if (!clone.notes) delete clone.notes;
  if (!Array.isArray(clone.colorways) || !clone.colorways.length) delete clone.colorways;
  return clone;
}

// ── tiny path helpers (features.audio.mic.presets …) ────────────────────────
function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = clone;
  for (const k of keys.slice(0, -1)) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete cur[last];
  else cur[last] = value;
  return clone;
}

const csv = (v: any): string => (Array.isArray(v) ? v.join(', ') : '');
const parseCsv = (s: string): string[] | undefined => {
  const arr = s.split(',').map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
};

export function Configurator() {
  const [params, setParams] = useSearchParams();
  const [sku, setSku] = useState<Sku>(() => blankSku('mouse'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const say = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  // ?edit=<id> loads an existing SKU (canvas types only).
  useEffect(() => {
    const id = params.get('edit');
    if (!id || id === editingId) return;
    const existing = allSkus.find((s) => s.id === id);
    if (existing && TYPES.includes(existing.type)) {
      // Merge features over the blanks: stored SKUs only carry overrides, so
      // form-driven baselines (connectivity, sensor…) must come from the blank.
      const blank = blankSku(existing.type);
      setSku(
        JSON.parse(
          JSON.stringify({ ...blank, ...existing, features: { ...blank.features, ...(existing.features ?? {}) } }),
        ),
      );
      setEditingId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const loadExisting = (id: string) => {
    if (!id) return startFresh(sku.type);
    const p = new URLSearchParams(params);
    p.set('edit', id);
    setParams(p, { replace: true });
  };
  const startFresh = (type: string) => {
    setSku(blankSku(type));
    setEditingId(null);
    const p = new URLSearchParams(params);
    p.delete('edit');
    setParams(p, { replace: true });
  };

  const patch = (partial: Partial<Sku>) => setSku((s) => ({ ...s, ...partial }));
  const setFeature = (path: string, value: any) =>
    setSku((s) => ({ ...s, features: setPath(s.features ?? {}, path, value) }));

  const f: Features = sku.features ?? {};
  const cleaned = useMemo(() => cleanSku(sku), [sku]);
  const resolved = useMemo(
    () => resolveSku({ ...cleaned, id: cleaned.id || 'draft', name: cleaned.name || 'Untitled SKU' }),
    [cleaned],
  );

  // ── outputs ──
  const copyJson = () => navigator.clipboard.writeText(JSON.stringify(cleaned, null, 2)).then(() => say('SKU JSON copied'));
  const copyShareLink = () => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(cleaned))));
    const url = `${location.origin}${location.pathname}#/?spec=${encodeURIComponent(b64)}`;
    navigator.clipboard.writeText(url).then(() => say('Share link copied (encoded — works without commit)'));
  };
  const save = async () => {
    if (!sku.id || !sku.name || !sku.type) return say('Need id, name, and type before saving');
    setSaving(true);
    try {
      const res = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: cleaned, originalId: editingId || undefined }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) return say(`Save failed: ${data.error || res.statusText}`);
      setEditingId(sku.id);
      // Writing skus.json invalidates the module Vite statically imported, so
      // it pushes a full reload. Pin ?edit=<id> first, or a newly *created* SKU
      // would come back as an empty form (nothing in the URL to reload from).
      const p = new URLSearchParams(params);
      p.set('edit', sku.id);
      setParams(p, { replace: true });
      say(`${data.action === 'created' ? 'Created' : 'Updated'} ${sku.id} — live in the registry`);
    } catch {
      say('Save server not running? From trhs/: npm run save');
    } finally {
      setSaving(false);
    }
  };

  // ── feature form helpers ──
  const FeatureBlock = ({
    fkey,
    name,
    desc,
    children,
  }: {
    fkey: string;
    name: string;
    desc: string;
    children?: React.ReactNode;
  }) => {
    const on = f[fkey] !== false;
    return (
      <Ng3Section className={'cfg-feature' + (on ? '' : ' cfg-off')}>
        <Ng3Row>
          <div className="cfg-feature-titles">
            <span className="cfg-feature-name">{name}</span>
            <span className="cfg-feature-desc">{desc}</span>
          </div>
          <Toggle checked={on} onChange={(v) => setFeature(fkey, v ? {} : false)} aria-label={name} />
        </Ng3Row>
        {on && children}
      </Ng3Section>
    );
  };

  /**
   * Mouse button callouts — the six overlay slots on the mouse canvas hero,
   * ported from the vanilla form's chip-slot rows. A slot is *claimed* (a
   * callout exists for it) or not; unclaimed rows show the defaults greyed out
   * so the available slots stay visible rather than being hidden.
   */
  const CalloutRows = () => {
    const callouts: Callout[] = Array.isArray(f.buttons?.callouts) ? f.buttons.callouts : [];
    const claimed = new Set(callouts.map((c) => c.slot));

    const write = (next: Callout[]) =>
      // Keep the canvas's slot order stable regardless of edit order.
      setFeature('buttons.callouts', CALLOUT_SLOTS.map((s) => next.find((c) => c.slot === s.slot)).filter(Boolean));

    const toggleSlot = (slot: string, on: boolean) => {
      const def = CALLOUT_SLOTS.find((s) => s.slot === slot)!;
      write(on ? [...callouts, { slot, id: def.defaultId, label: def.label }] : callouts.filter((c) => c.slot !== slot));
    };
    const edit = (slot: string, key: 'id' | 'label', value: string) =>
      write(callouts.map((c) => (c.slot === slot ? { ...c, [key]: value } : c)));

    return (
      <>
        <Ng3Label>Callouts</Ng3Label>
        {CALLOUT_SLOTS.map(({ slot, label, defaultId }) => {
          const on = claimed.has(slot);
          const c = callouts.find((x) => x.slot === slot);
          return (
            <div className={'cfg-callout-row' + (on ? '' : ' cfg-off')} key={slot}>
              <Checkbox
                checked={on}
                onChange={(e) => toggleSlot(slot, e.target.checked)}
                aria-label={`${label} callout (slot ${slot})`}
              />
              <span className="cfg-callout-slot">{slot}</span>
              <Input
                value={c?.id ?? ''}
                placeholder={defaultId}
                disabled={!on}
                aria-label={`${label} callout id`}
                onChange={(e) => edit(slot, 'id', e.target.value)}
              />
              <Input
                value={c?.label ?? ''}
                placeholder={label}
                disabled={!on}
                aria-label={`${label} callout label`}
                onChange={(e) => edit(slot, 'label', e.target.value)}
              />
            </div>
          );
        })}
      </>
    );
  };

  const SubToggle = ({ path, label }: { path: string; label: string }) => {
    const on = getPath(f, path) !== false;
    return (
      <Ng3Row>
        <span className="cfg-sub-label">{label}</span>
        <Toggle checked={on} onChange={(v) => setFeature(path, v ? undefined : false)} aria-label={label} />
      </Ng3Row>
    );
  };

  const connectivity = typeof f.connectivity === 'string' ? f.connectivity : 'wired';
  const power = f.power && typeof f.power === 'object' ? f.power : {};

  const canvas =
    sku.type === 'mouse' ? DeviceCanvas
    : sku.type === 'keyboard' ? KeyboardCanvas
    : sku.type === 'headset' ? HeadsetCanvas
    : sku.type === 'monitor' ? MonitorCanvas
    : MicCanvas;
  const CanvasCmp = canvas;

  return (
    <div className="cfg">
      <div className="reg-title-row">
        <div>
          <h1 className="ds-text-title-1 page-title">SKU Configurator</h1>
          <p className="ds-text-body page-sub">
            Spec a device against the shared schema — the preview is the real device experience, live.
          </p>
        </div>
        {editingId && (
          <div className="cfg-editing">
            <Badge variant="status" tone="info">Editing {editingId}</Badge>
            <Button size="sm" onClick={() => startFresh(sku.type)}>Start fresh</Button>
          </div>
        )}
      </div>

      <div className="cfg-cols">
        {/* ── Left: the spec form ── */}
        <div className="cfg-form">
          <Ng3Section>
            <Ng3Label strong>Load Existing</Ng3Label>
            <Dropdown
              aria-label="Load existing SKU"
              value={editingId ?? ''}
              onChange={loadExisting}
              options={[
                { label: '— Start blank —', value: '' },
                ...allSkus
                  .filter((s) => TYPES.includes(s.type))
                  .map((s) => ({ label: `${s.name} (${s.type})`, value: s.id })),
              ]}
            />
          </Ng3Section>

          <Ng3Section>
            <Ng3Label strong>Identity</Ng3Label>
            <div className="cfg-2col">
              <Ng3Field>
                <Ng3Label>Type</Ng3Label>
                <Dropdown
                  aria-label="Device type"
                  value={sku.type}
                  onChange={(t) => setSku((s) => ({ ...blankSku(t), name: s.name, id: s.id, status: s.status }))}
                  options={TYPES.map((t) => ({ label: t, value: t }))}
                />
              </Ng3Field>
              <Ng3Field>
                <Ng3Label>Status</Ng3Label>
                <Dropdown
                  aria-label="Status"
                  value={sku.status ?? 'in-design'}
                  onChange={(v) => patch({ status: v })}
                  options={STATUSES.map((s) => ({ label: s, value: s }))}
                />
              </Ng3Field>
            </div>
            <Ng3Field>
              <Ng3Label>Name</Ng3Label>
              <Input value={sku.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Pulsefire Haste 3" aria-label="Name" />
            </Ng3Field>
            <Ng3Field>
              <Ng3Label>ID</Ng3Label>
              <Input value={sku.id} onChange={(e) => patch({ id: e.target.value })} placeholder="pulsefire-haste-3" aria-label="ID" />
            </Ng3Field>
            <Ng3Field>
              <Ng3Label>Codenames (csv)</Ng3Label>
              <Input
                value={csv(sku.codenames)}
                onChange={(e) => patch({ codenames: parseCsv(e.target.value) ?? [] })}
                placeholder="PFH3"
                aria-label="Codenames"
              />
            </Ng3Field>
            <Ng3Field>
              <Ng3Label>Figma URL</Ng3Label>
              <Input
                value={sku.links?.figma?.[0]?.url ?? ''}
                onChange={(e) =>
                  patch({ links: { ...sku.links, figma: e.target.value ? [{ title: 'Design Handoff', url: e.target.value }] : [] } })
                }
                placeholder="https://figma.com/design/…"
                aria-label="Figma URL"
              />
            </Ng3Field>
            <Ng3Field>
              <Ng3Label>SWPD</Ng3Label>
              <Input
                value={sku.links?.swpd ?? ''}
                onChange={(e) => patch({ links: { ...sku.links, swpd: e.target.value } })}
                placeholder="PERIPH-000 or a link"
                aria-label="SWPD"
              />
            </Ng3Field>
            <Ng3Field>
              <Ng3Label>Notes</Ng3Label>
              <Textarea
                value={sku.notes ?? ''}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Freeform designer notes — never rendered into the UI"
                aria-label="Notes"
                rows={2}
              />
            </Ng3Field>
          </Ng3Section>

          {sku.type !== 'monitor' && (
            <Ng3Section>
              <Ng3Label strong>Connectivity</Ng3Label>
              <Ng3Field>
                <Ng3Label>Connection</Ng3Label>
                <Dropdown
                  aria-label="Connection"
                  value={connectivity}
                  onChange={(v) => setFeature('connectivity', v)}
                  options={CONNECTIVITY.map((c) => ({ label: c, value: c }))}
                />
              </Ng3Field>
              {connectivity !== 'wired' && (
                <>
                  <Ng3Row>
                    <span className="cfg-sub-label">Battery level</span>
                    <span className="dc-mono-val">{power.batteryLevel ?? 73}%</span>
                  </Ng3Row>
                  <Slider
                    min={0}
                    max={100}
                    value={power.batteryLevel ?? 73}
                    onChange={(v) => setFeature('power.batteryLevel', v)}
                    aria-label="Battery level"
                  />
                  <Ng3Row>
                    <span className="cfg-sub-label">Charging</span>
                    <Toggle checked={!!power.charging} onChange={(v) => setFeature('power.charging', v)} aria-label="Charging" />
                  </Ng3Row>
                </>
              )}
            </Ng3Section>
          )}

          <Ng3Section>
            <Ng3Label strong>Colorways</Ng3Label>
            {(sku.colorways ?? []).map((cw, i) => (
              <div className="cfg-cw-row" key={i}>
                <span className="reg-cw-dot" data-cw={cw.id} aria-hidden="true" />
                <Input value={cw.id} placeholder="id" aria-label={`Colorway ${i + 1} id`} onChange={(e) => {
                  const cws = [...(sku.colorways ?? [])];
                  cws[i] = { ...cws[i], id: e.target.value };
                  patch({ colorways: cws });
                }} />
                {/* The label is what the swatch's tooltip/aria-label reads in
                    the modal + registry; without it they fall back to the id. */}
                <Input value={cw.label ?? ''} placeholder="Label" aria-label={`Colorway ${i + 1} label`} onChange={(e) => {
                  const cws = [...(sku.colorways ?? [])];
                  cws[i] = { ...cws[i], label: e.target.value };
                  patch({ colorways: cws });
                }} />
                <Input value={cw.image} placeholder="file.webp" aria-label={`Colorway ${i + 1} image`} onChange={(e) => {
                  const cws = [...(sku.colorways ?? [])];
                  cws[i] = { ...cws[i], image: e.target.value };
                  patch({ colorways: cws });
                }} />
                <label className="cfg-cw-default">
                  <input
                    type="radio"
                    name="cfg-cw-default"
                    checked={!!cw.default}
                    onChange={() => patch({ colorways: (sku.colorways ?? []).map((c, j) => ({ ...c, default: j === i })) })}
                  />
                  default
                </label>
                <Button size="sm" aria-label="Remove colorway" onClick={() => patch({ colorways: (sku.colorways ?? []).filter((_, j) => j !== i) })}>
                  −
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              onClick={() => patch({ colorways: [...(sku.colorways ?? []), { id: 'black', label: 'Black', image: `${sku.id || 'sku'}-black.webp`, default: !(sku.colorways ?? []).length }] })}
            >
              <Icon name="add-small" size={14} /> Add colorway
            </Button>
          </Ng3Section>

          {/* ── Type features ── */}
          {sku.type === 'mouse' && (
            <>
              <FeatureBlock fkey="buttons" name="Buttons" desc="Remappable button assignments.">
                <CalloutRows />
              </FeatureBlock>
              <FeatureBlock fkey="sensor" name="Sensor" desc="DPI presets, polling, lift-off, angle.">
                <Ng3Field>
                  <Ng3Label>DPI max</Ng3Label>
                  <Input
                    inputMode="numeric"
                    value={String(getPath(f, 'sensor.dpi.max') ?? 26000)}
                    onChange={(e) => setFeature('sensor.dpi.max', parseInt(e.target.value, 10) || 26000)}
                    aria-label="DPI max"
                  />
                </Ng3Field>
                <Ng3Field>
                  <Ng3Label>DPI ticks (csv)</Ng3Label>
                  <Input
                    value={csv(getPath(f, 'sensor.dpi.ticks'))}
                    onChange={(e) => setFeature('sensor.dpi.ticks', parseCsv(e.target.value)?.map(Number).filter((n) => !isNaN(n)))}
                    placeholder="50, 400, 800, 1600, …"
                    aria-label="DPI ticks"
                  />
                </Ng3Field>
                <SubToggle path="sensor.liftOffDistance" label="Lift-off Distance" />
                <SubToggle path="sensor.angleAdjustment" label="Angle Adjustment" />
                <SubToggle path="sensor.angleSnapping" label="Angle Snapping" />
              </FeatureBlock>
              <FeatureBlock fkey="lighting" name="Lighting" desc="Scroll-wheel LED color editor." />
            </>
          )}

          {sku.type === 'keyboard' && (
            <>
              <FeatureBlock fkey="keys" name="Keys & Macros" desc="Key remapping, macros, layers.">
                <Ng3Field>
                  <Ng3Label>Layout</Ng3Label>
                  <Dropdown
                    aria-label="Layout"
                    value={String(getPath(f, 'keys.layout') ?? '65')}
                    onChange={(v) => setFeature('keys.layout', v)}
                    options={KB_LAYOUTS.map((l) => ({ label: l.toUpperCase(), value: l }))}
                  />
                </Ng3Field>
              </FeatureBlock>
              <FeatureBlock fkey="lighting" name="Lighting" desc="Per-key RGB editor with effects." />
            </>
          )}

          {sku.type === 'headset' && (
            <>
              <FeatureBlock fkey="audio" name="Audio" desc="Volume, mic, equalizer, mic presets/effects.">
                <SubToggle path="audio.equalizer" label="Equalizer" />
                <SubToggle path="audio.mic.presets" label="Mic Presets" />
                <SubToggle path="audio.mic.effects" label="Mic Effects" />
              </FeatureBlock>
              <FeatureBlock fkey="spatial" name="Spatial Audio" desc="Surround, experience, distance." />
              <FeatureBlock fkey="notifications" name="Notifications" desc="Voice / tone / silent." />
            </>
          )}

          {sku.type === 'monitor' && (
            <>
              <FeatureBlock fkey="display" name="Display" desc="Panel type, size, resolution, refresh.">
                <div className="cfg-2col">
                  <Ng3Field>
                    <Ng3Label>Size</Ng3Label>
                    <Input value={getPath(f, 'display.size') ?? ''} onChange={(e) => setFeature('display.size', e.target.value || undefined)} placeholder={'27"'} aria-label="Size" />
                  </Ng3Field>
                  <Ng3Field>
                    <Ng3Label>Panel</Ng3Label>
                    <Dropdown aria-label="Panel" value={getPath(f, 'display.panel') ?? 'IPS'} onChange={(v) => setFeature('display.panel', v)} options={['IPS', 'OLED', 'VA', 'TN'].map((p) => ({ label: p, value: p }))} />
                  </Ng3Field>
                  <Ng3Field>
                    <Ng3Label>Resolution</Ng3Label>
                    <Dropdown aria-label="Resolution" value={getPath(f, 'display.resolution') ?? 'QHD'} onChange={(v) => setFeature('display.resolution', v)} options={['FHD', 'QHD', 'UHD', '4K'].map((r) => ({ label: r, value: r }))} />
                  </Ng3Field>
                  <Ng3Field>
                    <Ng3Label>Refresh</Ng3Label>
                    <Dropdown aria-label="Refresh rate" value={String(getPath(f, 'display.refreshRate') ?? 240)} onChange={(v) => setFeature('display.refreshRate', Number(v))} options={[60, 144, 165, 240, 360, 480].map((r) => ({ label: `${r} Hz`, value: String(r) }))} />
                  </Ng3Field>
                </div>
                <Ng3Field>
                  <Ng3Label>Response time</Ng3Label>
                  <Input value={getPath(f, 'display.responseTime') ?? ''} onChange={(e) => setFeature('display.responseTime', e.target.value || undefined)} placeholder="0.5ms" aria-label="Response time" />
                </Ng3Field>
              </FeatureBlock>
              <FeatureBlock fkey="color" name="Color" desc="HDR support + color gamuts.">
                <SubToggle path="color.hdr" label="HDR" />
                <Ng3Field>
                  <Ng3Label>Gamuts (csv)</Ng3Label>
                  <Input value={csv(getPath(f, 'color.gamuts'))} onChange={(e) => setFeature('color.gamuts', parseCsv(e.target.value))} placeholder="sRGB, DCI-P3" aria-label="Gamuts" />
                </Ng3Field>
              </FeatureBlock>
              <FeatureBlock fkey="connectivity" name="Connectivity" desc="Video inputs, USB hub, KVM switch.">
                <Ng3Field>
                  <Ng3Label>Inputs (csv)</Ng3Label>
                  <Input value={csv(getPath(f, 'connectivity.inputs'))} onChange={(e) => setFeature('connectivity.inputs', parseCsv(e.target.value))} placeholder="HDMI 2.1, DisplayPort 1.4, USB-C" aria-label="Inputs" />
                </Ng3Field>
                <SubToggle path="connectivity.usbHub" label="USB Hub" />
                <SubToggle path="connectivity.kvm" label="KVM Switch" />
              </FeatureBlock>
              <FeatureBlock fkey="osd" name="OSD" desc="On-screen display: joystick, lock.">
                <SubToggle path="osd.joystick" label="Joystick" />
                <SubToggle path="osd.lockable" label="Lockable" />
              </FeatureBlock>
            </>
          )}

          {sku.type === 'microphone' && (
            <>
              <FeatureBlock fkey="audio" name="Audio" desc="Pickup pattern, gain, monitoring, tap-to-mute.">
                <Ng3Field>
                  <Ng3Label>Pickup patterns (csv)</Ng3Label>
                  <Input
                    value={csv(getPath(f, 'audio.pickupPatterns'))}
                    onChange={(e) => setFeature('audio.pickupPatterns', parseCsv(e.target.value))}
                    placeholder="cardioid, omnidirectional, bidirectional, stereo"
                    aria-label="Pickup patterns"
                  />
                </Ng3Field>
                <SubToggle path="audio.gain" label="Mic Gain" />
                <SubToggle path="audio.monitoring" label="Mic Monitoring" />
                <SubToggle path="audio.tapToMute" label="Tap to Mute" />
              </FeatureBlock>
              <FeatureBlock fkey="effects" name="Effects" desc="Voice presets + processing chain.">
                <SubToggle path="effects.presets" label="Voice Presets" />
                <SubToggle path="effects.noiseReduction" label="Noise Reduction" />
                <SubToggle path="effects.compressor" label="Compressor" />
                <SubToggle path="effects.limiter" label="Limiter" />
                <SubToggle path="effects.gate" label="Noise Gate" />
              </FeatureBlock>
              <FeatureBlock fkey="lighting" name="Lighting" desc="RGB ring effects." />
            </>
          )}

          <div className="cfg-actions">
            <Button variant="accent" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save to registry'}
            </Button>
            <Button onClick={copyShareLink}>Copy share link</Button>
            <Button onClick={copyJson}>Copy SKU JSON</Button>
          </div>
        </div>

        {/* ── Right: live canvas preview ── */}
        <div className="cfg-side">
          <PreviewStage key={sku.type}>
            <CanvasCmp sku={resolved} onClose={() => {}} />
          </PreviewStage>
          <Ng3Section className="cfg-json">
            <Ng3Row>
              <Ng3Label strong>Spec</Ng3Label>
              <span className="dc-mono-val">{JSON.stringify(cleaned).length} bytes</span>
            </Ng3Row>
            <pre>{JSON.stringify(cleaned, null, 2)}</pre>
          </Ng3Section>
        </div>
      </div>

      {toast && (
        <div className="cfg-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

// Scaled stage: renders the fixed-position device canvas inside a contained
// 1440×900 world, scaled to the column width — the React replacement for the
// vanilla configurator's prototype.html iframe.
const STAGE_W = 1440;
const STAGE_H = 900;

function PreviewStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / STAGE_W));
    ro.observe(el);
    setScale(el.clientWidth / STAGE_W);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="cfg-stage" ref={ref} style={{ height: STAGE_H * scale }}>
      <div className="cfg-stage-world" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
