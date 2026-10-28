import { useEffect, useRef, useState } from 'react';
import './device-canvas.css';
import './spec-canvas.css';
import './pc-parts.css';
import {
  Backdrop,
  Badge,
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuLabel,
  FanCurve,
  Icon,
  IconButton,
  ModalShell,
  Ng3Col,
  Ng3Field,
  Ng3Grid,
  Ng3Label,
  Ng3Panel,
  Ng3Section,
  Ng3Spec,
  Ng3Tool,
  Slider,
  Sparkline,
  Stepper,
  Toggle,
  ToggleButtonGroup,
} from '../components';
import { type ResolvedSku, deviceImageUrl, getSku, heroImageFile } from './skus';
import { deviceTabs } from './deviceTabs';
import { DeviceSettingsCard } from './DeviceSettingsCard';
import { SPEC_SCHEMA, specItems, sectionVisible } from './specSchema';
import {
  PSU_CLEAN_MAX_C,
  fanRpm,
  PSU_FAN_MODE_LABEL,
  PSU_RAILS,
  PSU_WARN_DEFAULT,
  psuOver,
  psuStatusOf,
  resetPsuFan,
  setPsuWarn,
  startPsuClean,
  usePsuCleaning,
  usePsuHistory,
  usePsuLab,
  usePsuReadings,
  usePsuSettings,
  type PsuFanMode,
  type PsuReadings,
  type PsuSettings,
  type PsuWarnKey,
} from './pcParts';
import { useSettings } from '../state/Settings';
import { formatTemp } from '../state/units';

/**
 * The OMEN power supply's editor (OpenGSW lcd-diy, "The power supply"; OMEN
 * PSU is MVP, Jira GSW-22694), adapted from OGH's design (Figma OMEN-PSU,
 * "VX Design to Dev") onto the device window every peripheral uses:
 *
 *   Status   — eight readings with their last minute, warnings the player
 *              sets per reading, and whether to be told (lcd-diy.14–16)
 *   Fan      — Max / Auto / Manual, and cleaning (lcd-diy.17–18)
 *   Settings — the device card: firmware, how it was found (lcd-diy.38), specs
 *
 * The parts are exported whole, so the desktop machine's own window shows the
 * same editor in its Power Supply tab: one editor behind every door
 * (lcd-diy.25). PSU protection lives in Advanced Tuning, under the top mode;
 * this editor reports it and does not open a second way there.
 */

// ── Whether to be told ────────────────────────────────────────────────────
/** The switch in the panel header, where the headset keeps its spatial-audio
 *  power: "Notify me of status warnings" in OGH. */
export function PsuNotifyToggle() {
  const [s, set] = usePsuSettings();
  return <Toggle checked={s.notify} onChange={(v) => set({ notify: v })} aria-label="Notify me of status warnings" />;
}

// ── The "…" menu on a reading ─────────────────────────────────────────────
/** A small popover anchored to a reading's "…" button. Escape and a click
 *  outside close the menu only, never the window under it. */
function ReadingMenu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div className="pcp-menu" ref={ref}>
      <IconButton
        variant="ghost"
        label={`${label} options`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={14} />
      </IconButton>
      {open && (
        <ContextMenu className="pcp-menu-pop" role="dialog" aria-label={`${label} options`}>
          <ContextMenuLabel>{label}</ContextMenuLabel>
          {children(() => setOpen(false))}
        </ContextMenu>
      )}
    </div>
  );
}

/** Set where a reading warns: a draft until Apply (OGH's overflow menu). */
function WarnLevel({ k, unit, label, close }: { k: PsuWarnKey; unit: 'A' | '°C'; label: string; close: () => void }) {
  const [s] = usePsuSettings();
  const [draft, setDraft] = useState(s.warn[k]);
  return (
    <div className="pcp-menu-body">
      <Ng3Label plain>{label}</Ng3Label>
      <Stepper
        value={draft}
        onChange={setDraft}
        min={unit === 'A' ? 1 : 30}
        max={unit === 'A' ? 120 : 90}
        step={1}
        precision={0}
        format={(v) => `${v} ${unit}`}
        parse={(t) => (Number.isFinite(parseFloat(t)) ? parseFloat(t) : null)}
        size="sm"
        aria-label={`${label}, maximum`}
      />
      <div className="pcp-action">
        <Button
          size="sm"
          variant="accent"
          onClick={() => {
            setPsuWarn(k, draft);
            close();
          }}
        >
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(PSU_WARN_DEFAULT[k]);
            setPsuWarn(k);
          }}
        >
          Reset to default
        </Button>
      </div>
    </div>
  );
}

