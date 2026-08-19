import type { Meta, StoryObj } from '@storybook/react';
import { SoftwareOnly, SoftwareOnlyProvider } from './SoftwareOnly';
import { Ng3Section, Ng3Row, Ng3Label, Ng3Field } from './Ng3Section';
import { Toggle } from './Toggle';
import { Slider } from './Slider';
import { Dropdown } from './Dropdown';

const meta: Meta<typeof SoftwareOnly> = {
  title: 'Molecules/SoftwareOnly',
  component: SoftwareOnly,
  parameters: {
    docs: {
      description: {
        component:
          'Marks controls the device cannot execute on its own, so they cannot be saved into an ' +
          'onboard (on-device) profile. When locked the region stays visible and readable but goes ' +
          'inert, and a centred `StatusOverlay` says why — a control that vanishes teaches nothing, ' +
          'whereas one that is visibly unavailable teaches the portability boundary. Locked is the ' +
          'only state that dims: a feature merely switched off keeps full color and stays operable. ' +
          'Lock state comes from a ' +
          '`SoftwareOnlyProvider` (a device panel sets it once per tab body) or from the `locked` ' +
          'prop, which wins. Avalonia: a ContentControl with a Locked visual state.',
      },
    },
  },
  argTypes: {
    locked: { control: 'boolean' },
    reason: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof SoftwareOnly>;

const LayeredLighting = () => (
  <Ng3Section>
    <Ng3Label strong info>
      Layered Effects
    </Ng3Label>
    <Ng3Field>
      <Ng3Label plain>Base layer</Ng3Label>
      <Dropdown
        aria-label="Base layer"
        defaultValue="wave"
        options={[
          { label: 'Wave', value: 'wave' },
          { label: 'Rainbow', value: 'rainbow' },
        ]}
      />
    </Ng3Field>
    <Ng3Row>
      <Ng3Label plain>Reactive top layer</Ng3Label>
      <Toggle defaultChecked aria-label="Reactive top layer" />
    </Ng3Row>
    <Ng3Row>
      <Ng3Label plain>Blend</Ng3Label>
      <span className="dc-mono-val">60%</span>
    </Ng3Row>
    <Slider defaultValue={60} aria-label="Blend" />
  </Ng3Section>
);

export const Unlocked: Story = {
  args: { locked: false },
  render: (args) => (
    <div style={{ width: 340 }}>
      <SoftwareOnly {...args}>
        <LayeredLighting />
      </SoftwareOnly>
    </div>
  ),
};

export const Locked: Story = {
  args: { locked: true, reason: 'needs Treehouse running to render the layers' },
  render: (args) => (
    <div style={{ width: 340 }}>
      <SoftwareOnly {...args}>
        <LayeredLighting />
      </SoftwareOnly>
    </div>
  ),
};

/** Side by side — the same panel in software scope and in an onboard slot. */
export const BothStates: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter)', alignItems: 'flex-start' }}>
      <div style={{ width: 320 }}>
        <p className="ds-text-label" style={{ marginBottom: 'var(--gutter-xs)' }}>
          Software profile
        </p>
        <SoftwareOnly locked={false}>
          <LayeredLighting />
        </SoftwareOnly>
      </div>
      <div style={{ width: 320 }}>
        <p className="ds-text-label" style={{ marginBottom: 'var(--gutter-xs)' }}>
          Onboard Slot 1
        </p>
        <SoftwareOnly locked reason="the keyboard can't render layers on its own">
          <LayeredLighting />
        </SoftwareOnly>
      </div>
    </div>
  ),
};

/** A provider locks every region beneath it — how the device panels use it. */
export const ViaProvider: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <SoftwareOnlyProvider locked>
      <div style={{ display: 'flex', gap: 'var(--gutter)', width: 700 }}>
        <SoftwareOnly reason="onboard slots store one static color set">
          <LayeredLighting />
        </SoftwareOnly>
        <Ng3Section>
          <Ng3Label strong info>
            Brightness
          </Ng3Label>
          <Slider defaultValue={80} aria-label="Brightness" />
          <Ng3Row>
            <Ng3Label plain>Saved to the device</Ng3Label>
            <Toggle defaultChecked aria-label="Saved to the device" />
          </Ng3Row>
        </Ng3Section>
      </div>
    </SoftwareOnlyProvider>
  ),
};
