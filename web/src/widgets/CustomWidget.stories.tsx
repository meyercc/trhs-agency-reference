import type { Meta, StoryObj } from '@storybook/react';
import { withAppProviders } from '../../.storybook/AppProviders';
import { CustomWidget } from './CustomWidget';
import { cardMeta } from './cardMeta';
import type { CardSpec, OverlayItem } from '../state/overlays';
import { useVitalsStream } from '../modals/vitalsData';
import './board.css';
import './widgets.css';

const meta: Meta<typeof CustomWidget> = {
  title: 'Organisms/Custom Widget',
  component: CustomWidget,
  decorators: [withAppProviders],
  parameters: {
    docs: {
      source: { type: 'code' },
      description: {
        component:
          'A widget Nova composes from a request (TH-443): a titled list of live readings, ' +
          'bound controls and app panels (TH-450), rendered on the board. It is the same `CardSpec` an overlay is built ' +
          'from and the same `OverlayItems` renderer the HUD uses — one spec reads the same in ' +
          'both homes. There is no new component and no new `.ds-` class: the chassis is ' +
          '`WidgetShell`, which is also where the board’s drag handle lives, so a composed ' +
          'card drags, resizes and slots by exactly the code that moves every other widget. ' +
          '`cardMeta` derives the footprint from the spec — metrics lay out 2-up, a control takes ' +
          'the full width, and past two tile-rows the card needs the board’s second row.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CustomWidget>;

const card = (title: string, items: OverlayItem[]): CardSpec => ({ id: `card-${title}`, title, items, createdAt: 0 });

/** At the real board footprint `cardMeta` gives it, so the proportions are the board's. */
function OnBoard({ spec }: { spec: CardSpec }) {
  const stream = useVitalsStream(true);
  const m = cardMeta(spec);
  return (
    <div className="wb-grid" style={{ width: 'min(1080px, 100%)' }}>
      <div className="wb-cell" style={{ gridColumn: `span ${m.span}`, gridRow: `span ${m.rows}` }}>
        <CustomWidget spec={spec} stream={stream} />
      </div>
    </div>
  );
}

/** Two readings, one tile-row — the smallest card a request produces. */
export const TwoReadings: Story = {
  render: () => <OnBoard spec={card('FPS + GPU temp', [{ kind: 'metric', metric: 'fps' }, { kind: 'metric', metric: 'gpu-temp' }])} />,
};

/** Four readings: two tile-rows, still one board row. */
export const FourReadings: Story = {
  render: () => (
    <OnBoard
      spec={card('Load + heat', [
        { kind: 'metric', metric: 'cpu' },
        { kind: 'metric', metric: 'gpu' },
        { kind: 'metric', metric: 'cpu-temp' },
        { kind: 'metric', metric: 'gpu-temp' },
      ])}
    />
  ),
};

/**
 * With a bound control. It is the same `LiveControl` a Nova reply carries, so
 * changing power mode here changes it everywhere — and it takes the full width,
 * which is what pushes this card onto the board's second row.
 */
export const WithAControl: Story = {
  render: () => (
    <OnBoard
      spec={card('Gameplay Monitor', [
        { kind: 'metric', metric: 'fps' },
        { kind: 'metric', metric: 'cpu-temp' },
        { kind: 'metric', metric: 'gpu-temp' },
        { kind: 'control', control: 'power-mode' },
      ])}
    />
  ),
};

/**
 * Bound audio (TH-450). The headset’s volume and the microphone’s monitor mix,
 * each the same `useProfileValue` key its device window edits — so a change
 * here lands in the active profile’s bag for that device. The balance reads as
 * its two sides, not as a percentage.
 */
export const BoundAudio: Story = {
  render: () => (
    <OnBoard
      spec={card('Headset & mic', [
        { kind: 'control', control: 'volume' },
        { kind: 'control', control: 'mic-mix' },
      ])}
    />
  ),
};

/** Three recent games as rows — `RECENT`, the list Jump Back In reads. One row is one tile-row. */
export const RecentGames: Story = {
  render: () => <OnBoard spec={card('Recent games', [{ kind: 'block', block: 'recent-games', count: 3 }])} />,
};

/** Two deals, priced by `dealsOf` — the same list the Deals widget and the Shop page show. */
export const Deals: Story = {
  render: () => <OnBoard spec={card('Deals', [{ kind: 'block', block: 'deals', count: 2 }])} />,
};

/** Nova’s three ledger totals as compact tiles, flowing 2-up beside a reading. */
export const Tokenomics: Story = {
  render: () => <OnBoard spec={card('Nova cost + FPS', [{ kind: 'block', block: 'tokenomics' }, { kind: 'metric', metric: 'fps' }])} />,
};

/** Nova in a card: the last reply and a field that sends to the active conversation. */
export const NovaChat: Story = {
  render: () => <OnBoard spec={card('Nova', [{ kind: 'block', block: 'nova-chat' }])} />,
};

/** The desk’s lights, bound to `Settings.underGlow` — the same value the monitor window edits. */
export const Lights: Story = {
  render: () => <OnBoard spec={card('Lights', [{ kind: 'control', control: 'lights' }])} />,
};

// ── Registry-bound items (TH-452) ─────────────────────────────────────────────
// Every item below is `{ kind: 'bound' }`: a row of `state/bindings.ts` plus how
// it is shown. The same six forms the model may choose from in Phase A.

/** A writable value shown as a slider (the default) and as a read-only tile — the model's one form freedom in Phase A. */
export const BoundSliderAndTile: Story = {
  render: () => (
    <OnBoard
      spec={card('Volume two ways', [
        { kind: 'bound', bind: 'volume' },
        { kind: 'bound', bind: 'volume', as: 'tile' },
        { kind: 'bound', bind: 'fps' },
      ])}
    />
  ),
};

/** The level meter (`vu`) and the two-sided balance, both profile-bound. */
export const BoundMeters: Story = {
  render: () => <OnBoard spec={card('Mic levels', [{ kind: 'bound', bind: 'mic-gain', as: 'vu' }, { kind: 'bound', bind: 'mic-mix' }])} />,
};

/** Switches: a Settings key and a profile key, in the same row shape. */
export const BoundToggles: Story = {
  render: () => <OnBoard spec={card('Switches', [{ kind: 'bound', bind: 'eco-mode' }, { kind: 'bound', bind: 'sidetone' }])} />,
};

/**
 * Choices, sized by option count: three options are a toggle group, seven are
 * chips. The options come off the real device’s SKU data at render.
 */
export const BoundChoices: Story = {
  render: () => <OnBoard spec={card('Choices', [{ kind: 'bound', bind: 'power-mode' }, { kind: 'bound', bind: 'polling-rate' }])} />,
};

/** Readings beyond the original six: clocks, memory, network and a drive, all from the one vitals stream. */
export const BoundReadings: Story = {
  render: () => (
    <OnBoard
      spec={card('More readings', [
        { kind: 'bound', bind: 'cpu-speed' },
        { kind: 'bound', bind: 'gpu-clock' },
        { kind: 'bound', bind: 'ram-used' },
        { kind: 'bound', bind: 'net-down' },
        { kind: 'bound', bind: 'drive-c-used' },
        { kind: 'bound', bind: 'vram-used' },
      ])}
    />
  ),
};

/** The read-only forms a reading can take (TH-454): a dial, a level bar, the last two minutes as a line. */
export const BoundGraphs: Story = {
  render: () => (
    <OnBoard
      spec={card('Graphs', [
        { kind: 'bound', bind: 'cpu-temp', as: 'gauge' },
        { kind: 'bound', bind: 'gpu', as: 'gauge' },
        { kind: 'bound', bind: 'cpu', as: 'meter' },
        { kind: 'bound', bind: 'ram', as: 'sparkline' },
      ])}
    />
  ),
};
