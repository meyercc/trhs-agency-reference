// ══════════════════════════════════════════════════════════════════════════
// Spec-sheet device schema — the data-driven replacement for renderers.tsx.
//
// The long-tail device types (webcam, trackpad, notebook audio/IO/display and
// the desktop components) are all the same shape of UI: a few bordered
// sections of key/value facts, a handful of preference toggles, an occasional
// dropdown or slider. Rather than a hand-written renderer per type, each type
// declares its tabs here and `SpecCanvas` renders them onto the shared
// `.ds-ng3-*` panel primitives.
//
// Adding a device type = adding an entry to SPEC_SCHEMA. Nothing is rendered
// that the SKU has no data for, so one schema covers every SKU of a type
// (feature-gating falls out of the data — see `read()` in SpecCanvas).
//
// Avalonia: this is the view-model description; SpecCanvas is the DataTemplate
// selector over it.
// ══════════════════════════════════════════════════════════════════════════
import type { IconName } from '../components';
import type { Features } from './skus';

/** A single control/readout inside a section. */
export type SpecFieldDef =
  /** Key/value fact rows (`Ng3Spec`). `from` scopes into a feature sub-object. */
  | { kind: 'spec'; from?: string; rows: SpecRowDef[]; cap?: boolean }
  /**
   * Label ↔ Toggle row. Default is *capability* semantics: rendered only when
   * the value is `true` (a `false` leaf means the hardware lacks it).
   * `pref: true` marks a user preference that exists whenever the key does —
   * rendered even when `false`, switched off (e.g. Natural Scrolling).
   */
  | { kind: 'toggle'; path: string; label: string; pref?: boolean }
  /**
   * A slider. `shape: 'range'` reads `{min,max,default}` at `path`;
   * `shape: 'max'` reads a number ceiling at `path` (start at `ratio` of it);
   * no `path` = an always-present 0–100 control (brightness).
   */
  | { kind: 'slider'; label: string; path?: string; shape?: 'range' | 'max'; ratio?: number; init?: number; suffix?: string }
  /** Stacked label + Dropdown, options from a string (or `{id,label}`) array. */
  | { kind: 'dropdown'; path: string; label: string; cap?: boolean }
  /** A wrapped row of static tags — port lists, display outputs. */
  | { kind: 'tags'; path: string };

/** `[key, label]`, optionally `[key, label, suffix]` (units). */
export type SpecRowDef = [string, string] | [string, string, string];

export interface SpecSectionDef {
  label?: string;
  fields: SpecFieldDef[];
}

export interface SpecTabDef {
  id: string;
  icon: IconName;
  title: string;
  sections: SpecSectionDef[];
}

// ── shared tabs ────────────────────────────────────────────────────────────
/** The zone-RGB lighting tab shared by the GPU / cooling / RAM components. */
function zoneLightingTab(): SpecTabDef {
  return {
    id: 'lighting',
    icon: 'lights',
    title: 'Lighting',
    sections: [
      {
        label: 'Effect',
        fields: [
          { kind: 'dropdown', path: 'lighting.effects', label: 'Effect', cap: true },
          { kind: 'spec', from: 'lighting', rows: [['zones', 'Zones']] },
        ],
      },
      {
        label: 'Brightness',
        fields: [{ kind: 'slider', label: 'Brightness', init: 80, suffix: '%' }],
      },
    ],
  };
}

