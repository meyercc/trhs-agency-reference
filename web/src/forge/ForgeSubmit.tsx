import { useState } from 'react';
import { Badge, Button, Icon } from '../components';
import type { ForgeType } from './types';

const TYPES: [ForgeType, string, string][] = [
  ['recipe', 'Recipe', 'Plain-language instructions. Write it in the guided form, no files needed.'],
  ['skill', 'Skill', 'A recipe plus tools that act on the PC or accounts. Needs a GitHub repository.'],
  ['app', 'App', 'A full application with its own window. Needs a GitHub repository.'],
  ['assistant', 'Assistant', 'A ready-made assistant built from recipes and skills.'],
];
const article = (t: ForgeType) => (t === 'app' ? 'an app' : t === 'assistant' ? 'an assistant' : `a ${t}`);

/**
 * "Submit to Forge" — the partner portal's front door, as a pane inside Forge
 * rather than a modal on a modal. The human sign-offs are marked with a badge
 * and named, not only tinted, so the checkpoints read without color.
 */
export function ForgeSubmit({ onBack }: { onBack: () => void }) {
  const [type, setType] = useState<ForgeType>('recipe');
  const [started, setStarted] = useState(false);
  const step = (text: string, signer?: string) => (
    <li>
      {text}
      {signer && (
        <>
          {' '}
          · <b>{signer} signs off</b>
          <Badge variant="status" tone="info">
            Human checkpoint
          </Badge>
        </>
      )}
    </li>
  );
  return (
    <div className="fg-detail">
      <button type="button" className="fg-back" onClick={onBack}>
        <Icon name="chevron-left" size={14} aria-hidden /> Forge
      </button>
      <div className="fg-eyebrow">Forge Partner Portal</div>
      <h2 className="fg-detail-name">Submit to Forge</h2>
      <p className="fg-prose dim" style={{ marginTop: 'var(--gutter-xs)' }}>
        Any registered company can publish on Forge. Choose what you’re submitting; we’ll walk you through the rest.
      </p>
      <div className="fg-types" role="group" aria-label="What are you submitting?">
        {TYPES.map(([id, name, help]) => (
          <button
            key={id}
            type="button"
            className="fg-type"
            aria-pressed={type === id}
            onClick={() => {
              setType(id);
              setStarted(false);
            }}
          >
            <b>{name}</b>
            <span>{help}</span>
          </button>
        ))}
      </div>
      <h3 className="fg-section-label">What happens next</h3>
      <ol className="fg-steps">
        {step('Sign in with your HP account and choose an organization account')}
        {step('Verify your legal entity', 'Partner Ops')}
        {step('Third-party risk assessment', 'Vendor Risk')}
        {step('Agreements, privacy and content policy', 'Legal')}
        {step(`Give Forge read-only access to your GitHub repository${type === 'recipe' ? ' (skipped for recipes written in the form)' : ''}`)}
        {step('Automated security review of all code', 'Trust & Safety')}
        {step('Signing and store listing', 'Store Release')}
        {step('After launch: re-scan on every update, player reports and votes')}
      </ol>
      <p className="fg-note">
        <Icon name="info" size={14} aria-hidden />
        <span>Automation does the checking and recommends; a person makes each decision at every human checkpoint.</span>
      </p>
      <div className="fg-actions" style={{ marginTop: 'var(--gutter)' }}>
        <Button variant="accent" onClick={() => setStarted(true)}>
          <Icon name="upload" size={14} aria-hidden /> Start {article(type)} submission
        </Button>
        {started && (
          <span className="fg-hint" role="status">
            Prototype: submission started. The portal itself is not part of this build.
          </span>
        )}
      </div>
    </div>
  );
}
