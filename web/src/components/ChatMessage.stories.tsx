import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Slider } from './Slider';
import { FanCurve } from './FanCurve';

const meta: Meta<typeof ChatMessage> = {
  title: 'Molecules/ChatMessage',
  component: ChatMessage,
  parameters: {
    docs: {
      description: {
        component:
          'One turn of a conversation. The user sits right on the accent wash, the assistant left on the surface; a streaming reply shows typing dots until text arrives; actions are chips under the reply that do the thing again. Avalonia: a ContentControl with a ControlTheme keyed on Role and a Status visual state.',
      },
    },
  },
  args: { role: 'assistant', name: 'Nova', children: 'Power modes are what the profiles carry. Gaming runs the chips at full tilt and lets the fans follow.' },
  argTypes: {
    role: { control: 'inline-radio', options: ['user', 'assistant'] },
    status: { control: 'inline-radio', options: [undefined, 'streaming', 'error'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(640px, 92vw)', display: 'flex', flexDirection: 'column', gap: 'var(--gutter-sm)' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ChatMessage>;

export const Assistant: Story = {};
export const User: Story = { args: { role: 'user', name: 'You', children: 'Power modes' } };
export const WithMeta: Story = { args: { meta: 'Thermal Warden · 2h ago · estimated' } };
export const Streaming: Story = { args: { status: 'streaming', children: undefined } };
export const StreamingWithText: Story = { args: { status: 'streaming', children: 'Switched to Gaming. You will see it in the switcher' } };
export const Error: Story = {
  args: { status: 'error', children: 'I tried the local model and could not reach it.', meta: 'Not connected' },
};
export const WithActions: Story = {
  args: {
    actions: (
      <>
        <Chip icon={<Icon name="profile" size="sm" />}>Switch to Gaming</Chip>
        <Chip icon={<Icon name="performance" size="sm" />}>Open Performance</Chip>
      </>
    ),
  },
};
export const WithAvatar: Story = { args: { avatar: <Icon name="twinkle" size="sm" />, meta: 'Nova · Just now' } };

/** A live control inside the bubble (TH-437): the `controls` slot, framed with the device and its value; `wide` lets it take the column. */
export const WithControls: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [level, setLevel] = useState(80);
    const [preset, setPreset] = useState('gaming');
    return (
      <ChatMessage
        role="assistant"
        name="Nova"
        avatar={<Icon name="twinkle" size="sm" />}
        meta="Nova · Just now"
        wide
        controls={
          <>
            <div className="ds-live-control">
              <div className="ds-live-control-head">
                <span className="ds-live-control-title">Treehouse 32 brightness</span>
                <span className="ds-live-control-value">{level}%</span>
              </div>
              <Slider value={level} onChange={setLevel} aria-label="Brightness for the Treehouse 32" />
            </div>
            <div className="ds-live-control">
              <div className="ds-live-control-head">
                <span className="ds-live-control-title">HyperX Cloud III equalizer</span>
                <span className="ds-live-control-value">{preset}</span>
              </div>
              <div className="ds-live-control-chips" role="radiogroup" aria-label="Equalizer preset">
                {['balanced', 'gaming', 'bassboost'].map((id) => (
                  <Chip key={id} role="radio" aria-checked={preset === id} selected={preset === id} onClick={() => setPreset(id)}>
                    {id}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="ds-live-control">
              <div className="ds-live-control-head">
                <span className="ds-live-control-title">Fan curve</span>
                <span className="ds-live-control-value">32% at 60°C</span>
              </div>
              <FanCurve onChange={() => {}} liveTemp={60} />
            </div>
          </>
        }
        actions={<Chip icon={<Icon name="performance" size="sm" />}>Open Performance</Chip>}
      >
        Brightness is per display, and the slider here is the display’s own.
      </ChatMessage>
    );
  },
};

/** A short exchange — user right, assistant left, the newest at the bottom. */
export const Conversation: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <ChatMessage role="user" name="You">
        Overlay
      </ChatMessage>
      <ChatMessage role="assistant" name="Nova" avatar={<Icon name="twinkle" size="sm" />} meta="Nova · Just now">
        The in-game overlay is the corner readout — frame rate, temperatures, and whichever vitals you pin.
      </ChatMessage>
      <ChatMessage role="user" name="You">
        Can you keep it under 35 dB tonight?
      </ChatMessage>
      <ChatMessage role="assistant" name="Thermal Warden" avatar={<Icon name="thermometer" size="sm" />} status="streaming" />
    </>
  ),
};
