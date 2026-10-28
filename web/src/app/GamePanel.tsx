import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, Disclosure, GameTile, Icon, IconButton, ListItem, Ng3Field, Ng3Label, Toggle } from '../components';
import { GAMES } from '../data/games';
import { useGalleryFor } from '../pages/GallerySection';
import { SectionHeader } from '../pages/SectionHeader';
import { useGameActions, type GameAction } from '../agents/gameActions';
import { useCollections } from '../state/Collections';
import { useModules } from '../state/Modules';
import { useLaunchGame } from '../state/launchGame';
import { takeGamePanelOpener } from './gamePanelRequest';
import './game-panel.css';

/**
 * `inert` while closed (TH-505): a rail slid off-screen must not take focus or
 * clicks — `aria-hidden` alone left its buttons in the tab order. React 18 has
 * no typing for it, so it goes on as the attribute.
 */
export const inertWhen = (closed: boolean) => (closed ? ({ inert: '' } as Record<string, string>) : {});

/** How many collections show before "Show all" (Chris, 2026-10-26). */
const COLLECTIONS_SHOWN = 3;

const fmtDate = (iso: string) => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));

/**
 * The game detail panel (TH-504, docs/game-panel.md; Figma scratchpad-2026
 * 274:10305): one game's hub in the right rail, the Devices flyout's slot —
 * `?game=<id>` opens it (gamePanelRequest.ts), AppShell holds the rail.
 *
 * Top to bottom: the cover blurred behind the tile and the title; Play; the
 * collections holding the game (three, then Show all); the gallery's images
 * of it, the header opening the gallery; Info, collapsed; and the Actions the
 * installed modules and the added agents bring for THIS game
 * (agents/gameActions.ts) — rows, not buttons, each one gone with its owner.
 * The body scrolls (`.ds-panel-body`); the header does not.
 */
