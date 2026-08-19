// ══════════════════════════════════════════════════════════════════════════
// Monitor 5-tab IA — Overview / Connectivity / Display / Utilities / Audio.
// Owned by the monitor section (Cindy); registered in devices/deviceTabs.ts and
// rendered by MonitorCanvas on the Ng3Panel canvas.
//
// Vocabulary: the NG3 panel primitives (Ng3Section / Ng3Row / Ng3Field /
// Ng3Label / Ng3Spec / Ng3Scroll) plus library controls — the same
// set the mouse/keyboard/headset canvases use. The earlier port of these tabs
// spoke the old card-modal `dm-*` vocabulary; that stack was re-assembled here
// rather than pasted, so one canvas never shows two design systems.
//
// Folded in from the upstream 4-tab scaffold so nothing regressed for the
// other monitor SKUs: HDR + colour gamut (was Color) live in Display's Colour
// section; device identity, inputs list, USB hub and OSD (was Settings) live in
// Utilities. The text inputs list only appears when there is no X-ray card —
// the port map is already the single source for ports (Cindy, 2026-07-23).
//
// Craft decisions applied here (reports/2026-07-21-craft-review-polish-todo.md):
//   B4①  mode pills are the real modes with real selection — the old
//         Active/Secondary/Scheduled slot labels were hardcoded by position and
//         did not follow the choice (false state display, not just cosmetics).
//   B4②③ the parallel profile UIs are gone (Overview dropdown, Utilities
//         PROFILE MANAGEMENT). What replaces them was left open on 07-21 and
//         is now answered: the mode *is* the monitor's saved unit ("what a
//         mode remembers"), so there is no separate profile layer here. Not
//         the canvas ProfileBar — that renders nothing on a monitor (no
//         onboard slots), so naming it the profile home left the modal with
//         no profile at all until it was measured on 2026-07-31.
//   B4④  Smart Actions says "mode", the monitor's word, not "profile".
//   B8   auto-switch defaults OFF (input hand-off stays Zone 2/3).
//   B10  the Under-Glow master toggle actually gates colour + brightness.
// ══════════════════════════════════════════════════════════════════════════
import { Children, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Slider,
  Dropdown,
  Toggle,
  ToggleButtonGroup,
  Chip,
  Button,
  Badge,
  Icon,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  Ng3Spec,
  Ng3Scroll,
  ListItem,
} from '../../components';
import type { Features, ResolvedSku } from '../skus';
import { MonitorKvmTab } from '../KvmTab';
import './monitor-tabs.css';

/**
 * A tab body: its sections, packed into columns by height (see .mc-grid).
 *
 * Sections are passed as a flat list rather than pre-sorted into Ng3Col groups
 * because the list is SKU data — Gear Switch, OLED Care, Under-Glow, OSD and
 * the inputs list each appear only when the hardware has them. A hand-written
 * grouping is correct for exactly one monitor and wrong for the next one.
 * Falsy children (a gated-out section) drop out before the count, so the
 * column count follows what actually rendered.
 */
function MonitorGrid({ children, stack }: { children: ReactNode; stack?: boolean }) {
  const sections = Children.toArray(children);
  const cols = Math.max(1, Math.min(3, sections.length));
  // Up to two sections stay on the DS flex row (cards stretch to the body
  // height); three or more switch to column packing, where stretching is not
  // possible but balancing is what actually matters.
  //
  // `stack` is for a tab that mounts a full-width block of its own (the
  // upstream KVM tab, on monitors that have no Gear Switch): a block that
  // spans every column cannot be packed beside anything, so the tab becomes
  // one scrolling column instead of spilling sideways into overflow columns.
  const mode = stack ? 'mc-grid--stack' : sections.length > 2 ? 'mc-grid--packed' : 'mc-grid--wide';
  return (
    <div className={`ds-ng3-grid mc-grid ${mode}`} style={{ '--mc-cols': cols } as CSSProperties}>
      {sections}
    </div>
  );
}

// ── row shapes shared by the tabs (thin over the Ng3 primitives) ─────────────

