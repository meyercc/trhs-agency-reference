// Suggestions are tiles, not popups: a question, one reason, and answers.
// Research rule: Ask > Suggest > Apply — accepting is the only thing that
// changes the desk, and every accepted suggestion can be undone in place.
import { presetNamed } from '../../lightstudio/presets';
import type { IconName } from '../../components';
import { DESK_DEVICES, type DeskState, type ModeOwned, type SuggestionId } from './model';
import type { DeviceState, DeviceStates } from '../../lightstudio/scene';

export interface Suggestion {
  id: SuggestionId;
  icon: IconName;
  question: string;
  body: string;
  /** Why it's suggested — shown as `reasonIcon` with this as its tooltip. */
  reason: string;
  reasonIcon: IconName;
  acceptLabel: string;
  /** Confirmation shown after accepting (with Undo). */
  done: string;
  /** Optional cadence choice shown as a third answer. */
  cadence?: string;
  owned: ModeOwned[];
  patch: (desk: DeskState) => Partial<DeskState>;
}

const lightAll = (desk: DeskState, p: Partial<DeviceState>): DeviceStates =>
  Object.fromEntries(DESK_DEVICES.map((id) => [id, { ...desk.lighting[id], ...p }])) as DeviceStates;

export const SUGGESTIONS: Record<SuggestionId, Suggestion> = {
  'meeting-soon': {
    id: 'meeting-soon',
    icon: 'work',
    question: 'Meeting at 7:00 PM — switch to Work then?',
    body: 'Keep playing now; Work mode turns on when the call starts.',
    reason: 'Suggested because a Teams call is on your calendar in 30 min',
    reasonIcon: 'work',
    acceptLabel: 'Switch at 7:00',
    done: 'Work mode turns on at 7:00 PM.',
    owned: [],
    patch: () => ({}),
  },
  'night-lighting': {
    id: 'night-lighting',
    icon: 'moon',
    question: 'Switch to Night lighting?',
    body: 'Dims keyboard and desk lighting to a warm Campfire glow. Game settings stay.',
    reason: 'Suggested because it’s evening',
    reasonIcon: 'sunset',
    acceptLabel: 'Switch',
    done: 'Night lighting is on.',
    cadence: 'Every evening',
    owned: ['lighting'],
    patch: (d) => ({ lighting: lightAll(d, { ...presetNamed('Campfire'), brightness: 35, speed: 3 }) }),
  },
  'game-sync': {
    id: 'game-sync',
    icon: 'lights',
    question: 'Sync lighting with Valorant?',
    body: 'Keyboard and desk react to your agent, abilities and round wins.',
    reason: 'Suggested because Valorant supports game lighting',
    reasonIcon: 'gaming',
    acceptLabel: 'Try it',
    done: 'Lighting follows Valorant while it runs.',
    owned: ['lighting'],
    patch: () => ({ gameSync: true }),
  },
  'calm-lighting': {
    id: 'calm-lighting',
    icon: 'lights',
    question: 'Calm the desk for your call?',
    body: 'Solid white at 25% and no animated effects until the call ends.',
    reason: 'Suggested because you’re on camera at 7:00 PM',
    reasonIcon: 'work',
    acceptLabel: 'Calm it',
    done: 'Desk lighting is calm until the call ends.',
    owned: ['lighting'],
    patch: (d) => ({ lighting: lightAll(d, { ...presetNamed('White'), brightness: 25 }) }),
  },
  'mic-noise': {
    id: 'mic-noise',
    icon: 'mic',
    question: 'Turn on mic noise reduction?',
    body: 'Filters keyboard clicks and fan noise out of your voice.',
    reason: 'Suggested because typing was picked up in your last call',
    reasonIcon: 'mic',
    acceptLabel: 'Turn on',
    done: 'Noise reduction is on.',
    owned: [],
    patch: () => ({ micNoise: true }),
  },
  'lights-off': {
    id: 'lights-off',
    icon: 'moon',
    question: 'Turn desk lights off at 11:00 PM?',
    body: 'Lights go dark when quiet hours start and come back at 7:00 AM.',
    reason: 'Suggested because your quiet hours start at 11:00 PM',
    reasonIcon: 'moon',
    acceptLabel: 'Every night',
    done: 'Desk lights turn off at 11:00 PM.',
    owned: [],
    patch: () => ({}),
  },
  'go-live': {
    id: 'go-live',
    icon: 'stream',
    question: 'Go live on Twitch?',
    body: 'Starts your stream in OBS with the SoloCast 2 Pro as the mic.',
    reason: 'Suggested because OBS is open and Twitch is connected',
    reasonIcon: 'stream',
    acceptLabel: 'Go live',
    done: 'You’re live on Twitch.',
    owned: [],
    patch: () => ({}),
  },
};