export function GamePanel({ open, gameId, onClose }: { open: boolean; gameId: string | null; onClose: () => void }) {
  const game = gameId ? GAMES.find((g) => g.id === gameId) : undefined;
  const navigate = useNavigate();
  const launch = useLaunchGame();
  const collections = useCollections();
  const actions = useGameActions(game);
  const { has: installed } = useModules();
  const [showAll, setShowAll] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A new game starts folded again.
  useEffect(() => setShowAll(false), [gameId]);
  // Focus goes to the panel on open and back to what opened it on close —
  // the Devices flyout does neither; this one is reached from a tile.
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else takeGamePanelOpener()?.focus();
  }, [open]);
  // An id the catalog does not know: nothing to show, and the param goes.
  useEffect(() => {
    if (open && gameId && !game) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameId, game]);

  if (!game) return <aside className={'ds-panel game-panel' + (open ? ' open' : '')} aria-label="Game details" aria-hidden={!open} {...inertWhen(!open)} />;

  const cols = collections.of(game.id);
  const shownCols = showAll ? cols : cols.slice(0, COLLECTIONS_SHOWN);
  const thumbs = useGalleryFor(game.id);
  const play = () => launch(game.id);
  // The library shows that collection (PlayLibrary reads `?collection=`, TH-505).
  const openCollection = (id: string) => navigate(`/play?collection=${id}`);
  // The gallery's page of this game (GallerySection reads `?gallery=`, TH-505).
  const openGallery = () => navigate(`/play?section=gallery&gallery=${game.id}`);
  const press = (a: GameAction) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      a.onPress();
    }
  };

  return (
    <aside className={'ds-panel game-panel' + (open ? ' open' : '')} aria-label={`${game.title} details`} aria-hidden={!open} {...inertWhen(!open)} data-game={game.id}>
      <header className="gp-hero">
        {game.art && <img className="gp-hero-art" src={game.art} alt="" />}
        <div className="gp-hero-scrim" aria-hidden="true" />
        <button ref={closeRef} type="button" className="ds-panel-close gp-close" onClick={onClose} title="Close" aria-label="Close">
          <Icon name="close" />
        </button>
        <div className="gp-hero-id">
          <GameTile className="gp-hero-tile" size="sm" cover={game.art} playable={false} aria-label={`Play ${game.title}`} onClick={play} />
          <div className="gp-hero-text">
            <h2 className="ds-text-label strong gp-title">{game.title}</h2>
            {/* Info is folded by default, so the two facts that place the game
                stay in view; the studio is in Info (it clipped at this width). */}
            <p className="ds-text-caption gp-caption">
              {game.genre} · {game.released.slice(0, 4)}
            </p>
          </div>
        </div>
      </header>

      <div className="ds-panel-body gp-body">
        <Button variant="accent" block className="gp-play" onClick={play}>
          <Icon name="play-fill" size={16} />
          Play
        </Button>

        <section className="gp-section" aria-label="Collections">
          <SectionHeader label="Collections" />
          {cols.length ? (
            <div className="gp-chips">
              {shownCols.map((c) => (
                <Chip key={c.id} onClick={() => openCollection(c.id)} data-collection={c.id}>
                  {c.name}
                </Chip>
              ))}
              {!showAll && cols.length > COLLECTIONS_SHOWN && (
                <Chip onClick={() => setShowAll(true)} aria-label={`Show all ${cols.length} collections`}>
                  Show all
                </Chip>
              )}
            </div>
          ) : (
            <p className="ds-text-caption gp-empty">Not in a collection</p>
          )}
        </section>

        {/* The gallery is a module: uninstalled, it leaves no section behind. */}
        {installed('gallery') && (
        <section className="gp-section" aria-label="Gallery">
          {/* The chevron is the control; a pointer on the row opens the gallery too. */}
          <div className="gp-row-link" onClick={openGallery}>
            <SectionHeader
              label="Gallery"
              action={
                <IconButton
                  variant="ghost"
                  label="Open gallery"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGallery();
                  }}
                >
                  <Icon name="chevron-right" size={16} />
                </IconButton>
              }
            />
          </div>
          {thumbs.length ? (
            <div className="gp-thumbs">
              {thumbs.map((t) =>
                t.src ? (
                  <img key={t.key} className="gp-thumb" src={t.src} alt={t.alt} loading="lazy" />
                ) : (
                  <div key={t.key} className="gp-thumb" role="img" aria-label={t.alt} style={t.style} />
                ),
              )}
            </div>
          ) : (
            <p className="ds-text-caption gp-empty">No captures yet</p>
          )}
        </section>
        )}

        <Disclosure title="Info" density="compact" className="gp-info" data-section="info">
          {/* Stacked, as the Figma draws them: a caps label over its value. The
              side-by-side spec row wrapped its values at this width. */}
          <div className="gp-facts">
            {[
              ['Genre', game.genre],
              ['Release date', fmtDate(game.released)],
              ['Developer', game.studio],
              ['Publisher', game.publisher ?? '—'],
            ].map(([label, value]) => (
              <Ng3Field key={label} className="gp-fact">
                <Ng3Label>{label}</Ng3Label>
                <span className="ds-text-body gp-fact-value">{value}</span>
              </Ng3Field>
            ))}
          </div>
        </Disclosure>

        {actions.length > 0 && (
          <section className="gp-section" aria-label="Actions">
            <SectionHeader label="Actions" />
            <div className="gp-actions">
              {actions.map((a) =>
                a.kind === 'toggle' ? (
                  <ListItem
                    key={a.id}
                    className="gp-action"
                    role="switch"
                    aria-checked={!!a.checked}
                    leading={<Icon name={a.icon} size={16} />}
                    label={a.label}
                    description={a.description}
                    // The row is the switch — one stop, one name; the Toggle is its face.
                    trailing={
                      <Toggle
                        checked={!!a.checked}
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          a.onPress();
                        }}
                      />
                    }
                    data-action={a.id}
                    onClick={a.onPress}
                    onKeyDown={press(a)}
                  />
                ) : (
                  <ListItem
                    key={a.id}
                    className="gp-action"
                    role="button"
                    leading={<Icon name={a.icon} size={16} />}
                    label={a.label}
                    description={a.description}
                    trailing={<Icon name="chevron-right" size={16} />}
                    data-action={a.id}
                    onClick={a.onPress}
                    onKeyDown={press(a)}
                  />
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
