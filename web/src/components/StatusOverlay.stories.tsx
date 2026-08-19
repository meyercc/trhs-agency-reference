import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { StatusOverlay } from './StatusOverlay';
import { Ng3Section, Ng3Row, Ng3Label, Ng3Field } from './Ng3Section';
import { Toggle } from './Toggle';
import { Slider } from './Slider';
import { Dropdown } from './Dropdown';

const meta: Meta<typeof StatusOverlay> = {
  title: 'Molecules/StatusOverlay',
  component: StatusOverlay,
  parameters: {
    docs: {
      description: {
        component:
          'A message centred over a region, explaining the state of what is underneath it — why a ' +
          'group of controls is unavailable, why a list is empty. It floats above the region rather ' +
          'than displacing it, so the content stays visible and the explanation cannot be missed. ' +
          'The box wraps to as many lines as it needs and keeps one radius either way: a pill at ' +
          'single-line height, a rounded rect once the text wraps. The parent must establish a ' +
          'positioning context. Figma scratchpad-2026 100:19379 / 100:25239. ' +
          'Avalonia: a Border in the adorner layer with the status container brush.',
      },
    },
  },
  argTypes: {
    icon: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof StatusOverlay>;

/** A host region for the overlay to sit over. */
function Region({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width, background: 'var(--ksg-b20)', padding: 'var(--gutter-xs)' }}>
      <div style={{ opacity: 0.4 }}>
        <Ng3Section>
          <Ng3Label strong info>
            Presets
          </Ng3Label>
          <Ng3Field>
            <Ng3Label plain>Effect</Ng3Label>
            <Dropdown
              aria-label="Effect"
              defaultValue="wave"
              options={[
                { label: 'Wave', value: 'wave' },
                { label: 'Rainbow', value: 'rainbow' },
              ]}
            />
          </Ng3Field>
          <Ng3Row>
            <Ng3Label plain>Reactive layer</Ng3Label>
            <Toggle defaultChecked aria-label="Reactive layer" />
          </Ng3Row>
          <Slider defaultValue={60} aria-label="Blend" />
        </Ng3Section>
      </div>
      {children}
    </div>
  );
}

/** Wide region — the box stays on one line and reads as a pill. */
export const SingleLine: Story = {
  args: { icon: 'lock-on', children: 'Software Only — an onboard slot stores one static color set, not a preset library' },
  render: (args) => (
    <Region width={720}>
      <StatusOverlay {...args} />
    </Region>
  ),
};

/** Narrow region — the same box wraps into a rounded rect. Same radius. */
export const MultiLine: Story = {
  args: { icon: 'lock-on', children: 'Software Only — curve presets are applied by Treehouse, not the headset' },
  render: (args) => (
    <Region width={300}>
      <StatusOverlay {...args} />
    </Region>
  ),
};

/** The message is not only for capability locks. */
export const OtherStates: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Region width={340}>
        <StatusOverlay icon="info">Connect a device to configure lighting</StatusOverlay>
      </Region>
      <Region width={340}>
        <StatusOverlay icon="alert">OMEN AI is not installed</StatusOverlay>
      </Region>
    </div>
  ),
};

export const BothWidths: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Region width={640}>
        <StatusOverlay icon="lock-on">
          Software Only — an onboard slot stores one static color set, not a preset library
        </StatusOverlay>
      </Region>
      <Region width={280}>
        <StatusOverlay icon="lock-on">
          Software Only — curve presets are applied by Treehouse, not the headset
        </StatusOverlay>
      </Region>
    </div>
  ),
};
