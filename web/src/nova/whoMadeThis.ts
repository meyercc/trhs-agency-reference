/**
 * Who Made This's scripts (docs/who-made-this-demo-plan.md) — built from the
 * credits fixture, because the reply is the game's: its cast, its crew, and
 * what else each of them has worked on.
 *
 * Every route is scripted and none carries `refine`, so a configured model is
 * never asked: a credit is a fact, and the model would invent one. Third in
 * `RECIPE_SCRIPTS`, after the two press demos. The matchers need a "who" or a
 * "what else" AND a game, a person or a character the fixture knows, so the
 * lines the other scripts own still reach them.
 */
import {
  CREDITS_BY_ID,
  HERO_CREDITS,
  alsoOwned,
  castOf,
  characterFor,
  creditIn,
  creditsFor,
  crewOf,
  filmography,
  personFor,
  type GameCredits,
  type Person,
} from '../data/credits';
import { agentCardStep, keepInViewOffers, recipeScript, titleOf } from '../agents/recipeKit';
import type { RecipeScripts } from '../agents/recipeScripts';
import type { CreditsRef } from './CreditsCard';
import type { PersonRef } from './PersonCard';
import type { NovaScript, ScriptStep } from './scripts';

export const WHO_MADE_THIS_AGENT = 'who-made-this';

/** The placed block's title — on the board and in the HUD. The suite asserts it. */
export const CREDITS_TITLE = 'Cast & crew';

