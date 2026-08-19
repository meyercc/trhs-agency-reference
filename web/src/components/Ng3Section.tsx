import React, { type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * NG3 panel section primitives — the shared vocabulary of every device-panel
 * tab body (mouse / keyboard / headset canvases): a layout row of bordered
 * sections, mono-caps labels, label↔control rows and stacked fields. Thin
 * wrappers over `.ds-ng3-grid` / `-col` / `-section` / `-label` / `-row` /
 * `-field` in shared/components.css, so surface, borders and gaps are defined
 * exactly once.
 *
 * Avalonia: an ItemsControl row of Borders (section = Border with the panel
 * section brush/thickness), labels as a TextBlock style, rows/fields as
 * DockPanel/StackPanel resource templates.
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

function div(base: string) {
  return function Ng3Div({ className, children, ...rest }: DivProps) {
    return (
      <div className={[base, className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </div>
    );
  };
}

/** Tab-body layout row of sections/columns. Gap sourced from `.ds-ng3-grid`. */
export const Ng3Grid = div('ds-ng3-grid');
/** Column of stacked sections inside an `Ng3Grid`. */
export const Ng3Col = div('ds-ng3-col');
/** The bordered sub-card every panel control group sits in. */
export const Ng3Section = div('ds-ng3-section');
/** Label ↔ control row (master toggles, inline settings). */
export const Ng3Row = div('ds-ng3-row');
/** Stacked label + control field. */
export const Ng3Field = div('ds-ng3-field');
/** Scroll region inside a fixed-height section — the sanctioned overflow valve. */
export const Ng3Scroll = div('ds-ng3-scroll');

export interface Ng3SpecItem {
  label: ReactNode;
  value: ReactNode;
}

/** Key/value spec rows (device facts: resolution, surround format, firmware…). */
export function Ng3Spec({ items, className, ...rest }: { items: Ng3SpecItem[] } & DivProps) {
  return (
    <div className={['ds-ng3-spec', className].filter(Boolean).join(' ')} {...rest}>
      {items.map((it, i) => (
        <div className="ds-ng3-spec-row" key={i}>
          <span className="ds-ng3-spec-key">{it.label}</span>
          <span className="ds-ng3-spec-val">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export interface Ng3LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** Emphasized (primary text) — the Figma section-title weight. */
  strong?: boolean;
  /**
   * Row label rather than a section title: sentence case, dim, matching the
   * spec-row key. Use for the label beside a toggle/control inside a section,
   * so the caps treatment stays reserved for the section header itself.
   */
  plain?: boolean;
  /** Show the trailing "(?)" info glyph. */
  info?: boolean;
}

/** Section label — mono caps by default, `plain` for a control-row label. */
export function Ng3Label({ children, strong, plain, info, className, ...rest }: Ng3LabelProps) {
  const classes = ['ds-ng3-label', strong ? 'strong' : '', plain ? 'plain' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...rest}>
      <span>{children}</span>
      {info && <Icon name="info" size={13} />}
    </span>
  );
}
