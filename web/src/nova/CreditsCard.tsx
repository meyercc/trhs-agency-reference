import type { ReactNode } from 'react';
import { useNova } from '../state/Nova';
import { useSettings } from '../state/Settings';
import { Avatar, Badge, ListItem, Separator } from '../components';
import { GAMES } from '../data/games';
import { CREDITS_BY_ID, DEPARTMENT_LABEL, alsoOwned, castOf, crewOf, initialsOf, type Person } from '../data/credits';
import { askAbout } from './whoMadeThis';
import './recap.css';

/** What a credits card shows: one game's cast, its crew, both, or the placed summary. */
export interface CreditsRef {
  /** A `GAME_CREDITS` entry's game id (data/credits.ts). */
  gameId: string;
  /** `summary` is the placed version — a widget, the HUD. */
  section?: 'all' | 'cast' | 'crew' | 'summary';
}

export interface CreditsCardProps extends CreditsRef {
  /** Without its own frame — inside a widget or the HUD, whose shell is the frame. */
  bare?: boolean;
}

/**
 * A person as a pressable row: a monogram (no headshots — these are real
 * people and we hold no rights to any), the name, their part, and what links
 * them to the rest of your library. The row is the control, so it is a
 * button, keyboard and all; the follow-up it asks is the row's label.
 */
export function PersonRow({ person, role, gameId, onAsk, compact }: { person: Person; role: string; gameId: string; onAsk: (p: Person) => void; compact?: boolean }) {
  const owned = alsoOwned(person, gameId);
  const others = person.credits.filter((c) => c.gameId !== gameId).length;
  const trailing = compact ? undefined : owned.length ? (
    // Words, not a tone: the link is said, not coloured.
    <Badge variant="status" tone="info">Also in {owned[0].title}</Badge>
  ) : others ? (
    <span className="ds-text-caption nova-recap-dim">+{others} {others === 1 ? 'game' : 'games'}</span>
  ) : undefined;
  return (
    <ListItem
      className="nova-credits-row"
      role="button"
      aria-label={askAbout(person)}
      leading={<Avatar variant="initials" initials={initialsOf(person.name)} />}
      label={person.name}
      description={role}
      trailing={trailing}
      data-person={person.id}
      onClick={() => onAsk(person)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAsk(person);
        }
      }}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nova-recap-section">
      <h4 className="ds-text-overline nova-recap-h">{title}</h4>
      {children}
    </section>
  );
}

/**
 * Who Made This's card (docs/who-made-this-demo-plan.md), rendered in a Nova
 * reply from an `agent-card` record. The shell is Catch Me Up's recap
 * (`.nova-recap*`, recap.css): the recipes' cards are one family — a cover,
 * an identity line, sections.
 *
 * Pressing a person asks the agent about them. In a reply Nova is already
 * open; on the board (`bare`) the card pins Nova first, as the refund rows do.
 */
export function CreditsCard({ gameId, section = 'all', bare }: CreditsCardProps) {
  const { send } = useNova();
  const { setNovaPinned } = useSettings();
  const c = CREDITS_BY_ID[gameId];
  const game = GAMES.find((g) => g.id === gameId);
  if (!c || !game) return null;
  const cast = castOf(gameId);
  const crew = crewOf(gameId);
  const crewCount = crew.reduce((n, g) => n + g.rows.length, 0);
  const onAsk = (p: Person) => {
    if (bare) setNovaPinned(true);
    send(askAbout(p));
  };
  const castRows = (rows: typeof cast, compact?: boolean) => (
    <div className="nova-credits-list" role="list">
      {rows.map(({ person, role }) => (
        <div key={person.id} role="listitem">
          <PersonRow person={person} role={role} gameId={gameId} onAsk={onAsk} compact={compact} />
        </div>
      ))}
    </div>
  );
  const crewSections = crew.map((g) => (
    <Section key={g.dept} title={DEPARTMENT_LABEL[g.dept]}>
      {castRows(g.rows)}
    </Section>
  ));
  const names = (dept: string) => crew.find((g) => g.dept === dept)?.rows.map((r) => r.person.name) ?? [];
  return (
    <article className={'nova-recap' + (bare ? ' bare' : '')} aria-label={`${game.title} cast and crew`} data-credits={gameId} data-section={section}>
      <header className="nova-recap-head">
        {game.art && <img className="nova-recap-cover" src={game.art} alt="" />}
        <div className="nova-recap-id">
          <h3 className="ds-text-label strong nova-recap-title">{game.title}</h3>
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {c.year} · {game.studio}
          </p>
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {cast.length} {cast.length === 1 ? 'voice' : 'voices'} · {crewCount} crew
          </p>
        </div>
      </header>
      {section === 'summary' ? (
        // The placed version (a widget, the HUD): the top two of the bill and
        // one line of crew, so it fits two board rows as the other recipes'
        // placed cards do — the whole list stays in the conversation.
        <>
          <Separator />
          {castRows(cast.slice(0, 2), true)}
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {[names('direction').length ? `Directed by ${names('direction').join(', ')}` : '', names('music').length ? `Music by ${names('music').join(', ')}` : ''].filter(Boolean).join(' · ')}
          </p>
        </>
      ) : section === 'cast' ? (
        <>
          <Separator />
          <Section title={DEPARTMENT_LABEL.cast}>{castRows(cast)}</Section>
        </>
      ) : section === 'crew' ? (
        <>
          <Separator />
          {crewSections}
        </>
      ) : (
        <>
          <Separator />
          <Section title={DEPARTMENT_LABEL.cast}>{castRows(cast)}</Section>
          <Separator />
          {crewSections}
        </>
      )}
    </article>
  );
}