/** Label ↔ toggle row. */
function ToggleRow({ label, on = false, disabled }: { label: string; on?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(on);
  return (
    <Ng3Row>
      <Ng3Label plain>{label}</Ng3Label>
      <Toggle checked={checked} onChange={setChecked} aria-label={label} disabled={disabled} />
    </Ng3Row>
  );
}

/** Section-titled slider with its live value in the header row. */
function SliderField({
  label,
  init = 50,
  suffix = '',
  info,
  disabled,
}: {
  label: string;
  init?: number;
  suffix?: string;
  info?: boolean;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(init);
  return (
    <>
      <Ng3Row>
        <Ng3Label strong info={info}>
          {label}
        </Ng3Label>
        <span className="dc-mono-val">
          {val}
          {suffix}
        </span>
      </Ng3Row>
      <Slider value={val} onChange={setVal} aria-label={label} disabled={disabled} />
    </>
  );
}

/** Stacked label + segmented control. */
function SegField({ label, values, right }: { label: string; values: string[]; right?: ReactNode }) {
  const [val, setVal] = useState(values[0]);
  return (
    <Ng3Field>
      {right ? (
        <Ng3Row>
          <Ng3Label>{label}</Ng3Label>
          {right}
        </Ng3Row>
      ) : (
        <Ng3Label>{label}</Ng3Label>
      )}
      <ToggleButtonGroup
        aria-label={label}
        value={val}
        onChange={setVal}
        options={values.map((v) => ({ label: v, value: v }))}
      />
    </Ng3Field>
  );
}

/** Label ↔ arbitrary trailing content (badge, value, button). */
function InfoRow({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <Ng3Row>
      <Ng3Label plain>
        {label}
        {sub && <span className="mt-sub"> · {sub}</span>}
      </Ng3Label>
      {children}
    </Ng3Row>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

/**
 * What a mode actually carries on *this* SKU. The line used to promise
 * "Screen, audio and under-glow" on every monitor, including one with neither
 * speakers nor under-glow — a card describing hardware the device does not
 * have. Built from the feature data instead, so it shrinks with the SKU.
 */
function modeScopeNote(features: Features): string {
  const carried = [
    'Screen',
    features.audio?.speakers ? 'audio' : null,
    features.underGlow ? 'under-glow' : null,
  ].filter(Boolean) as string[];
  if (carried.length === 1) return 'Screen settings follow the mode.';
  const last = carried.pop();
  return `${carried.join(', ')} and ${last} follow the mode.`;
}

export function OverviewTab({ features }: { features: Features }) {
  // No invented fallback list: a monitor without `modes` has no Overview tab at
  // all (deviceTabs gates it), the same way Audio needs speakers.
  const modes: string[] = Array.isArray(features.modes) ? features.modes : [];
  const [mode, setMode] = useState(modes[0] ?? '');
  const [smartActions, setSmartActions] = useState(true);

  if (modes.length === 0) return null;

  return (
    <MonitorGrid>
      <Ng3Section>
        <Ng3Label strong info>
          Mode
        </Ng3Label>
        {/* The selected segment *is* the active-mode readout — a second "Active:
            Game" row underneath would say it twice. */}
        <ToggleButtonGroup
          aria-label="Monitor mode"
          value={mode}
          onChange={setMode}
          options={modes.map((m) => ({ label: m, value: m }))}
        />
        <p className="mt-note">{modeScopeNote(features)}</p>
      </Ng3Section>

      {smartActions && (
        <Ng3Section>
          <Ng3Row>
            <Ng3Label strong>Smart Actions</Ng3Label>
            <Button variant="ghost" size="sm" aria-label="Dismiss Smart Actions" onClick={() => setSmartActions(false)}>
              <Icon name="close" size={14} aria-hidden />
            </Button>
          </Ng3Row>
          <p className="mt-note">Switch mode automatically when launching games or apps</p>
        </Ng3Section>
      )}
    </MonitorGrid>
  );
}

// ── Connectivity ─────────────────────────────────────────────────────────────

function GearSwitchSection({ gear }: { gear: Features }) {
  const [enabled, setEnabled] = useState(true);
  const hosts: string[] = Array.isArray(gear.hosts) ? gear.hosts : ['MacBook', 'Gaming Laptop'];
  const modes: string[] = Array.isArray(gear.viewingModes) ? gear.viewingModes : ['Full Screen', 'PBP', 'PIP'];
  const [host, setHost] = useState(hosts[0]);

  return (
    <Ng3Section>
      <Ng3Row>
        <Ng3Label strong info>
          Gear Switch
        </Ng3Label>
        <Toggle checked={enabled} onChange={setEnabled} aria-label="Gear Switch" />
      </Ng3Row>
      <p className="mt-note">Keyboard &amp; mouse follow the active computer.</p>

      <Ng3Field>
        <Ng3Row>
          <Ng3Label>Active Computer</Ng3Label>
          {gear.hotkey && <Badge variant="status">{gear.hotkey}</Badge>}
        </Ng3Row>
        <ToggleButtonGroup
          aria-label="Active computer"
          value={host}
          onChange={setHost}
          options={hosts.map((h) => ({ label: h, value: h }))}
        />
      </Ng3Field>

      <InfoRow label="Keyboard" sub="paired with mouse">
        <Badge variant="status" tone="positive">
          Connected
        </Badge>
      </InfoRow>
      <InfoRow label="Mouse" sub="USB dongle · KVM port">
        <Badge variant="status" tone="positive">
          Connected
        </Badge>
      </InfoRow>

      {/* Zone 2/3: the app never takes the keyboard on its own guess. */}
      <ToggleRow label="Auto-switch on mouse movement" />
    </Ng3Section>
  );
}

/** How the display shows its sources — a screen job, not a keyboard job. */
function ViewingModeSection({ gear }: { gear: Features }) {
  const modes: string[] = Array.isArray(gear.viewModes) ? gear.viewModes : ['Full Screen', 'PBP', 'PIP'];
  return (
    <Ng3Section>
      <SegField label="Viewing Mode" values={modes} />
    </Ng3Section>
  );
}

export function ConnectivityTab({ features }: { features: Features }) {
  const conn = features.connectivity || {};
  const inputs: string[] = Array.isArray(conn.inputs) ? conn.inputs : [];

  // The rear render + port callout are this tab's hero (XrayHero, mounted by
  // MonitorCanvas); port detail is in the full-screen X-ray it opens. So the
  // panel is controls only — and the text inputs list stays suppressed while an
  // X-ray exists, since the render already carries the ports (Cindy 2026-07-23).
  return (
    <MonitorGrid stack={!features.gearSwitch && !!conn.kvm}>
        {features.gearSwitch ? (
          <GearSwitchSection gear={features.gearSwitch} />
        ) : (
          conn.kvm && <MonitorKvmTab features={features} />
        )}
        {features.gearSwitch && <ViewingModeSection gear={features.gearSwitch} />}

          {/* Signal + link status for the connection the hero is showing. Power
              mode gates the rear USB ports, so it belongs beside them, not in
              Utilities' display-power section. */}
          <Ng3Section>
            <Ng3Label strong info>
              This Connection
            </Ng3Label>
            <Ng3Spec
              items={[
                { label: 'Source', value: 'MacBook' },
                { label: 'Signal', value: '3840 × 2160 · 240 Hz' },
              ]}
            />
            <Ng3Row>
              <Ng3Label plain>Link</Ng3Label>
              <span className="xr-badges">
                <Badge variant="status" tone="info">
                  <Icon name="bolt" size={9} aria-hidden /> Thunderbolt 4
                </Badge>
                <Badge variant="status" tone="positive">
                  <Icon name="check" size={9} aria-hidden /> Calibrated
                </Badge>
              </span>
            </Ng3Row>
            <span className="dc-divider" />
            <SegField label="Port power mode" values={['Full', 'Limited']} />
          </Ng3Section>

          {!features.xray && inputs.length > 0 && (
            <Ng3Section className="mc-inputs">
              <Ng3Label strong info>
                Inputs
              </Ng3Label>
              <Ng3Scroll>
                {inputs.map((i) => (
                  <ListItem key={i} label={i} leading={<Icon name="bidirectional" size={16} />} />
                ))}
              </Ng3Scroll>
              {conn.usbHub && (
                <>
                  <span className="dc-divider" />
                  <Ng3Row>
                    <Ng3Label plain>USB Hub</Ng3Label>
                    <span className="dc-mono-val">Enabled</span>
                  </Ng3Row>
                </>
              )}
            </Ng3Section>
          )}

          {features.gearSwitch && (
            <Ng3Section>
              <Ng3Label strong info>
                Thunderbolt Hub
              </Ng3Label>
              <p className="mt-note">90W upstream charging</p>
              <InfoRow label="MacBook">
                <Badge variant="status" tone="info">
                  Charging
                </Badge>
              </InfoRow>
            </Ng3Section>
          )}

          <Ng3Section>
            <Ng3Label strong>Rename Inputs</Ng3Label>
            {[
              { port: 'DP 1', name: 'Gaming Laptop' },
              { port: 'HDMI 1', name: 'Console' },
            ].map((r) => (
              <Ng3Row key={r.port}>
                <Ng3Label plain>{r.port}</Ng3Label>
                <input className="ds-input mt-rename" defaultValue={r.name} aria-label={`Rename ${r.port}`} />
              </Ng3Row>
            ))}
          </Ng3Section>
      </MonitorGrid>
  );
}

// ── Display ──────────────────────────────────────────────────────────────────

const RGB_GAIN: { ch: string; className: string; val: number }[] = [
  { ch: 'R', className: 'mt-ch-r', val: 100 },
  { ch: 'G', className: 'mt-ch-g', val: 97 },
  { ch: 'B', className: 'mt-ch-b', val: 94 },
];

export function DisplayTab({ features }: { features: Features }) {
  const display = features.display || {};
  const color = features.color || {};
  const presets: string[] = Array.isArray(color.presets) ? color.presets : ['Native', 'sRGB', 'DCI-P3'];
  const gamuts: string[] = Array.isArray(color.gamuts) ? color.gamuts : [];
  const [preset, setPreset] = useState(presets[0]);
  const [hdr, setHdr] = useState(!!color.hdr);
  const oled = features.care?.oled || display.panel === 'OLED';
  // Demo state: the prototype ships a calibrated display, so the gain channels
  // are lock-protected. Real state will come from the calibration service.
  const calibrationLocked = true;

  // Sections are listed in reading order and packed into (at most) three
  // columns by height — see MonitorGrid. OLED Care, HDR and the gamut dropdown
  // drop out on SKUs without them and the remaining sections re-pack.
  return (
    <MonitorGrid>
        {/* Panel facts (size / resolution / refresh / response / panel type)
            are not here: they are device identity, not display controls, and
            Utilities already owns the identity card. Keeping a second facts
            card on Display made the tab the heaviest in the modal — the one
            that pushed the arrangement hero past its own height. */}
        {oled && (
          <Ng3Section>
            <Ng3Label strong info>
              OLED Care
            </Ng3Label>
            <InfoRow label="Pixel Refresh">
              <Button variant="ghost" size="sm">
                Run now
              </Button>
            </InfoRow>
            <ToggleRow label="Static Content Detection" on />
            <ToggleRow label="Logo Burn-in Detection" on />
            <span className="dc-divider" />
            <Ng3Row>
              <Ng3Label plain>Last pixel refresh</Ng3Label>
              <span className="dc-mono-val">4 days ago</span>
            </Ng3Row>
          </Ng3Section>
        )}

        <Ng3Section>
          <SliderField label="Brightness" init={80} suffix="%" info />
          <Ng3Row>
            <Ng3Label plain>Ambient Sensor</Ng3Label>
            <Toggle checked={false} onChange={() => {}} aria-label="Ambient Sensor" />
          </Ng3Row>
          <span className="dc-divider" />
          <Ng3Row>
            <Ng3Label plain>Estimated draw</Ng3Label>
            <span className="dc-mono-val">30.3 W</span>
          </Ng3Row>
        </Ng3Section>
        <Ng3Section>
          <SliderField label="Contrast" init={55} info />
          <ToggleRow label="Dynamic Contrast" on />
        </Ng3Section>
        <Ng3Section>
          <SliderField label="Sharpness" init={30} />
          <Ng3Row>
            <span className="mt-note">Soft</span>
            <span className="mt-note">Sharp</span>
          </Ng3Row>
          <span className="dc-divider" />
          <SegField label="Black Stretch" values={['Off', 'Low', 'Medium', 'High']} />
        </Ng3Section>

      <Ng3Section>
        <Ng3Label strong info>
          Colour
        </Ng3Label>
        <div className="mt-chips">
          {presets.map((p) => (
            <Chip key={p} selected={preset === p} onClick={() => setPreset(p)}>
              {p}
            </Chip>
          ))}
        </div>
        {color.hdr != null && (
          <Ng3Row>
            <Ng3Label plain>HDR</Ng3Label>
            <Toggle checked={hdr} onChange={setHdr} aria-label="HDR" />
          </Ng3Row>
        )}
        {gamuts.length > 0 && (
          <Ng3Field>
            <Ng3Label>Colour Gamut</Ng3Label>
            <Dropdown
              aria-label="Colour gamut"
              defaultValue={gamuts[0]}
              options={gamuts.map((g) => ({ label: g, value: g }))}
            />
          </Ng3Field>
        )}
      </Ng3Section>

      {/* Its own section, not a divider inside Colour: at ~230px the gain stack
          made Colour a single block taller than a balanced column, which is the
          one thing the packer cannot split. Separate sections also let a
          monitor without calibration lock drop just this one.

          Locked is the resting state, so it is the compact state: three
          disabled sliders showing numbers nobody can move is 230px of
          decoration. The row states the lock and where to undo it; the
          channels come back when the lock is off. */}
      <Ng3Section>
        <Ng3Row>
          <Ng3Label strong>RGB Gain</Ng3Label>
          <Badge variant="status">
            <Icon name="lock-on" size={10} aria-hidden /> Calibration lock
          </Badge>
        </Ng3Row>
        {calibrationLocked ? (
          <p className="mt-note">
            <Icon name="info" size={11} aria-hidden /> Set by calibration · unlock in Advanced →
            Calibration settings
          </p>
        ) : (
          RGB_GAIN.map((g) => (
            <div className="mt-gain" key={g.ch}>
              <span className={`dc-mono-val ${g.className}`}>{g.ch}</span>
              <Slider value={g.val} onChange={() => {}} aria-label={`${g.ch} gain`} />
              <span className="dc-mono-val">{g.val}</span>
            </div>
          ))
        )}
      </Ng3Section>
    </MonitorGrid>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

const GLOW_COLORS = ['#00c8d7', '#f97316', '#a855f7', '#22c55e', '#f43f5e', '#efefef'];

function UnderGlowSection() {
  const [enabled, setEnabled] = useState(true);
  const [color, setColor] = useState(0);
  return (
    <Ng3Section>
      <Ng3Row>
        <Ng3Label strong info>
          Under-Glow
        </Ng3Label>
        <Toggle checked={enabled} onChange={setEnabled} aria-label="Under-Glow" />
      </Ng3Row>
      {/* The master toggle gates the controls it owns — same treatment the
          GearSwitch widget uses (dim + inert + aria-disabled), so "off" is not
          a lie the sliders keep contradicting. */}
      <div className={'mt-gate' + (enabled ? '' : ' is-off')} aria-disabled={!enabled}>
        <Ng3Row>
          <Ng3Label plain>Colour</Ng3Label>
          {/* `.ds-swatch` / `.ds-swatch-row` are library components (the accent
              and theme pickers use them) — the fill is the only per-item value. */}
          <span className="ds-swatch-row" role="radiogroup" aria-label="Under-glow colour">
            {GLOW_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === i}
                aria-label={`Colour ${i + 1}`}
                disabled={!enabled}
                onClick={() => setColor(i)}
                className={'ds-swatch' + (color === i ? ' selected' : '')}
                style={{ background: c }}
              />
            ))}
          </span>
        </Ng3Row>
        <SliderField label="Brightness" init={70} suffix="%" disabled={!enabled} />
      </div>
    </Ng3Section>
  );
}

export function UtilitiesTab({ sku }: { sku: ResolvedSku }) {
  const features = sku.features as Features;
  const display = features.display || {};
  const power = features.power || {};
  const osd = features.osd || {};
  const sleep: string[] = Array.isArray(power.autoSleep) ? power.autoSleep : ['5 min', '10 min', '30 min', 'Never'];
  const [osdLock, setOsdLock] = useState(false);

  return (
    <MonitorGrid>
        {/* Device identity — the panel facts moved here from Display, where
            they were a second identity card competing with this one. */}
        <Ng3Section>
          <Ng3Label strong>{sku.name}</Ng3Label>
          <Ng3Spec
            items={[
              ...(display.size ? [{ label: 'Size', value: display.size }] : []),
              ...(display.resolution ? [{ label: 'Resolution', value: display.resolution }] : []),
              ...(display.refreshRate ? [{ label: 'Refresh', value: `${display.refreshRate} Hz` }] : []),
              ...(display.responseTime ? [{ label: 'Response', value: display.responseTime }] : []),
              ...(display.panel ? [{ label: 'Panel', value: display.panel }] : []),
              { label: 'Firmware', value: 'v2.1.4 · Up to date' },
            ]}
          />
          <div className="dc-btns">
            <Button size="sm">
              <Icon name="screen-mirror" size={16} />
              Device Manager
            </Button>
            <Button size="sm">
              <Icon name="question" size={16} />
              Get Support
            </Button>
          </div>
        </Ng3Section>
        <Ng3Section>
          <Ng3Label strong info>
            Power
          </Ng3Label>
          <ToggleRow label="Eco Mode" />
          <Ng3Field>
            <Ng3Label>Auto sleep after</Ng3Label>
            <Dropdown
              aria-label="Auto sleep after"
              defaultValue={sleep[0]}
              options={sleep.map((s) => ({ label: s, value: s }))}
            />
          </Ng3Field>
        </Ng3Section>

        <Ng3Section>
          <Ng3Label strong>Firmware</Ng3Label>
          <InfoRow label="Hub firmware">
            <Button variant="ghost" size="sm">
              Update available →
            </Button>
          </InfoRow>
          <InfoRow label="OMEN Software">
            <span className="dc-mono-val">v5.0.2 · Up to date</span>
          </InfoRow>
        </Ng3Section>
        {(osd.joystick || osd.lockable) && (
          <Ng3Section>
            <Ng3Label strong info>
              OSD
            </Ng3Label>
            {osd.joystick && (
              <Ng3Row>
                <Ng3Label plain>Joystick control</Ng3Label>
                <span className="dc-mono-val">Rear · 5-way</span>
              </Ng3Row>
            )}
            {osd.lockable && (
              <Ng3Row>
                <Ng3Label plain>Lock OSD</Ng3Label>
                <Toggle checked={osdLock} onChange={setOsdLock} aria-label="Lock OSD" />
              </Ng3Row>
            )}
          </Ng3Section>
        )}

      {features.underGlow && <UnderGlowSection />}
    </MonitorGrid>
  );
}

// ── Audio ────────────────────────────────────────────────────────────────────

export function AudioTab({ features }: { features: Features }) {
  const audio = features.audio || {};
  const modes: string[] = Array.isArray(audio.outputModes) ? audio.outputModes : ['Game', 'Music', 'Video', 'EQ'];
  return (
    <MonitorGrid>
      <Ng3Section>
        <Ng3Label strong info>
          Volume
        </Ng3Label>
        <SliderField label="Output level" init={65} suffix="%" />
        <ToggleRow label="Mute" />
      </Ng3Section>
      <Ng3Section>
        <SegField label="Output Mode" values={modes} />
      </Ng3Section>
    </MonitorGrid>
  );
}
