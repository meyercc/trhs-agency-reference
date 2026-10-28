import type { ReactNode } from 'react';
import { Badge, Separator } from '../components';
import { CATCH_UP_BY_ID, daysAway, type CatchUpEntry } from '../data/catchUp';
import { GAMES } from '../data/games';
import './recap.css';

/** What a recap shows (TH-478): one game's catch-up, whole or just the build. */
export interface RecapRef {
  /** A `CATCH_UP` entry's game id (data/catchUp.ts). */
  gameId: string;
  /** `summary` is the placed version — a widget, the HUD (2026-10-20). */
  section?: 'all' | 'build' | 'summary';
}

export interface RecapCardProps extends RecapRef {
  /** Without its own frame — inside a widget or the HUD, whose shell is the frame (2026-10-20). */
  bare?: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nova-recap-section">
      <h4 className="ds-text-overline nova-recap-h">{title}</h4>
      {children}
    </section>
  );
}

function Build({ e }: { e: CatchUpEntry }) {
  return (
    <Section title="You were built for">
      <p className="ds-text-label strong nova-recap-p">{e.build.name}</p>
      <p className="ds-text-body nova-recap-p nova-recap-dim">{e.build.summary}</p>
    </Section>
  );
}

/** The updates since the last session. `onlyBuild` keeps the ones that touch the build. */
function Changes({ e, onlyBuild }: { e: CatchUpEntry; onlyBuild?: boolean }) {
  const rows = onlyBuild ? e.changes.filter((c) => c.affectsBuild) : e.changes;
  return (
    <Section title="While you were away">
      {rows.length ? (
        <ul className="nova-recap-changes">
          {rows.map((c) => (
            <li key={c.id} className="nova-recap-change">
              <div className="nova-recap-change-head">
                <span className="ds-text-label strong">{c.title}</span>
                {/* The badge carries words, so the row never relies on its colour. */}
                {c.affectsBuild && <Badge variant="new">Affects your build</Badge>}
              </div>
              <p className="ds-text-body nova-recap-p nova-recap-dim">{c.impact}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-text-body nova-recap-p nova-recap-dim">No updates you haven&rsquo;t played on.</p>
      )}
    </Section>
  );
}

/**
 * Catch Me Up's recap (TH-478), rendered in a Nova reply from a `recap`
 * control record. Rebuilt from the fixture on every render, like the other
 * control kinds, so a reopened conversation shows what the game's entry says.
 *
 * Spoiler-safe by construction: it renders only fields that stop at `marker`,
 * and says so up front in the badge. `section="build"` is the follow-up —
 * the build and the updates that touched it, nothing else.
 */
export function RecapCard({ gameId, section = 'all', bare }: RecapCardProps) {
  const e = CATCH_UP_BY_ID[gameId];
  const game = GAMES.find((g) => g.id === gameId);
  if (!e || !game) return null;
  return (
    <article className={'nova-recap' + (bare ? ' bare' : '')} aria-label={`${game.title} recap`} data-recap={gameId} data-section={section}>
      <header className="nova-recap-head">
        {game.art && <img className="nova-recap-cover" src={game.art} alt="" />}
        <div className="nova-recap-id">
          <h3 className="ds-text-label strong nova-recap-title">{game.title}</h3>
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {daysAway(e)} days away · {e.hours} h played
          </p>
          <Badge variant="status" tone="positive" className="nova-recap-marker">
            Spoiler-safe · up to {e.marker}
          </Badge>
        </div>
      </header>
      {section === 'summary' ? (
        // The placed version (a widget, the HUD): where you were and what is
        // next, and the updates in one line — the story and the build stay in
        // the conversation, where there is room to read them.
        <>
          <Separator />
          <Section title="Where you were">
            <p className="ds-text-label strong nova-recap-p">{e.location}</p>
            <p className="ds-text-body nova-recap-p nova-recap-dim">Next: {e.nextObjective}</p>
          </Section>
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {e.changes.length === 0
              ? 'No updates since you last played.'
              : `${e.changes.length} ${e.changes.length === 1 ? 'update' : 'updates'} since you last played${e.changes.some((c) => c.affectsBuild) ? ' · one affects your build' : ''}.`}
          </p>
        </>
      ) : section === 'build' ? (
        <>
          <Separator />
          <Build e={e} />
          <Separator />
          <Changes e={e} onlyBuild />
        </>
      ) : (
        <>
          <Separator />
          <Section title="Story so far">
            {e.storySoFar.map((p, i) => (
              <p key={i} className="ds-text-body nova-recap-p">
                {p}
              </p>
            ))}
          </Section>
          <Separator />
          <Build e={e} />
          <Separator />
          <Section title="Where you were">
            <p className="ds-text-label strong nova-recap-p">{e.location}</p>
            <p className="ds-text-body nova-recap-p nova-recap-dim">Next: {e.nextObjective}</p>
          </Section>
          <Separator />
          <Changes e={e} />
        </>
      )}
    </article>
  );
}
