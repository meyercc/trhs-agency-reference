import { Avatar, Badge, ListItem, Separator } from '../components';
import { GAMES } from '../data/games';
import { PERSON_BY_ID, creditIn, filmography, initialsOf } from '../data/credits';
import './recap.css';

/** What a person card shows: one person's credits, the game they were asked about first. */
export interface PersonRef {
  /** A `PEOPLE` entry's id (data/credits.ts). */
  personId: string;
  /** The game the question came from — listed first, and named in the identity line. */
  from?: string;
}

/**
 * Who Made This's person card (docs/who-made-this-demo-plan.md): the
 * filmography, this game first, then newest first. A game the library carries
 * shows its cover and says so in words; one it does not shows an empty cover,
 * so the eye can still tell which rows are yours. Rows are not controls — the
 * reply's chips carry Play.
 */
export function PersonCard({ personId, from }: PersonRef) {
  const p = PERSON_BY_ID[personId];
  if (!p) return null;
  const here = from ? creditIn(p, from) : undefined;
  const rows = filmography(p, from);
  return (
    <article className="nova-recap" aria-label={`${p.name} credits`} data-person-card={personId}>
      <header className="nova-recap-head">
        <Avatar variant="initials" initials={initialsOf(p.name)} className="nova-credits-portrait" />
        <div className="nova-recap-id">
          <h3 className="ds-text-label strong nova-recap-title">{p.name}</h3>
          {here && (
            <p className="ds-text-caption nova-recap-p nova-recap-dim">
              {here.dept === 'cast' ? `${here.role} in ${here.title}` : `${here.role}, ${here.title}`}
            </p>
          )}
          {p.knownFor && <p className="ds-text-caption nova-recap-p nova-recap-dim">Also known for {p.knownFor}</p>}
        </div>
      </header>
      <Separator />
      <section className="nova-recap-section">
        <h4 className="ds-text-overline nova-recap-h">
          {rows.length} {rows.length === 1 ? 'game credit' : 'game credits'}
        </h4>
        <div className="nova-credits-list" role="list">
          {rows.map((c) => {
            const g = c.gameId ? GAMES.find((x) => x.id === c.gameId) : undefined;
            return (
              <ListItem
                key={`${c.title}-${c.role}`}
                className="nova-credits-row"
                role="listitem"
                tabIndex={undefined}
                leading={g?.art ? <img className="cb-cover cb-catchup-cover" src={g.art} alt="" /> : <span className="cb-cover cb-catchup-cover nova-credits-nocover" aria-hidden="true" />}
                label={c.title}
                description={`${c.role} · ${c.year}`}
                data-credit={c.gameId ?? ''}
                // One word, and only on the OTHER games you own: a longer badge,
                // or one on the row the header already names, took the title's
                // room in the pinned panel.
                trailing={c.gameId && c.gameId !== from ? <Badge variant="status" tone="positive">Owned</Badge> : undefined}
              />
            );
          })}
        </div>
      </section>
    </article>
  );
}
