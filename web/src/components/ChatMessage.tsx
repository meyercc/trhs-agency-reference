import React, { type ReactNode } from 'react';

export type ChatRole = 'user' | 'assistant';
export type ChatStatus = 'streaming' | 'error';

export interface ChatMessageProps extends Omit<React.HTMLAttributes<HTMLElement>, 'role'> {
  /** Who said it. `user` sits right with the accent wash; `assistant` sits left on the surface. */
  role: ChatRole;
  /** The speaker's name — the article's accessible name ("You", "Nova", an agent). */
  name: string;
  /** The message. Plain text keeps its line breaks. */
  children?: ReactNode;
  /** A line under the bubble: time, the agent that answered, "estimated". */
  meta?: ReactNode;
  /** `streaming` shows the typing dots (alone when there is no text yet); `error` marks the bubble. */
  status?: ChatStatus;
  /** Chips under the reply — the things it offers to do. */
  actions?: ReactNode;
  /** Live controls inside the bubble, under the text (TH-437). */
  controls?: ReactNode;
  /** Let the bubble take the full column — for a reply carrying a control that needs the width. */
  wide?: boolean;
  /** Leading avatar or icon for the assistant side. */
  avatar?: ReactNode;
}

const ROLE_CLASS: Record<ChatRole, string> = { user: 'user', assistant: 'assistant' };

/**
 * One turn of a conversation — the design system's `.ds-chat-msg`
 * (shared/components.css). The wrapper lays out avatar, bubble, meta and
 * actions and maps `role`/`status` to classes; the CSS owns the look.
 * Used by Nova; built as a system piece because a bubble recurs wherever an
 * agent is given a voice.
 *
 * Streaming is signalled by a text-free typing indicator, and by the status
 * class once text arrives — never by color alone. The article's accessible
 * name is the speaker, so a screen reader hears "Nova: …", "You: …".
 *
 * Avalonia: a ContentControl with a ControlTheme keyed on Role (alignment +
 * bubble brush) and a Status visual state for the typing indicator.
 */
export function ChatMessage({ role, name, children, meta, status, actions, controls, wide, avatar, className, ...rest }: ChatMessageProps) {
  const classes = ['ds-chat-msg', ROLE_CLASS[role], status ?? '', wide ? 'wide' : '', className].filter(Boolean).join(' ');
  const empty = children == null || children === '';
  return (
    <article className={classes} aria-label={name} aria-busy={status === 'streaming' || undefined} data-status={status} {...rest}>
      {avatar != null && <span className="ds-chat-msg-avatar">{avatar}</span>}
      <div className="ds-chat-msg-body">
        <div className="ds-chat-msg-bubble">
          {!empty && children}
          {controls != null && <div className="ds-chat-msg-controls">{controls}</div>}
          {status === 'streaming' && (
            <span className="ds-chat-msg-typing" aria-label={`${name} is typing`} role="status">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
        {meta != null && <div className="ds-chat-msg-meta">{meta}</div>}
        {actions != null && <div className="ds-chat-msg-actions">{actions}</div>}
      </div>
    </article>
  );
}
