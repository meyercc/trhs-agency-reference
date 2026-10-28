// ── Personalize › the profile band ───────────────────────────────────────────
// The one thing at the top of the page that you cannot move: which profile the
// desk is wearing, why, and the way back. It replaces two things that used to
// say half of this each — the context strip (what Treehouse detected) and the
// Profiles card grid (which profiles exist).
//
// The page below IS the active profile: every control on it writes to this
// profile (the band's own claim, and the tiles' "Saved to …"). So the band
// carries the profile's identity and its rules, and the page carries its
// contents — NGENUITY's "Profile Details", but live and editable.
//
// One rule for anything automatic (NGENUITY research, Sept 30 2026):
//   · the profile's OWN rules — Game Link, Schedule — act, and say so, with Undo
//   · anything Treehouse only guessed asks first
import { useSearchParams } from 'react-router-dom';
import type React from 'react';
import { Button, Icon, Tile, TileLink } from '../../components';
import { useProfiles, type Profile } from '../../state/Profiles';
import { useSettings } from '../../state/Settings';
import { profileImageSrc } from '../../app/profileImage';
import { INITIAL_GAMES } from '../../modals/omenAiGames';
import { scenarioById } from './model';
import { usePersonalize } from './state';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 23:00 → "11:00 PM". */
const clock12 = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** [1,2,3,4,5] → "Weekdays"; all seven → "Every day"; otherwise the days, in week order. */
function dayWords(days: number[]): string {
  const d = [...days].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  if (d.join() === '0,6') return 'Weekends';
  return d.map((i) => DAY_SHORT[i]).join(', ');
}

const gameTitle = (id: string) => INITIAL_GAMES.find((g) => g.id === id)?.title ?? id;

/**
 * When this profile turns on by itself, in one line — its Game Link and its
 * Schedule. A profile with neither is not broken: it waits to be picked.
 */
export function triggerLine(p: Profile): string {
  const bits: string[] = [];
  if (p.gameLink.enabled && p.gameLink.gameIds.length) {
    const [first, second, ...rest] = p.gameLink.gameIds.map(gameTitle);
    bits.push(`Turns on for ${[first, second].filter(Boolean).join(', ')}${rest.length ? ` +${rest.length}` : ''}`);
  }
  if (p.schedule.enabled && p.schedule.days.length && p.schedule.start !== p.schedule.end) {
    bits.push(`${dayWords(p.schedule.days)} ${clock12(p.schedule.start)}–${clock12(p.schedule.end)}`);
  }
  return bits.length ? bits.join(' · ') : 'Turns on only when you pick it';
}

export function ProfileBand() {
  const p = usePersonalize();
  const { profiles, activeProfile, source } = useProfiles();
  const { isLight } = useSettings();
  const [, setParams] = useSearchParams();

  const openManage = (profileId?: string) =>
    setParams((prev) => {
      // Keep whatever else is in the URL (the devices flyout, a context).
      const next = new URLSearchParams(prev);
      next.set('modal', 'profiles');
      if (profileId) next.set('profile', profileId);
      else next.delete('profile');
      return next;
    });

  const scenario = scenarioById(p.scenario);
  const auto = p.autoSwitch && p.autoSwitch.to === activeProfile.id ? p.autoSwitch : null;
  const ask = p.ask;
  const askTo = ask ? profiles.find((pr) => pr.id === ask.to) : undefined;

  // Why this profile is on — said only when something other than you put it
  // on (Kristy, 2026-10-14): "You picked this profile" told people what they
  // already knew. A question waiting for an answer takes the same place.
  const why = ask
    ? ask.question
    : auto?.reason
      ? auto.reason
      : source === 'game'
        ? 'Switched by Game Link'
        : source === 'schedule'
          ? 'Switched by your schedule'
          : null;

  // A game switched it: the game's art is the truest picture of why. Anything
  // else shows the profile's own photo.
  const art = auto?.via === 'game' && scenario.art ? scenario.art : profileImageSrc(activeProfile.image, isLight);

  return (
    <Tile
      row
      size="full"
      className={'qc-band' + (ask ? ' asking' : '')}
      state={ask ? 'suggested' : 'context'}
      style={{ '--qc-art': `url("${art}")` } as React.CSSProperties}
      media={<img src={art} alt="" />}
      // One line under the name: when it turns on by itself. The ⓘ is gone —
      // its note explained the Quick Controls ranking, which is gone too.
      title={
        <>
          <span className="qc-band-name">{activeProfile.name}</span>
          {why && <span className="qc-band-why">{why}</span>}
        </>
      }
      value={<span className="qc-band-when">{triggerLine(activeProfile)}</span>}
      // One way out of the band (Kristy 2026-10-07): the labelled library
      // Button, not chips for the other profiles plus icon-only add and gear.
      // Switching lives in the nav's profile switcher; adding, in the modal.
      actions={
        <Button size="sm" onClick={() => openManage(activeProfile.id)}>
          <Icon name="settings" size={14} aria-hidden /> Manage Profiles
        </Button>
      }
    >
      {ask && askTo ? (
        <span className="qc-band-answer" role="group" aria-label="Answer">
          <Button variant="accent" size="sm" onClick={() => p.acceptAsk()}>
            Switch to {askTo.name}
          </Button>
          {ask.linkGame && (
            <Button size="sm" onClick={() => p.acceptAsk(true)} title={`Link ${ask.linkGame.title} to ${askTo.name}, so it switches by itself next time`}>
              Always for {ask.linkGame.title}
            </Button>
          )}
          <TileLink onClick={p.dismissAsk}>Not now</TileLink>
        </span>
      ) : auto ? (
        <TileLink icon="undo" onClick={p.undoAutoSwitch} title={`Go back to ${p.modeName(auto.from)}`}>
          Undo · back to {p.modeName(auto.from)}
        </TileLink>
      ) : undefined}
    </Tile>
  );
}