// ── One reading ───────────────────────────────────────────────────────────
function Reading({
  label,
  display,
  points,
  over,
  menu,
}: {
  label: string;
  display: string;
  points: number[];
  over?: boolean;
  menu?: React.ReactNode;
}) {
  return (
    <div className={'pcp-reading' + (over ? ' is-over' : '')}>
      {menu}
      <Sparkline
        label={label}
        // A warning is said with a mark, not only in colour (lcd-diy.16).
        display={over ? `⚠ ${display}` : display}
        points={points.map((v, t) => ({ t, v }))}
        aria-label={over ? `${label} ${display}, over its warning level` : `${label} ${display}`}
      />
    </div>
  );
}

// ── Status ────────────────────────────────────────────────────────────────
export function PsuStatus({ capacityW, onOpenFan }: { capacityW: number; onOpenFan?: () => void }) {
  const r = usePsuReadings();
  const hist = usePsuHistory();
  const [s, set] = usePsuSettings();
  const lab = usePsuLab();
  const cleaning = usePsuCleaning();
  const { tempUnit } = useSettings();
  const over = lab.usb ? psuOver(r, s.warn) : [];
  const word = psuStatusOf(over, lab.usb);
  const rpm = (x: PsuReadings) => fanRpm(s, x, capacityW);

  return (
    <div className="pcp-status-tab">
      <div className="pcp-summary">
        <Badge variant="status" tone={!lab.usb ? 'neutral' : over.length ? 'warn' : 'positive'}>
          {word}
        </Badge>
        <span className="pcp-reason">
          Power protection is on. It lowers power when the supply nears its limit; turn it off in Advanced Tuning if you
          fit a different power supply.
        </span>
      </div>
      {/* The notify switch is the supply's own window's (its header); the PC
          page's tab has no switch beside its title (JY, 2026-10-21). */}
      {lab.usb && !s.notify && (
        <span className="pcp-reason">Warnings show here only. Turn on notifications in the power supply's window to be told.</span>
      )}

      {!lab.usb ? (
        <Ng3Section>
          <Ng3Label strong>Live</Ng3Label>
          <span className="pcp-reason">
            This power supply has no link to read. Power protection still works from an estimate, and its fan runs by
            itself.
          </span>
        </Ng3Section>
      ) : (
        <>
          <div className="pcp-readings" role="group" aria-label="Supply">
            <Reading label="Total power" display={`${r.watts} W`} points={hist.map((x) => x.watts)} />
            <Reading label="Efficiency" display={`${r.efficiency}%`} points={hist.map((x) => x.efficiency)} />
            <Reading
              label="Temperature"
              display={formatTemp(r.tempC, tempUnit)}
              points={hist.map((x) => x.tempC)}
              over={over.includes('temp')}
              menu={
                <ReadingMenu label="Temperature">
                  {(close) => <WarnLevel k="temp" unit="°C" label="Warning level" close={close} />}
                </ReadingMenu>
              }
            />
            <Reading
              label="Fan speed"
              // A clean drives the fan while it runs (lcd-diy.18).
              display={cleaning ? 'Cleaning' : `${rpm(r).toLocaleString()} RPM`}
              points={hist.map(rpm)}
              menu={
                onOpenFan && (
                  <ReadingMenu label="Fan speed">
                    {(close) => (
                      <div className="pcp-menu-body">
                        <Button
                          size="sm"
                          onClick={() => {
                            close();
                            onOpenFan();
                          }}
                        >
                          Open fan control
                        </Button>
                      </div>
                    )}
                  </ReadingMenu>
                )
              }
            />
          </div>
          <div className="pcp-readings" role="group" aria-label="Rails">
            {PSU_RAILS.map((rail) => {
              const now = r.rails[rail.id];
              return (
                <Reading
                  key={rail.id}
                  label={rail.label}
                  display={`${now.amps} A · ${now.volts} V`}
                  points={hist.map((x) => x.rails[rail.id].amps)}
                  over={over.includes(rail.id)}
                  menu={
                    <ReadingMenu label={rail.label}>
                      {(close) => <WarnLevel k={rail.id} unit="A" label="Current warning level" close={close} />}
                    </ReadingMenu>
                  }
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── The refused clean ─────────────────────────────────────────────────────
/** OGH's "Unable To Start Fan Cleaning" dialog. It does not state the heat
 *  limit (fan-cleaner.40), which OGH's copy did. Escape closes the dialog
 *  only, never the window under it. */
function CleanRefused({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);
  return (
    <>
      <Backdrop onClick={onClose} />
      <ModalShell
        title="Unable to start fan cleaning"
        className="pcp-dialog"
        width="narrow"
        onClose={onClose}
        footer={
          <div className="pcp-dialog-foot">
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="pcp-dialog-body" role="alert">
          <p>Your power supply is too hot to start fan cleaning. Try again once it has cooled down.</p>
          <p>You can cool your system down by closing games or apps you are not using.</p>
        </div>
      </ModalShell>
    </>
  );
}

// ── Fan ───────────────────────────────────────────────────────────────────
const FAN_OPTIONS: { label: string; value: PsuFanMode }[] = (['max', 'auto', 'manual'] as const).map((value) => ({
  label: PSU_FAN_MODE_LABEL[value],
  value,
}));

/** How long ago, in the words a card's receipt row uses. */
function ago(ms: number | null): string {
  if (ms == null) return 'Not yet';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export function PsuFan({ capacityW }: { capacityW: number }) {
  const [s, set] = usePsuSettings();
  const r = usePsuReadings();
  const cleaning = usePsuCleaning();
  const lab = usePsuLab();
  const [refused, setRefused] = useState(false);
  if (!lab.usb) {
    return (
      <Ng3Grid>
        <Ng3Section>
          <Ng3Label strong>Fan</Ng3Label>
          <span className="pcp-reason">This power supply has no link, so its fan cannot be set or cleaned from here.</span>
        </Ng3Section>
      </Ng3Grid>
    );
  }
  const rpm = fanRpm(s, r, capacityW);
  const clean = () => {
    // Refused while the supply is warm (fan-cleaner.41); the message does not
    // state the limit (fan-cleaner.40), which OGH's dialog did.
    if (r.tempC > PSU_CLEAN_MAX_C) {
      setRefused(true);
      return;
    }
    setRefused(false);
    startPsuClean();
  };
  return (
    <Ng3Grid>
      <Ng3Col>
        <Ng3Section>
          <Ng3Label strong>Power supply fan</Ng3Label>
          <ToggleButtonGroup
            aria-label="Power supply fan"
            value={s.fanMode}
            onChange={(v) => set({ fanMode: v as PsuFanMode })}
            options={FAN_OPTIONS}
            fullWidth
          />
          <Checkbox
            label="Enable 0 RPM"
            checked={s.zeroRpm}
            onChange={(e) => set({ zeroRpm: e.currentTarget.checked })}
            aria-label="Enable 0 RPM"
          />
          {/* Max and Auto only show the speed; Manual sets it. */}
          {s.fanMode !== 'manual' ? (
            <Ng3Spec items={[{ label: 'Speed', value: cleaning ? 'Cleaning' : `${rpm.toLocaleString()} RPM` }]} />
          ) : (
            <>
              {!s.dynamicCurve && (
                <Ng3Field>
                  <Ng3Label plain>Speed ({rpm.toLocaleString()} RPM)</Ng3Label>
                  <Slider
                    min={20}
                    max={100}
                    step={5}
                    value={s.manualPct}
                    onChange={(v) => set({ manualPct: v })}
                    aria-label="Fan speed"
                  />
                </Ng3Field>
              )}
              <Checkbox
                label="Dynamic fan curve"
                checked={s.dynamicCurve}
                onChange={(e) => set({ dynamicCurve: e.currentTarget.checked })}
                aria-label="Dynamic fan curve"
              />
            </>
          )}
          {cleaning && <span className="pcp-reason">The clean is running the fan. Your setting comes back when it ends.</span>}
          <div className="pcp-action">
            <Button size="sm" variant="ghost" onClick={() => resetPsuFan()}>
              Reset to default
            </Button>
          </div>
        </Ng3Section>
      </Ng3Col>
      {s.fanMode === 'manual' && s.dynamicCurve && (
        <Ng3Col>
          <Ng3Section>
            <Ng3Label strong>Fan curve</Ng3Label>
            <FanCurve points={s.curve} onChange={(curve) => set({ curve })} liveTemp={r.tempC} aria-label="Power supply fan curve" />
          </Ng3Section>
        </Ng3Col>
      )}
      <Ng3Col>
        <Ng3Section>
          <Ng3Label strong>Fan cleaning</Ng3Label>
          <span className="pcp-reason">Spins the fan backwards for a while to clear dust. You will hear it.</span>
          <div className="pcp-action">
            <Button size="sm" variant="accent" disabled={cleaning} onClick={clean}>
              {cleaning ? 'Cleaning…' : 'Start fan clean'}
            </Button>
          </div>
          {refused && <CleanRefused onClose={() => setRefused(false)} />}
          {/* An AMD host has the manual clean only (fan-cleaner.33). */}
          {!lab.amd && (
            <Checkbox
              label="Enable automatic fan cleaning"
              checked={s.autoClean}
              onChange={(e) => set({ autoClean: e.currentTarget.checked })}
              aria-label="Enable automatic fan cleaning"
            />
          )}
          <Ng3Spec items={[{ label: 'Last cleaned', value: ago(s.lastCleaned) }]} />
        </Ng3Section>
      </Ng3Col>
    </Ng3Grid>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────
/** The device card every peripheral's Settings tab opens with, plus how the
 *  supply was found and the facts its spec sheet held. */
export function PsuSettingsCard({ sku }: { sku: ResolvedSku }) {
  const lab = usePsuLab();
  const sections = (SPEC_SCHEMA[sku.type]?.[0]?.sections ?? []).filter((sec) => sectionVisible(sku.features, sec));
  return (
    <DeviceSettingsCard
      name={sku.name}
      firmware={typeof sku.features.firmware === 'string' ? sku.features.firmware : null}
      deviceManager={false}
    >
      <Ng3Spec
        items={[
          { label: 'Maker', value: lab.maker },
          { label: 'Link', value: lab.usb ? 'USB' : 'None' },
        ]}
      />
      {sections.flatMap((sec) =>
        sec.fields.map((def, j) =>
          def.kind === 'spec' ? <Ng3Spec key={`${sec.label}-${j}`} items={specItems(sku.features, def)} /> : null,
        ),
      )}
    </DeviceSettingsCard>
  );
}

// ── The editor inside another window ──────────────────────────────────────
export type PsuView = 'status' | 'fan';

/** OGH's two sub-tabs, Status Monitor and Fan Control, as one switch. On the
 *  PC page it sits at the right end of the panel's title row (JY, 2026-10-21). */
export function PsuViewSwitch({ view, onView }: { view: PsuView; onView: (v: PsuView) => void }) {
  return (
    <ToggleButtonGroup
      aria-label="Power supply view"
      value={view}
      onChange={(v) => onView(v as PsuView)}
      options={[
        { label: 'Status', value: 'status' },
        { label: 'Fan', value: 'fan' },
      ]}
    />
  );
}

/** The same editor as one tab of the desktop machine's window: the view the
 *  host's switch picked (PsuViewSwitch), Status or Fan. */
export function PsuEditor({ capacityW, view, onView }: { capacityW: number; view: PsuView; onView: (v: PsuView) => void }) {
  return <div className="pcp-editor">{view === 'status' ? <PsuStatus capacityW={capacityW} onOpenFan={() => onView('fan')} /> : <PsuFan capacityW={capacityW} />}</div>;
}

// ── The window ────────────────────────────────────────────────────────────
export function PsuCanvas({ sku, onClose, initialTab }: { sku: ResolvedSku; onClose: () => void; initialTab?: string }) {
  const tabs = deviceTabs(sku);
  const [tabId, setTabId] = useState(initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const lab = usePsuLab();
  const capacityW = typeof sku.features.wattage === 'number' ? sku.features.wattage : 1000;
  // A part has no photo of its own; it stands in front of the system it is in.
  const parent = sku.partOf ? getSku(sku.partOf) : undefined;
  const heroSrc = deviceImageUrl(heroImageFile(sku)) ?? (parent ? deviceImageUrl(heroImageFile(parent)) : undefined);

  return (
    <div className="dc-canvas" role="dialog" aria-label={sku.name}>
      {/* The connection chip every peripheral's window opens with. */}
      <div className="dc-status">
        <div className="dc-chip">
          <span className={'dc-chip-dot' + (lab.usb ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
          <span className="dc-chip-val">{lab.usb ? 'USB' : 'No link'}</span>
        </div>
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      <div className="dc-hero">
        {heroSrc ? (
          <img src={heroSrc} alt={parent ? `${parent.name} — power supply` : sku.name} />
        ) : (
          <div className="sc-hero-glyph" aria-hidden="true">
            <Icon name="bolt" size={96} />
          </div>
        )}
      </div>

      <div className="dc-panel-wrap">
        <Ng3Panel
          width={active.width}
          header={active.title}
          headerExtra={active.id === 'status' && lab.usb ? <PsuNotifyToggle /> : undefined}
          tools={tabs.map((t) => (
            <Ng3Tool key={t.id} icon={t.icon} title={t.title} active={t.id === active.id} onClick={() => setTabId(t.id)} />
          ))}
          bare
        >
          {active.id === 'status' ? (
            <PsuStatus capacityW={capacityW} onOpenFan={() => setTabId('fan')} />
          ) : active.id === 'fan' ? (
            <PsuFan capacityW={capacityW} />
          ) : (
            <PsuSettingsCard sku={sku} />
          )}
        </Ng3Panel>
      </div>
    </div>
  );
}
