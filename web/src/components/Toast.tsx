import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

export type ToastTone = 'default' | 'positive' | 'warn' | 'danger';

export interface ToastProps {
  title: string;
  message?: ReactNode;
  /** `default` is the accent. Carried by the leading bar and the icon. */
  tone?: ToastTone;
  icon?: IconName;
  /** Buttons — the toast's answers. Keep it to one or two. */
  actions?: ReactNode;
  /** Shows the close button; the toast does not dismiss itself. */
  onClose?: () => void;
  className?: string;
}

const TONE_CLASS: Record<ToastTone, string> = { default: '', positive: 'positive', warn: 'warn', danger: 'danger' };

/**
 * Thin wrapper over the design system's `.ds-toast` (shared/components.css): a
 * transient message the app raises — something happened, or is about to, that
 * you did not ask for. Title and message wrap; actions are Buttons.
 *
 * `role="status"`: it is announced politely, never stealing focus, so a toast
 * that arrives mid-game does not take the keyboard. Its actions are reachable
 * with Tab like anything else on the page.
 *
 * Avalonia: a `WindowNotificationManager` notification (or a Border in an
 * overlay ItemsControl) with a ControlTheme keyed on the tone.
 */
export function Toast({ title, message, tone = 'default', icon, actions, onClose, className }: ToastProps) {
  return (
    <div className={['ds-toast', TONE_CLASS[tone], className].filter(Boolean).join(' ')} role="status">
      {icon && (
        <span className="ds-toast-icon">
          <Icon name={icon} size={18} aria-hidden />
        </span>
      )}
      <div className="ds-toast-body">
        <div className="ds-toast-title">{title}</div>
        {message && <div className="ds-toast-msg">{message}</div>}
        {actions && <div className="ds-toast-actions">{actions}</div>}
      </div>
      {onClose && (
        <IconButton className="ds-toast-close" variant="ghost" label={`Dismiss: ${title}`} onClick={onClose}>
          <Icon name="close" size={14} />
        </IconButton>
      )}
    </div>
  );
}

/**
 * The fixed stack toasts sit in, bottom-right, above modals. One per app. It is
 * a polite live region, so each toast is announced as it arrives.
 */
export function ToastStack({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={['ds-toast-stack', className].filter(Boolean).join(' ')} aria-live="polite">
      {children}
    </div>
  );
}
