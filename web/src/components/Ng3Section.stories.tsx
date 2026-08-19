import type { Meta, StoryObj } from '@storybook/react';
import { Ng3Grid, Ng3Col, Ng3Section, Ng3Row, Ng3Field, Ng3Label, Ng3Scroll, Ng3Spec } from './Ng3Section';
import { ListItem } from './ListItem';
import { Toggle } from './Toggle';
import { Slider } from './Slider';
import { Dropdown } from './Dropdown';

const meta: Meta<typeof Ng3Section> = {
  title: 'Molecules/Ng3Section',
  component: Ng3Section,
  parameters: {
    docs: {
      description: {
        component:
          'NG3 panel section primitives — the shared tab-body vocabulary of every device canvas ' +
          '(mouse / keyboard / headset): `Ng3Grid` layout row, `Ng3Col` stacks, bordered `Ng3Section` ' +
          'cards, mono-caps `Ng3Label`, `Ng3Row` label↔control rows and stacked `Ng3Field`s. ' +
          'Surface, border and gaps are defined once in `.ds-ng3-*` (shared/components.css). ' +
          'Avalonia: Borders with shared section brush + TextBlock/StackPanel styles.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Ng3Section>;

export const Section: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <Ng3Section>
        <Ng3Label strong info>
          Section Label
        </Ng3Label>
        <Slider defaultValue={60} aria-label="Example" />
      </Ng3Section>
    </div>
  ),
};

export const Labels: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gutter-xs)' }}>
      <Ng3Label>Default label</Ng3Label>
      <Ng3Label strong>Strong label</Ng3Label>
      <Ng3Label strong info>
        With info glyph
      </Ng3Label>
      <Ng3Label plain>Plain row label</Ng3Label>
    </div>
  ),
};

/**
 * The two levels inside one section: the caps title names the group, `plain`
 * row labels sit level with the spec keys beneath them.
 */
export const RowLabels: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 320 }}>
      <Ng3Section>
        <Ng3Label strong info>
          Privacy &amp; Sign-in
        </Ng3Label>
        <Ng3Row>
          <Ng3Label plain>Privacy Shutter</Ng3Label>
          <Toggle defaultChecked aria-label="Privacy shutter" />
        </Ng3Row>
        <Ng3Row>
          <Ng3Label plain>Windows Hello</Ng3Label>
          <Toggle defaultChecked aria-label="Windows Hello" />
        </Ng3Row>
        <Ng3Spec items={[{ label: 'IR sensor', value: 'Yes' }]} />
      </Ng3Section>
    </div>
  ),
};

export const Spec: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 320 }}>
      <Ng3Section>
        <Ng3Label strong>Display</Ng3Label>
        <Ng3Spec
          items={[
            { label: 'Size', value: '27"' },
            { label: 'Resolution', value: 'QHD' },
            { label: 'Refresh', value: '240 Hz' },
          ]}
        />
      </Ng3Section>
    </div>
  ),
};

// A long list scrolls inside its fixed-height section — panels never scroll whole.
export const ScrollRegion: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 320 }}>
      <Ng3Section style={{ height: 200 }}>
        <Ng3Label strong>Long List</Ng3Label>
        <Ng3Scroll>
          {Array.from({ length: 12 }, (_, i) => (
            <ListItem key={i} label={`Item ${i + 1}`} />
          ))}
        </Ng3Scroll>
      </Ng3Section>
    </div>
  ),
};

// A composed panel body — the shape every device tab uses.
export const PanelBody: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 720 }}>
      <Ng3Grid>
        <Ng3Col>
          <Ng3Section>
            <Ng3Label strong info>
              Volume
            </Ng3Label>
            <Slider defaultValue={62} aria-label="Volume" />
          </Ng3Section>
          <Ng3Section>
            <Ng3Row>
              <Ng3Label info>Mic Monitoring</Ng3Label>
              <Toggle aria-label="Mic monitoring" />
            </Ng3Row>
          </Ng3Section>
        </Ng3Col>
        <Ng3Section>
          <Ng3Row>
            <Ng3Label strong info>
              Master Toggle
            </Ng3Label>
            <Toggle aria-label="Master" />
          </Ng3Row>
          <Ng3Field>
            <Ng3Label>Preset</Ng3Label>
            <Dropdown
              aria-label="Preset"
              options={[
                { label: 'Gaming', value: 'gaming' },
                { label: 'Streaming', value: 'streaming' },
              ]}
            />
          </Ng3Field>
        </Ng3Section>
      </Ng3Grid>
    </div>
  ),
};
