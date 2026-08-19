import './jy-work.css';

// ── JY's Work (#/jy) — an independent index of Juntao's Perform work ──
// A single directory page that references every piece of the Perform redesign
// work, kept deliberately SEPARATE from the base app: this is one added file +
// one added route, nothing of Chris's is touched. Pulling `main` can never
// overwrite this line of work, and this page never overwrites the base app —
// the two stay fully independent. Links are plain hash routes so there is no
// coupling to the shell's navigation.

interface Item {
  href: string;
  title: string;
  tag: string;
  tone: 'final' | 'variant' | 'lab';
  blurb: string;
}

// Interactive prototypes (running routes).
const PROTOTYPES: Item[] = [
  {
    href: '#/perform-v5',
    title: 'Perform V5',
    tag: 'Final',
    tone: 'final',
    blurb:
      'The stab. Three posture domains; the card anatomy (title + door · status reading · actions), three modal templates, the controlled vocabularies, soft governance + wayfinding, and the growth grammar — all on one running page.',
  },
  {
    href: '#/perform-v6',
    title: 'Perform V6',
    tag: 'Variant',
    tone: 'variant',
    blurb:
      'Reading-forms study over the V5 baseline: each card declares one hero reading (Metric / Level / Facts) fit to its data — the answer to “consistent, not monotonous.”',
  },
  {
    href: '#/perform-v4',
    title: 'Perform V4',
    tag: 'Lineage',
    tone: 'variant',
    blurb: 'Layout-grammar iteration: marks carry governance, the envelope anchors its row.',
  },
  {
    href: '#/perform-v3',
    title: 'Perform V3',
    tag: 'Lineage',
    tone: 'variant',
    blurb: 'IA-spec preview — OMEN AI at the top level, the three forms.',
  },
  {
    href: '#/perform-v2',
    title: 'Perform V2',
    tag: 'Lineage',
    tone: 'variant',
    blurb: 'First parallel redesign — the OGH audit reorganization.',
  },
  {
    href: '#/card-lab',
    title: 'Card Lab',
    tag: 'Lab',
    tone: 'lab',
    blurb: 'Living specimens of the card typology: slots, interaction archetypes, label grammar, states, size ladder, commit footers.',
  },
  {
    href: '#/modal-lab',
    title: 'Modal Lab',
    tag: 'Lab',
    tone: 'lab',
    blurb: 'The modal side as living specimens: anatomy, the left-rail trial, row grammar, stacking, the registry.',
  },
];

// Written work (repo files — reference paths, not routes).
const DOCS: { path: string; blurb: string }[] = [
  { path: 'docs/perform-v5-decision-log.md', blurb: 'Every V5 decision, as rules (R1–R14) + per-feature receipts + the ask/homework split.' },
  { path: 'docs/design-decision-records.md', blurb: 'Architecture register — P1–P8 principles with rationale + the open-question ledger.' },
  { path: 'docs/card-modal-scalability-report.md', blurb: 'The long report both labs draw from — card & modal laws with named precedent.' },
  { path: 'docs/modal-registry.md', blurb: 'Code-grounded inventory of every modal surface + violations + rules.' },
  { path: 'docs/omen-ai-2.0-requirements.md', blurb: 'OMEN AI 2.0 scope — umbrella + Gaming / Per-game dimensions.' },
  { path: 'card-schema.jsonc', blurb: 'The card contract as machine-readable data; validated by scripts/audit-cards.mjs.' },
];

function Card({ item }: { item: Item }) {
  return (
    <a className={'jyw-card jyw-card--' + item.tone} href={item.href}>
      <div className="jyw-card-head">
        <span className="jyw-card-title">{item.title}</span>
        <span className={'jyw-tag jyw-tag--' + item.tone}>{item.tag}</span>
      </div>
      <p className="jyw-card-blurb">{item.blurb}</p>
      <span className="jyw-card-go" aria-hidden="true">Open →</span>
    </a>
  );
}

export function JYWork() {
  return (
    <div className="jyw-root">
      <header className="jyw-hero">
        <p className="jyw-eyebrow">Directory</p>
        <h1 className="jyw-title">JY&rsquo;s Work</h1>
        <p className="jyw-sub">
          An index of the Perform redesign work — kept independent of the base app. Everything here is additive;
          nothing of the original prototype is modified.
        </p>
      </header>

      <section className="jyw-section">
        <h2 className="jyw-section-title">Prototypes</h2>
        <div className="jyw-grid">
          {PROTOTYPES.map((it) => (
            <Card item={it} key={it.href} />
          ))}
        </div>
      </section>

      <section className="jyw-section">
        <h2 className="jyw-section-title">Written work</h2>
        <ul className="jyw-docs">
          {DOCS.map((d) => (
            <li className="jyw-doc" key={d.path}>
              <code className="jyw-doc-path">{d.path}</code>
              <span className="jyw-doc-blurb">{d.blurb}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
