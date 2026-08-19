import React from 'react';
import { Icon } from '../components';
import { KIND_META, type ChangelogEntry, type ChangeItem } from './changelog.data';
import './changelog.css';

/**
 * The Figma-style changelog table (Version | Date | Committer | Reviewer |
 * Notes) for the Storybook "Changelog" docs page. Storybook-only catalog
 * chrome — styles live in ./changelog.css (token-only), NOT in
 * shared/components.css, because this must never ship in the app.
 *
 * The root opts out of Storybook docs typography (`sb-unstyled`) and
 * establishes the dark token scope itself (`ds-theme-dark`) — standalone MDX
 * pages render outside the preview decorator that normally provides it.
 */

function StoryLink({ storyId, children }: { storyId?: string; children: React.ReactNode }) {
  if (!storyId) return <span className="sbdoc-changelog-name">{children}</span>;
  // `./?path=…` resolves against the Storybook root in dev, static builds and
  // the gh-pages /storybook/ subpath alike (a bare `?path=…` would resolve
  // against iframe.html). target="_top" navigates the manager, not the iframe.
  return (
    <a className="sbdoc-changelog-link" href={`./?path=/docs/${storyId}`} target="_top">
      {children}
    </a>
  );
}

function Item({ item }: { item: ChangeItem }) {
  return (
    <li>
      <StoryLink storyId={item.storyId}>{item.label}</StoryLink>
      {item.note && <> — {item.note}</>}
    </li>
  );
}

export function ChangelogTable({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div className="sb-unstyled ds-theme-dark sbdoc-changelog-root">
      <h1 className="sbdoc-changelog-title">Changelog</h1>
      <p className="sbdoc-changelog-intro">
        The design system&rsquo;s curated change history — what changed and what it means for
        consumers, release by release. The literal record stays in git.
      </p>
      <table className="sbdoc-changelog">
        <colgroup>
          <col className="sbdoc-changelog-col-version" />
          <col className="sbdoc-changelog-col-meta" />
          <col className="sbdoc-changelog-col-meta" />
          <col className="sbdoc-changelog-col-meta" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Version</th>
            <th scope="col">Date</th>
            <th scope="col">Committer</th>
            <th scope="col">Reviewer</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.version}>
              <td>
                <span className="sbdoc-changelog-version">v{entry.version}</span>
                {entry.tasks && <span className="sbdoc-changelog-tasks">{entry.tasks.join(' · ')}</span>}
              </td>
              <td>{entry.date}</td>
              <td>{entry.committer}</td>
              <td>{entry.reviewer ?? '—'}</td>
              <td className="sbdoc-changelog-notes">
                {entry.summary && <p className="sbdoc-changelog-summary">{entry.summary}</p>}
                {entry.groups.map((group) => (
                  <div className="sbdoc-changelog-kind" key={group.kind}>
                    <div className="sbdoc-changelog-kind-head">
                      <Icon name={KIND_META[group.kind].icon} size="sm" />
                      {KIND_META[group.kind].label}
                    </div>
                    {group.lead && <p className="sbdoc-changelog-lead">{group.lead}</p>}
                    {group.tiers.map((tg) => (
                      <div className="sbdoc-changelog-tier" key={tg.tier}>
                        <div className="sbdoc-changelog-tier-name">{tg.tier}</div>
                        {tg.lead && <p className="sbdoc-changelog-lead">{tg.lead}</p>}
                        <ul className="sbdoc-changelog-items">
                          {tg.items.map((item) => (
                            <Item key={item.label} item={item} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
