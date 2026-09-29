import { useState } from 'react';
import './device-canvas.css';
import './spec-canvas.css';
import {
  Icon,
  Badge,
  Ng3Panel,
  Ng3Tool,
  Ng3Grid,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  Ng3Spec,
  Dropdown,
  Toggle,
  Slider,
} from '../components';
import { type ResolvedSku, type Features, deviceImageUrl, heroImageFile, getSku } from './skus';
import { useDeviceProfileBar, type ProfileBarState } from './ProfileBar';
import {
  TYPE_LABEL,
  TYPE_ICON,
  cap,
  present,
  read,
  formatValue,
  toOptions,
  specItems,
  fieldVisible,
  sectionVisible,
  type SpecFieldDef,
  type SpecSectionDef,
  type SpecTabDef,
} from './specSchema';
import { deviceTabs } from './deviceTabs';

/**
 * The generic spec-sheet device canvas — one NG3 canvas for every long-tail
 * device type (webcam, trackpad, notebook audio/IO/display, and the desktop
 * GPU/cooling/RAM/PSU/lighting components), replacing the old `DeviceModal` +
 * `renderers.tsx` pair.
 *
 * It renders a type's declarative `SPEC_SCHEMA` entry onto the same
 * `.dc-*` chrome and `.ds-ng3-*` primitives as the five bespoke canvases, so
 * these devices stop looking like a different app. Nothing renders that the
 * SKU has no data for: fields hide on missing/disabled values, sections hide
 * when empty, tabs hide when every section is empty — which is how one schema
 * serves every SKU of a type. Types with no schema fall back to an overview of
 * their feature groups.
 */