// ── per-type schemas ───────────────────────────────────────────────────────
export const SPEC_SCHEMA: Record<string, SpecTabDef[]> = {
  // ── Notebook webcam ──────────────────────────────────────────────────────
  'notebook-webcam': [
    {
      id: 'video',
      icon: 'camera-video',
      title: 'Video',
      sections: [
        {
          label: 'Camera',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['resolution', 'Resolution'],
                ['fov', 'Field of view', '°'],
              ],
            },
          ],
        },
        {
          label: 'Privacy & Sign-in',
          fields: [
            { kind: 'toggle', path: 'privacyShutter', label: 'Privacy Shutter', pref: true },
            { kind: 'toggle', path: 'windowsHello', label: 'Windows Hello', pref: true },
            { kind: 'spec', rows: [['ir', 'IR sensor']] },
          ],
        },
      ],
    },
    {
      id: 'ai',
      icon: 'ai',
      title: 'AI Effects',
      sections: [
        {
          label: 'Enhancements',
          fields: [
            { kind: 'toggle', path: 'ai.autoFraming', label: 'Auto Framing', pref: true },
            { kind: 'toggle', path: 'ai.backgroundBlur', label: 'Background Blur', pref: true },
          ],
        },
        {
          label: 'Image',
          fields: [
            { kind: 'toggle', path: 'ai.eyeContact', label: 'Eye Contact', pref: true },
            { kind: 'toggle', path: 'ai.lowLightEnhance', label: 'Low-light Enhance', pref: true },
          ],
        },
      ],
    },
  ],

  // ── Notebook trackpad ────────────────────────────────────────────────────
  'notebook-trackpad': [
    {
      id: 'pointer',
      icon: 'sensor',
      title: 'Pointer',
      sections: [
        {
          label: 'Sensitivity',
          fields: [{ kind: 'slider', label: 'Pointer Speed', path: 'sensitivity', shape: 'range' }],
        },
        {
          label: 'Behavior',
          fields: [
            { kind: 'toggle', path: 'palmRejection', label: 'Palm Rejection', pref: true },
            { kind: 'toggle', path: 'tapToClick', label: 'Tap to Click', pref: true },
            { kind: 'toggle', path: 'naturalScrolling', label: 'Natural Scrolling', pref: true },
            // Capability, not a preference — only haptic trackpads show it.
            { kind: 'toggle', path: 'haptic', label: 'Haptic Feedback' },
          ],
        },
      ],
    },
    {
      id: 'gestures',
      icon: 'swipe',
      title: 'Gestures',
      sections: [
        {
          label: 'Multi-finger',
          fields: [
            {
              kind: 'spec',
              from: 'gestures',
              cap: true,
              rows: [
                ['twoFinger', 'Two-finger'],
                ['threeFinger', 'Three-finger'],
                ['fourFinger', 'Four-finger'],
              ],
            },
          ],
        },
      ],
    },
  ],

  // ── Notebook audio ───────────────────────────────────────────────────────
  'notebook-audio': [
    {
      id: 'output',
      icon: 'volume-up',
      title: 'Output',
      sections: [
        {
          label: 'Speakers',
          fields: [
            {
              kind: 'spec',
              from: 'speakers',
              rows: [
                ['count', 'Speakers'],
                ['peakWatts', 'Peak power', ' W'],
                ['dts', 'DTS:X'],
              ],
            },
          ],
        },
        {
          label: 'Effects',
          fields: [
            { kind: 'dropdown', path: 'effects.eqPresets', label: 'EQ Preset' },
            { kind: 'toggle', path: 'effects.spatialAudio', label: 'Spatial Audio', pref: true },
          ],
        },
      ],
    },
    {
      id: 'mic',
      icon: 'mic',
      title: 'Mic',
      sections: [
        {
          label: 'Array',
          fields: [{ kind: 'spec', from: 'mic', rows: [['arrayCount', 'Microphones']] }],
        },
        {
          label: 'Processing',
          fields: [
            { kind: 'toggle', path: 'mic.aiDenoise', label: 'AI Denoise', pref: true },
            { kind: 'toggle', path: 'mic.beamforming', label: 'Beamforming', pref: true },
          ],
        },
      ],
    },
  ],

  // ── Notebook I/O ─────────────────────────────────────────────────────────
  'notebook-io': [
    {
      id: 'connectivity',
      icon: 'bluetooth',
      title: 'Connectivity',
      sections: [
        {
          label: 'Wireless',
          fields: [
            {
              kind: 'spec',
              from: 'wireless',
              rows: [
                ['wifi', 'Wi-Fi'],
                ['bluetooth', 'Bluetooth'],
              ],
            },
          ],
        },
        { label: 'Ports', fields: [{ kind: 'tags', path: 'io' }] },
      ],
    },
  ],

  // ── Notebook display ─────────────────────────────────────────────────────
  'notebook-display': [
    {
      id: 'display',
      icon: 'brightness',
      title: 'Display',
      sections: [
        {
          label: 'Panel',
          fields: [
            {
              kind: 'spec',
              from: 'panel',
              rows: [
                ['size', 'Size'],
                ['resolution', 'Resolution'],
                ['refreshRate', 'Refresh rate', ' Hz'],
                ['responseTime', 'Response'],
                ['panel', 'Panel type'],
              ],
            },
          ],
        },
        {
          label: 'Brightness',
          fields: [{ kind: 'slider', label: 'Brightness', init: 80, suffix: '%' }],
        },
      ],
    },
    {
      id: 'color',
      icon: 'color-palette',
      title: 'Color',
      sections: [
        {
          label: 'Picture',
          fields: [
            { kind: 'toggle', path: 'color.hdr', label: 'HDR', pref: true },
            { kind: 'dropdown', path: 'color.presets', label: 'Picture Preset' },
          ],
        },
        {
          label: 'Gamut',
          fields: [
            { kind: 'dropdown', path: 'color.gamuts', label: 'Color Gamut' },
            {
              kind: 'spec',
              from: 'calibration',
              rows: [
                ['factoryCalibrated', 'Factory calibrated'],
                ['deltaE', 'Delta E', ' max'],
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'comfort',
      icon: 'sun',
      title: 'Comfort',
      sections: [
        {
          label: 'Eye comfort',
          fields: [
            { kind: 'toggle', path: 'comfort.blueLightFilter', label: 'Blue Light Filter', pref: true },
            { kind: 'toggle', path: 'comfort.adaptiveBrightness', label: 'Adaptive Brightness', pref: true },
          ],
        },
        {
          label: 'Panel',
          fields: [{ kind: 'toggle', path: 'comfort.flickerFree', label: 'Flicker-Free', pref: true }],
        },
      ],
    },
  ],

  // ── Desktop GPU ──────────────────────────────────────────────────────────
  'desktop-gpu': [
    {
      id: 'overview',
      icon: 'details',
      title: 'Overview',
      sections: [
        {
          label: 'Graphics',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['model', 'Model'],
                ['vramGB', 'VRAM', ' GB'],
              ],
            },
          ],
        },
        {
          label: 'Physical',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['tdpW', 'TDP', ' W'],
                ['lengthMm', 'Length', ' mm'],
              ],
            },
          ],
        },
        { label: 'Display outputs', fields: [{ kind: 'tags', path: 'outputs' }] },
      ],
    },
    zoneLightingTab(),
  ],

  // ── Desktop CPU cooling ──────────────────────────────────────────────────
  'desktop-cpu-cooling': [
    {
      id: 'cooling',
      icon: 'thermometer',
      title: 'Cooling',
      sections: [
        {
          label: 'Radiator',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['kind', 'Type'],
                ['radiatorMm', 'Radiator', ' mm'],
                ['fanCount', 'Fans'],
              ],
            },
          ],
        },
        {
          label: 'Pump',
          fields: [{ kind: 'slider', label: 'Pump Speed', path: 'pumpRpmMax', shape: 'max', ratio: 0.6, suffix: ' RPM' }],
        },
      ],
    },
    zoneLightingTab(),
  ],

  // ── Desktop RAM ──────────────────────────────────────────────────────────
  'desktop-ram': [
    {
      id: 'overview',
      icon: 'details',
      title: 'Overview',
      sections: [
        {
          label: 'Memory',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['capacityGB', 'Capacity', ' GB'],
                ['channels', 'Channels'],
              ],
            },
          ],
        },
        {
          label: 'Timing',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['speedMTs', 'Speed', ' MT/s'],
                ['cas', 'CAS latency'],
              ],
            },
            { kind: 'toggle', path: 'xmp', label: 'XMP Profile', pref: true },
          ],
        },
      ],
    },
    zoneLightingTab(),
  ],

  // ── Desktop PSU ──────────────────────────────────────────────────────────
  'desktop-psu': [
    {
      id: 'overview',
      icon: 'bolt',
      title: 'Overview',
      sections: [
        {
          label: 'Output',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['wattage', 'Wattage', ' W'],
                ['efficiency', 'Efficiency'],
              ],
            },
          ],
        },
        {
          label: 'Build',
          fields: [
            {
              kind: 'spec',
              cap: true,
              rows: [
                ['modular', 'Modular'],
                ['atxRevision', 'ATX revision'],
              ],
            },
          ],
        },
      ],
    },
  ],

  // ── Desktop lighting controller ──────────────────────────────────────────
  'desktop-lighting': [
    {
      id: 'lighting',
      icon: 'lights',
      title: 'Lighting',
      sections: [
        {
          label: 'Effect',
          fields: [{ kind: 'dropdown', path: 'effects.presets', label: 'Effect' }],
        },
        {
          label: 'Channels',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['fanChannels', 'Fan channels'],
                ['argbZones', 'ARGB zones'],
                ['ecosystem', 'Ecosystem'],
              ],
            },
          ],
        },
        {
          label: 'Brightness',
          fields: [{ kind: 'slider', label: 'Brightness', init: 80, suffix: '%' }],
        },
      ],
    },
  ],

  // ── Notebook (the parent system) ─────────────────────────────────────────
  notebook: [
    {
      id: 'system',
      icon: 'details',
      title: 'System',
      sections: [
        {
          label: 'Capabilities',
          fields: [
            {
              kind: 'spec',
              rows: [
                ['overclocking', 'Overclocking'],
                ['vaporChamber', 'Vapor chamber'],
                ['tobiiEyeTracking', 'Tobii eye tracking'],
              ],
            },
          ],
        },
        {
          label: 'Battery',
          fields: [
            {
              kind: 'spec',
              from: 'battery',
              rows: [
                ['capacityWh', 'Capacity', ' Wh'],
                ['fastCharge', 'Fast charge'],
              ],
            },
          ],
        },
        {
          label: 'Graphics',
          fields: [{ kind: 'dropdown', path: 'graphics.switcher', label: 'Graphics Mode', cap: true }],
        },
      ],
    },
    {
      id: 'power',
      icon: 'bolt',
      title: 'Power',
      sections: [{ label: 'Power mode', fields: [{ kind: 'dropdown', path: 'powerModes', label: 'Power Mode' }] }],
    },
    {
      id: 'io',
      icon: 'bluetooth',
      title: 'Connectivity',
      sections: [{ label: 'Ports', fields: [{ kind: 'tags', path: 'io' }] }],
    },
  ],

  // ── Desktop (the parent system) ──────────────────────────────────────────
  desktop: [
    {
      id: 'power',
      icon: 'bolt',
      title: 'Power',
      sections: [{ label: 'Power mode', fields: [{ kind: 'dropdown', path: 'powerModes', label: 'Power Mode' }] }],
    },
    {
      id: 'io',
      icon: 'bluetooth',
      title: 'Connectivity',
      sections: [{ label: 'Ports', fields: [{ kind: 'tags', path: 'io' }] }],
    },
  ],
};