/** "Who's in X", "who voices Y", "who else is in it". */
const CAST = /\b(who(?:'s| is| are|s)? (?:else )?in|who (?:voices?|voiced|plays?|played)|voice (?:cast|actors?)|(?:the )?cast of|who(?:'s| is) the voice)\b/i;
/** "Who made X" — the people, cast and crew: the hero rail's button sends this. */
const MADE = /\b(who (?:made|makes|developed|built|created)|(?:made|developed) by)\b/i;
/** "Who directed / composed / wrote X", "who's behind" — the crew alone. */
const CREW = /\b(who (?:directed|wrote|composed|scored|designed)|who(?:'s| is|s)? behind|(?:game )?directors? of|composers? of)\b/i;
/** "What else has X been in", "more from X", "who is X". */
const PERSON = /\b(what else|more from|other (?:games|work|roles)|who is|who was|been in|worked on|filmography|credits of|anything else)\b/i;
/** A follow-up that names no game means the one just discussed. */
const PRONOUN = /\b(it|this|that|the game|them)\b/i;

const T = 650;

const creditsStep = (props: CreditsRef, delay?: number) => agentCardStep(WHO_MADE_THIS_AGENT, 'credits', { ...props }, delay);
const personStep = (props: PersonRef, delay?: number) => agentCardStep(WHO_MADE_THIS_AGENT, 'person', { ...props }, delay);

/**
 * The game the conversation is about. "Who made it?" names no game, so it
 * means the one just discussed. Module state, as Catch Me Up's `lastRecapped`.
 */
let lastAbout: string = HERO_CREDITS.gameId;

const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');

/** "What else has Erica Lindbeck been in?" — the chip, and matched when typed. */
export const askAbout = (p: Person) => `What else has ${p.name} been in?`;
export const askCast = (gameId: string) => `Who's in ${titleOf(gameId)}?`;
export const askCrew = (gameId: string) => `Who made ${titleOf(gameId)}?`;

/**
 * The person worth a chip: the one also in a game you own, else the one with
 * the longest filmography — the row the card has most to say about.
 */
function featured(gameId: string, rows: { person: Person }[]): Person | null {
  const linked = rows.find((r) => alsoOwned(r.person, gameId).length);
  if (linked) return linked.person;
  return [...rows].sort((a, b) => b.person.credits.length - a.person.credits.length)[0]?.person ?? null;
}

/** "Jennifer English is also in Elden Ring, which you own." */
function ownedLine(gameId: string, rows: { person: Person }[]): string | null {
  const links = rows.flatMap((r) => alsoOwned(r.person, gameId).map((c) => `${r.person.name} is also in ${c.title}`));
  if (!links.length) return null;
  return `${list(links)}, which you own.`;
}

/**
 * Keep it in view (Chris, 2026-10-26): the compact cast & crew as a Home card
 * or an overlay over the game, holding the `credits` block with the GAME as
 * its subject. Minted once per reply.
 */
function keepOffers(gameId: string): ScriptStep[] {
  return keepInViewOffers([{ kind: 'bound', bind: 'credits', subject: gameId }], `${titleOf(gameId)} — ${CREDITS_TITLE}`);
}

/** "Who's in Cyberpunk 2077?" */
function castScript(g: GameCredits): NovaScript {
  const title = titleOf(g.gameId);
  const rows = castOf(g.gameId);
  const [a, b] = rows;
  const lead = a && b ? `${a.person.name} is ${a.role} and ${b.person.name} is ${b.role}.` : a ? `${a.person.name} is ${a.role}.` : '';
  const owned = ownedLine(g.gameId, rows);
  const star = featured(g.gameId, rows);
  return recipeScript(WHO_MADE_THIS_AGENT, `credits-cast-${g.gameId}`, `Who Made This read the ${title} voice cast`, [
    { say: `${title} (${g.year}) bills ${rows.length} voices in its main cast. ${lead} Press anyone to see what else they have been in.`, typing: T },
    creditsStep({ gameId: g.gameId, section: 'cast' }, 250),
    ...(owned ? [{ say: owned, delay: 250, typing: 400 } as ScriptStep] : []),
    { offer: { type: 'ask', text: askCrew(g.gameId) }, label: 'Who made it?', delay: 250 },
    ...(star ? [{ offer: { type: 'ask', text: askAbout(star) }, label: askAbout(star) } as ScriptStep] : []),
    ...keepOffers(g.gameId),
  ]);
}

/** "Marcin Przybyłowicz directed it, and the music is by …" — the crew in one sentence. */
function crewLine(g: GameCredits): string {
  const groups = crewOf(g.gameId);
  const names = (dept: string) => groups.find((x) => x.dept === dept)?.rows.map((r) => r.person.name) ?? [];
  const directors = names('direction');
  const music = names('music');
  const parts = [directors.length ? `${list(directors)} directed it` : '', music.length ? `the music is by ${list(music)}` : ''].filter(Boolean);
  return parts.length ? `${parts.join(', and ')}.` : '';
}

/** "Who made Cyberpunk 2077?" — the people: the cast, then the crew. */
function allScript(g: GameCredits): NovaScript {
  const title = titleOf(g.gameId);
  const cast = castOf(g.gameId);
  const crew = crewOf(g.gameId).flatMap((x) => x.rows);
  const [a, b] = cast;
  const voices = a && b ? `${a.person.name} is ${a.role} and ${b.person.name} is ${b.role}; ` : a ? `${a.person.name} is ${a.role}; ` : '';
  const made = crewLine(g);
  const owned = ownedLine(g.gameId, [...cast, ...crew]);
  const star = featured(g.gameId, [...cast, ...crew]);
  return recipeScript(WHO_MADE_THIS_AGENT, `credits-all-${g.gameId}`, `Who Made This read the ${title} credits`, [
    // No lowercasing after the semicolon: the crew sentence opens on a name.
    { say: `${title} (${g.year}). ${voices}${made} Here is everyone, cast first — press anyone to see what else they have been in.`, typing: T },
    creditsStep({ gameId: g.gameId, section: 'all' }, 250),
    ...(owned ? [{ say: owned, delay: 250, typing: 400 } as ScriptStep] : []),
    ...(star ? [{ offer: { type: 'ask', text: askAbout(star) }, label: askAbout(star), delay: 250 } as ScriptStep] : []),
    ...keepOffers(g.gameId),
  ]);
}

/** "Who directed Cyberpunk 2077?" — the crew alone. */
function crewScript(g: GameCredits): NovaScript {
  const title = titleOf(g.gameId);
  const rows = crewOf(g.gameId).flatMap((x) => x.rows);
  const lead = crewLine(g);
  const owned = ownedLine(g.gameId, rows);
  const star = featured(g.gameId, rows);
  return recipeScript(WHO_MADE_THIS_AGENT, `credits-crew-${g.gameId}`, `Who Made This read the ${title} crew`, [
    { say: `${title} (${g.year}) — ${lead} Here is who is behind it, by department, with their past work.`, typing: T },
    creditsStep({ gameId: g.gameId, section: 'crew' }, 250),
    ...(owned ? [{ say: owned, delay: 250, typing: 400 } as ScriptStep] : []),
    { offer: { type: 'ask', text: askCast(g.gameId) }, label: "Who's in it?", delay: 250 },
    ...(star ? [{ offer: { type: 'ask', text: askAbout(star) }, label: askAbout(star) } as ScriptStep] : []),
    ...keepOffers(g.gameId),
  ]);
}

/** "What else has Erica Lindbeck been in?" / "Who voices Johnny Silverhand?" */
function personScript(p: Person, from: string): NovaScript {
  const here = creditIn(p, from);
  const fromTitle = titleOf(from);
  const others = filmography(p, from).filter((c) => c !== here);
  const isCast = here?.dept === 'cast';
  const first = here ? (isCast ? `${p.name} is ${here.role} in ${fromTitle}.` : `${p.name} is the ${here.role.toLowerCase()} of ${fromTitle}.`) : `${p.name}.`;
  const elsewhere = others.length
    ? `Elsewhere: ${list(others.map((c) => (c.dept === 'cast' ? `${c.role} in ${c.title}` : `${c.role.toLowerCase()} of ${c.title}`)))}.`
    : `That is the only game credit I have for them.`;
  const known = p.knownFor ? ` Outside games you may know them from ${p.knownFor}.` : '';
  const owned = alsoOwned(p, from);
  const ownedSay = owned.length ? `${list(owned.map((c) => c.title))} ${owned.length === 1 ? 'is' : 'are'} in your library.` : null;
  return recipeScript(WHO_MADE_THIS_AGENT, `credits-person-${p.id}`, `Who Made This looked up ${p.name}`, [
    { say: `${first} ${elsewhere}${known}`, typing: T },
    personStep({ personId: p.id, from }, 250),
    ...(ownedSay ? [{ say: ownedSay, delay: 250, typing: 400 } as ScriptStep] : []),
    ...owned.map((c, i) => ({ offer: { type: 'resumeGame', gameId: c.gameId! }, label: `Play ${c.title}`, ...(i === 0 ? { delay: 250 } : {}) }) as ScriptStep),
    { offer: { type: 'ask', text: askCast(from) }, label: `Who else is in ${fromTitle}?`, ...(owned.length ? {} : { delay: 250 }) },
    { offer: { type: 'ask', text: askCrew(from) }, label: `Who made ${fromTitle}?` },
  ]);
}

/** The scripted reply for a credits sentence, or null to let the others try. */
export function whoMadeThisScriptFor(text: string): NovaScript | null {
  const t = text.trim();
  if (!t) return null;
  const game = creditsFor(t);
  if (game) lastAbout = game.gameId;
  // A character first: "who voices Johnny Silverhand" names no person.
  if (CAST.test(t)) {
    const ch = characterFor(t);
    if (ch) return personScript(ch.person, ch.credit.gameId ?? lastAbout);
  }
  const person = personFor(t);
  if (person && (PERSON.test(t) || CAST.test(t) || CREW.test(t) || MADE.test(t))) {
    const from = creditIn(person, lastAbout) ? lastAbout : person.credits.find((c) => c.gameId)?.gameId ?? lastAbout;
    lastAbout = from;
    return personScript(person, from);
  }
  // A game named, or "it" after one was: the three words pick the section.
  const about = game ?? (PRONOUN.test(t) ? CREDITS_BY_ID[lastAbout] : null);
  if (!about) return null;
  if (MADE.test(t)) return allScript(about);
  if (CREW.test(t)) return crewScript(about);
  if (CAST.test(t)) return castScript(about);
  return null;
}

/** Who Made This in the manifest's routing layer (agents/recipeScripts.ts). */
export const whoMadeThisScripts: RecipeScripts = {
  id: WHO_MADE_THIS_AGENT,
  scriptFor: (text) => whoMadeThisScriptFor(text),
  examples: ['Who made Cyberpunk 2077?', "Who's in Baldur's Gate 3?", 'Who composed Elden Ring?', 'What else has Erica Lindbeck been in?', 'Who voices Johnny Silverhand?'],
};