// ── field rendering ────────────────────────────────────────────────────────
function SpecField({
  features,
  def,
  getValue,
  setState,
}: {
  features: Features;
  def: SpecFieldDef;
  /** Scope-backed read — `undefined` means "never set", so the SKU default wins. */
  getValue: (key: string) => any;
  setState: (key: string, value: any) => void;
}) {
  switch (def.kind) {
    case 'spec':
      return <Ng3Spec items={specItems(features, def)} />;

    case 'toggle': {
      const initial = read(features, def.path).v === true;
      const checked = getValue(def.path) ?? initial;
      return (
        <Ng3Row>
          <Ng3Label plain>{def.label}</Ng3Label>
          <Toggle checked={checked} onChange={(v) => setState(def.path, v)} aria-label={def.label} />
        </Ng3Row>
      );
    }

    case 'dropdown': {
      const list = read(features, def.path).v as any[];
      const options = toOptions(list, def.cap);
      return (
        <Ng3Field>
          <Ng3Label strong info>
            {def.label}
          </Ng3Label>
          <Dropdown
            aria-label={def.label}
            value={getValue(def.path) ?? options[0]?.value}
            onChange={(v) => setState(def.path, v)}
            options={options}
          />
        </Ng3Field>
      );
    }

    case 'tags': {
      const list = read(features, def.path).v as string[];
      return (
        <div className="sc-tags">
          {list.map((tag) => (
            <Badge key={tag} variant="status" tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      );
    }

    case 'slider': {
      let min = 0;
      let max = 100;
      let init = def.init ?? 50;
      if (def.path && def.shape === 'max') {
        max = read(features, def.path).v as number;
        init = Math.round(max * (def.ratio ?? 0.6));
      } else if (def.path && def.shape === 'range') {
        const range = read(features, def.path).v as { min?: number; max?: number; default?: number };
        min = range.min ?? 1;
        max = range.max ?? 10;
        init = range.default ?? Math.round((min + max) / 2);
      }
      const key = def.path ?? def.label;
      const value = getValue(key) ?? init;
      return (
        <>
          <Ng3Row>
            <Ng3Label strong info>
              {def.label}
            </Ng3Label>
            <span className="dc-mono-val">
              {value.toLocaleString()}
              {def.suffix ?? ''}
            </span>
          </Ng3Row>
          <Slider min={min} max={max} value={value} onChange={(v) => setState(key, v)} aria-label={def.label} />
        </>
      );
    }
  }
}

/**
 * One state bag backs every long-tail device's controls, so scope-backing it
 * here covers the whole tail at once rather than a canvas at a time.
 *
 * These devices have no onboard memory, so they render no profile bar — but
 * "no bar" only ever meant no hardware slots to choose between. Their settings
 * are software settings, and software settings belong to the profile.
 *
 * Keys are namespaced with the tab id (`utilities.power.autoSleep`) rather than
 * used raw: the profile manifest groups by the segment before the first dot, so
 * a bare feature path like `power.autoSleep` would invent a "Power" group that
 * corresponds to no tab.
 */
function SpecTabBody({
  features,
  sections,
  profile,
  tabId,
}: {
  features: Features;
  sections: SpecSectionDef[];
  profile: ProfileBarState;
  tabId: string;
}) {
  const getValue = (key: string) => profile.value<any>(`${tabId}.${key}`, undefined);
  const set = (key: string, value: any) => profile.setValue(`${tabId}.${key}`, value);

  return (
    <Ng3Grid className="sc-grid">
      {sections
        .filter((s) => sectionVisible(features, s))
        .map((section, i) => (
          <Ng3Section key={section.label ?? i}>
            {section.label && (
              <Ng3Label strong info>
                {section.label}
              </Ng3Label>
            )}
            {section.fields
              .filter((def) => fieldVisible(features, def))
              .map((def, j) => (
                <SpecField key={j} features={features} def={def} getValue={getValue} setState={set} />
              ))}
          </Ng3Section>
        ))}
    </Ng3Grid>
  );
}

// ── fallback for types with no schema entry ────────────────────────────────
function summarize(value: any): string {
  if (Array.isArray(value)) return `${value.length} option${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object' && value !== null) {
    const n = Object.keys(value).length;
    return `${n} setting${n === 1 ? '' : 's'}`;
  }
  return formatValue(value);
}

function FallbackTab({ features }: { features: Features }) {
  const groups = Object.entries(features).filter(([, v]) => present(v));
  if (!groups.length) {
    return (
      <Ng3Grid className="sc-grid">
        <Ng3Section>
          <span className="sc-empty">No configurable features for this device yet.</span>
        </Ng3Section>
      </Ng3Grid>
    );
  }
  // Split the groups across two even sections so the panel reads as columns.
  const half = Math.ceil(groups.length / 2);
  return (
    <Ng3Grid className="sc-grid">
      {[groups.slice(0, half), groups.slice(half)]
        .filter((col) => col.length)
        .map((col, i) => (
          <Ng3Section key={i}>
            <Ng3Spec items={col.map(([key, value]) => ({ label: cap(key.replace(/([A-Z])/g, ' $1')), value: summarize(value) }))} />
          </Ng3Section>
        ))}
    </Ng3Grid>
  );
}

// ── canvas ─────────────────────────────────────────────────────────────────
const FALLBACK_TAB: SpecTabDef = { id: 'overview', icon: 'details', title: 'Overview', sections: [] };

export function SpecCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const f = sku.features;
  // These devices have no onboard slots, so no bar renders — but the hook is
  // still how a software setting reaches the active profile.
  const profile = useDeviceProfileBar(sku);
  const tabs = deviceTabs(sku) as SpecTabDef[];
  const usingFallback = tabs.length === 0;
  const shown = usingFallback ? [FALLBACK_TAB] : tabs;

  const [tabId, setTabId] = useState(
    initialTab && shown.some((t) => t.id === initialTab) ? initialTab : shown[0].id,
  );
  const active = shown.find((t) => t.id === tabId) ?? shown[0];

  // Component SKUs (a GPU, a webcam) have no product photo of their own —
  // fall back to the parent system's hero, then to the type glyph.
  const parent = sku.partOf ? getSku(sku.partOf) : undefined;
  const heroSrc = deviceImageUrl(heroImageFile(sku)) ?? (parent ? deviceImageUrl(heroImageFile(parent)) : undefined);
  const typeLabel = TYPE_LABEL[sku.type] ?? cap(sku.type);

  return (
    <div className="dc-canvas" role="dialog" aria-label={sku.name}>
      {/* Status chips */}
      <div className="dc-status">
        <div className="dc-chip">
          <Icon name={TYPE_ICON[sku.type] ?? 'devices'} size={16} />
          <span className="dc-chip-val">{typeLabel}</span>
        </div>
        {parent && (
          <div className="dc-chip">
            <span className="dc-chip-val">Part of {parent.name}</span>
          </div>
        )}
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      {/* Hero — the parent system's photo, or the type glyph */}
      <div className="dc-hero">
        {heroSrc ? (
          <img src={heroSrc} alt={parent ? `${parent.name} — ${typeLabel}` : sku.name} />
        ) : (
          <div className="sc-hero-glyph" aria-hidden="true">
            <Icon name={TYPE_ICON[sku.type] ?? 'devices'} size={96} />
          </div>
        )}
      </div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap">
        <Ng3Panel
          width={active.width}
          header={active.title}
          tools={shown.map((t) => (
            <Ng3Tool
              key={t.id}
              icon={t.icon}
              title={t.title}
              active={t.id === active.id}
              onClick={() => setTabId(t.id)}
            />
          ))}
          actions={
            <button type="button" className="ds-ng3-action" aria-label="Duplicate">
              <Icon name="duplicate" />
            </button>
          }
          bare
        >
          {usingFallback ? (
            <FallbackTab features={f} />
          ) : (
            <SpecTabBody
              key={`${active.id}:${profile.revision}`}
              features={f}
              sections={active.sections}
              profile={profile}
              tabId={active.id}
            />
          )}
        </Ng3Panel>
      </div>
    </div>
  );
}