// ══════════════════════════════════════════════════════════════════════════
// Interpretation — reading a SKU's features through the schema. Lives here
// rather than in SpecCanvas so `deviceTabs` (and therefore the board widget's
// shortcuts) applies exactly the same visibility rules the canvas renders by.
// ══════════════════════════════════════════════════════════════════════════

/**
 * Walk a dot-path. `gated` is true when an *ancestor* was `false` — i.e. the
 * whole feature group is switched off for this SKU (`ai: false`), which is a
 * different thing from a leaf that is simply off (`naturalScrolling: false`).
 */
export function read(features: Features, path: string): { v: any; gated: boolean } {
  let cur: any = features;
  for (const part of path.split('.')) {
    if (cur === false) return { v: undefined, gated: true };
    if (cur == null) return { v: undefined, gated: false };
    cur = cur[part];
  }
  return { v: cur, gated: false };
}

/** Title-case a token value ("mission-control" → "Mission Control"). */
export function cap(s: unknown): string {
  return String(s)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function present(v: any): boolean {
  return v != null && v !== false && !(Array.isArray(v) && v.length === 0);
}

/** Render a fact value: booleans read as Yes, numbers get thousands + units. */
export function formatValue(v: any, suffix = '', capValues = false): string {
  if (v === true) return 'Yes';
  if (Array.isArray(v)) return v.map((x) => (capValues ? cap(x) : String(x))).join(', ');
  if (typeof v === 'number') return v.toLocaleString() + suffix;
  return (capValues ? cap(v) : String(v)) + suffix;
}

/** Dropdown options from a `string[]` or a `{id,label}[]` (power modes). */
export function toOptions(list: any[], capLabels = false): { label: string; value: string }[] {
  return list.map((item) =>
    item && typeof item === 'object'
      ? { label: String(item.label ?? item.id), value: String(item.id ?? item.label) }
      : { label: capLabels ? cap(item) : String(item), value: String(item) },
  );
}

/** The key/value rows a `spec` field resolves to (empty = nothing to show). */
export function specItems(
  features: Features,
  def: Extract<SpecFieldDef, { kind: 'spec' }>,
): { label: string; value: string }[] {
  const base = def.from ? read(features, def.from) : { v: features, gated: false };
  if (base.gated || !base.v || typeof base.v !== 'object') return [];
  const obj = base.v as Features;
  return def.rows
    .filter(([key]) => present(obj[key]))
    .map(([key, label, suffix]) => ({ label, value: formatValue(obj[key], suffix ?? '', def.cap) }));
}

export function fieldVisible(features: Features, def: SpecFieldDef): boolean {
  switch (def.kind) {
    case 'spec':
      return specItems(features, def).length > 0;
    case 'toggle': {
      const { v, gated } = read(features, def.path);
      if (gated) return false;
      // Preferences exist whenever the key does (and may be off); capabilities
      // only when the hardware actually has them.
      return def.pref ? v != null : v === true;
    }
    case 'dropdown':
    case 'tags': {
      const { v, gated } = read(features, def.path);
      return !gated && Array.isArray(v) && v.length > 0;
    }
    case 'slider': {
      if (!def.path) return true;
      const { v, gated } = read(features, def.path);
      if (gated) return false;
      return def.shape === 'max' ? typeof v === 'number' && v > 0 : !!v && typeof v === 'object';
    }
  }
}

export const sectionVisible = (f: Features, s: SpecSectionDef) => s.fields.some((d) => fieldVisible(f, d));
export const tabVisible = (f: Features, t: SpecTabDef) => t.sections.some((s) => sectionVisible(f, s));

/** Human label for a SKU `type` — the canvas status chip and hero fallback. */
export const TYPE_LABEL: Record<string, string> = {
  notebook: 'Notebook',
  desktop: 'Desktop',
  'notebook-webcam': 'Webcam',
  'notebook-trackpad': 'Trackpad',
  'notebook-audio': 'Notebook Audio',
  'notebook-io': 'Notebook I/O',
  'notebook-display': 'Notebook Display',
  'desktop-gpu': 'Graphics Card',
  'desktop-cpu-cooling': 'CPU Cooling',
  'desktop-ram': 'Memory',
  'desktop-psu': 'Power Supply',
  'desktop-lighting': 'Lighting Controller',
};

/** Hero-fallback glyph when a component SKU has no product photo. */
export const TYPE_ICON: Record<string, IconName> = {
  notebook: 'devices',
  desktop: 'devices',
  'notebook-webcam': 'camera-video',
  'notebook-trackpad': 'swipe',
  'notebook-audio': 'volume-up',
  'notebook-io': 'bluetooth',
  'notebook-display': 'brightness',
  'desktop-gpu': 'performance',
  'desktop-cpu-cooling': 'thermometer',
  'desktop-ram': 'grid',
  'desktop-psu': 'bolt',
  'desktop-lighting': 'lights',
};
