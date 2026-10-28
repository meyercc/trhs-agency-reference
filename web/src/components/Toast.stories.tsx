import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Toast, ToastStack } from './Toast';

const meta: Meta<typeof Toast> = {
  title: 'Components/Toast',
  component: Toast,
  args: { title: 'Profile applied', message: 'Night City is active for Cyberpunk 2077.', onClose: () => {} },
  argTypes: {
    tone: { control: 'inline-radio', options: ['default', 'positive', 'warn', 'danger'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A transient message the app raises: something happened, or is about to, that you did not ask for. ' +
          'Title and message wrap; actions are Buttons; the tone rides on the leading bar and the icon. ' +
          '`role="status"` — announced politely, never takes focus. Host one `ToastStack` per app (AppShell). ' +
          'Avalonia: a WindowNotificationManager notification with a ControlTheme per tone.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Toast>;

export const Default: Story = { args: { icon: 'notification' } };
export const Warn: Story = {
  args: {
    tone: 'warn',
    icon: 'hourglass',
    title: '15 minutes left to refund Monster Hunter Wilds',
    message: 'You have played 1 h 45 min of the 2 hours Steam allows.',
    actions: (
      <>
        <Button size="sm" variant="accent">
          Open
        </Button>
        <Button size="sm" variant="ghost">
          Keep playing
        </Button>
      </>
    ),
  },
};
export const Positive: Story = { args: { tone: 'positive', icon: 'check', title: 'Refund requested', message: 'Steam will reply by email.' } };
export const Danger: Story = { args: { tone: 'danger', icon: 'alert', title: 'The refund window has closed', message: 'Monster Hunter Wilds passed 2 hours played.' } };
export const NoClose: Story = { args: { onClose: undefined, icon: 'notification' } };

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--gutter-xs)', justifyItems: 'start' }}>
      <Toast icon="notification" title="Default" message="The accent tone." onClose={() => {}} />
      <Toast tone="positive" icon="check" title="Positive" message="Done, and it worked." onClose={() => {}} />
      <Toast tone="warn" icon="hourglass" title="Warn" message="About to happen; you can still act." actions={<Button size="sm">Act</Button>} onClose={() => {}} />
      <Toast tone="danger" icon="alert" title="Danger" message="It happened and cannot be undone." onClose={() => {}} />
    </div>
  ),
};

/** In its stack — the fixed region bottom-right that AppShell hosts. */
export const InStack: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ minHeight: '60vh' }}>
      <ToastStack>
        <Toast icon="notification" title="Profile applied" message="Night City is active." onClose={() => {}} />
        <Toast tone="warn" icon="hourglass" title="15 minutes left to refund" actions={<Button size="sm" variant="accent">Open</Button>} onClose={() => {}} />
      </ToastStack>
    </div>
  ),
};
