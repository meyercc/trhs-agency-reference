import { useState } from 'react';
import { Badge, Button, ModalShell, Toggle, ToggleButtonGroup } from '../../components';
import { OmenAiIcon } from '../perform3/OmenAiHeader';
import { InfoDisclosure } from './InfoDisclosure';

// ── OMEN AI per-game modal (PerformV7) ──
// V7 fork. The V5 version carried a left rail holding six things, none of which
// was navigation: a hero icon, the title, a description, a status line, four
// stats, Benefits and Considerations. By our own rule — a rail exists when the
// body navigates between groups — this modal does not earn one today.
//
// So the rail is gone and its contents are redistributed by lifetime:
//   · Title + hero icon — deleted. The modal header already says OMEN AI.
//   · Description, Benefits, Considerations — into an InfoDisclosure at the
//     FOOTER LEFT. The header's right-hand end is reserved for controls that
//     change what the modal does; help is read once, so it takes the cheaper
//     position and the two can never compete. All three
//     are "what this feature is" content: read once, noise afterwards. The
//     considerations were re-read rather than relocated to a write point: none
//     of them is a risk at a write (turning per-game optimization on is
//     reversible, and reversibility discharges confirmation). "May override
//     manual tweaks" is not copy at all — it is already carried structurally by
//     the governance chip on the card it overrides.
//   · Status + the four stats — into the body as content, where readings belong.
//
// Note this is the 1.0 shape. At 2.0 the modal gains two real destinations —
// General optimization (booster, network booster, FPS target) and Per-game — and
// at that point it earns the rail back. Same modal, opposite answer, because the
// question is whether there is anything to navigate between.
//
// Also fixed here: "Revert to original" had no handler in V5. It is the control
// the research asks participants to find, so a dead button would invalidate that
// task.

type Mode = 'performance' | 'quality';
interface Game {
  id: string;
  title: string;
  meta: string;
  on: boolean;
  mode: Mode;
  fps: number;
  version: string;
  badge: string;
  emoji: string;
}

const INITIAL_GAMES: Game[] = [
  { id: 'cs2', title: 'Counter-Strike 2', meta: 'Steam · FPS', on: true, mode: 'performance', fps: 360, version: 'v3.2 · 1 day ago', badge: 'Latest', emoji: '🔫' },
  { id: 'valorant', title: 'Valorant', meta: 'Riot · FPS', on: true, mode: 'performance', fps: 240, version: 'v2.8 · 3 days ago', badge: 'Latest', emoji: '🎯' },
  { id: 'cyberpunk', title: 'Cyberpunk 2077', meta: 'Steam · RPG', on: true, mode: 'quality', fps: 120, version: 'v1.4 · today', badge: 'Latest', emoji: '🌃' },
  { id: 'fortnite', title: 'Fortnite', meta: 'Epic · Battle Royale', on: false, mode: 'performance', fps: 165, version: 'Paused · Jan 20', badge: 'Paused', emoji: '🛡️' },
  { id: 'lol', title: 'League of Legends', meta: 'Riot · MOBA', on: true, mode: 'performance', fps: 144, version: 'v2.1 · 5 days ago', badge: 'Latest', emoji: '⚔️' },
];

const FPS_OPTIONS = [30, 60, 90, 120, 144, 165, 240, 280, 360];
const MODE_OPTIONS = [
  { label: 'Performance', value: 'performance' },
  { label: 'Quality', value: 'quality' },
];

const SUPPORTED = [
  { title: 'Apex Legends', platform: 'Steam', installed: true },
  { title: 'Overwatch 2', platform: 'Battle.net', installed: true },
  { title: 'Dota 2', platform: 'Steam', installed: false },
  { title: 'Marvel Rivals', platform: 'Steam', installed: false },
  { title: 'Minecraft', platform: 'Microsoft', installed: false },
  { title: 'Roblox', platform: 'Roblox', installed: false },
];

export interface OmenAiModalProps {
  onClose?: () => void;
}

export function OmenAiModal({ onClose }: OmenAiModalProps) {
  const [games, setGames] = useState<Game[]>(INITIAL_GAMES);

  const update = (id: string, patch: Partial<Game>) => setGames((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  // Revert = back to the profile OMEN AI shipped for this title, which in this
  // build is its initial state. Renders as a real change so the task is testable.
  const revert = (id: string) => {
    const original = INITIAL_GAMES.find((g) => g.id === id);
    if (original) setGames((gs) => gs.map((g) => (g.id === id ? { ...original } : g)));
  };
  const isEdited = (g: Game) => {
    const o = INITIAL_GAMES.find((x) => x.id === g.id);
    return !!o && (o.mode !== g.mode || o.fps !== g.fps);
  };

  const tracked = games.filter((g) => g.on).length;

  const about = (
    <InfoDisclosure label="About OMEN AI" title="OMEN AI" icon={<OmenAiIcon />}>
      <p className="pv7-disc-body">
        Continuously tunes each game against performance data from players on similar hardware, and
        refreshes profiles every few days.
      </p>
      <div className="pv7-disc-head">Good at</div>
      <ul className="pv7-disc-list">
        <li>Zero-effort game optimization</li>
        <li>Improves over time automatically</li>
        <li>Hardware-matched community data</li>
      </ul>
      <div className="pv7-disc-head">Worth knowing</div>
      <ul className="pv7-disc-list pv7-disc-list-warn">
        <li>New versions change settings</li>
        <li>Requires internet for updates</li>
      </ul>
    </InfoDisclosure>
  );

  return (
    <ModalShell
      title="OMEN AI"
      onClose={onClose}
      className="pv5-omm pv7-omm"
      width="narrow"
      /* Help lives at the footer's left end; the header's right is for controls. */
      footer={<div className="pv7-footer">{about}</div>}
    >
      {/* Status and stats are readings, so they live in the body as content. */}
      <div className="pv7-omm-readout">
        <div className="pv5-omm-status">
          <span className="pv5-omm-dot" />
          AI optimization active · {tracked} games tracked
        </div>
        <div className="pv5-omm-stats">
          <div className="pv5-omm-stat"><span className="pv5-omm-stat-v">{games.length}</span><span className="pv5-omm-stat-l">Games tracked</span></div>
          <div className="pv5-omm-stat"><span className="pv5-omm-stat-v">1h</span><span className="pv5-omm-stat-l">Last updated</span></div>
          <div className="pv5-omm-stat"><span className="pv5-omm-stat-v">{tracked}</span><span className="pv5-omm-stat-l">Active profiles</span></div>
          <div className="pv5-omm-stat"><span className="pv5-omm-stat-v">Cloud</span><span className="pv5-omm-stat-l">Data source</span></div>
        </div>
      </div>

      <div className="pv5-omm-sect">Per-game optimization</div>
      <div className="pv5-omm-games">
        {games.map((g) => (
          <div className={'pv5-omm-game' + (g.on ? '' : ' pv5-omm-game-off')} key={g.id}>
            <div className="pv5-omm-game-head">
              <span className="pv5-omm-game-thumb" aria-hidden="true">{g.emoji}</span>
              <span className="pv5-omm-game-id">
                <span className="pv5-omm-game-title">{g.title}</span>
                <span className="pv5-omm-game-meta">{g.meta} · {g.version}</span>
              </span>
              <Badge variant="status" tone={g.on ? 'positive' : 'neutral'}>{g.badge}</Badge>
              <Toggle checked={g.on} onChange={(v) => update(g.id, { on: v, badge: v ? 'Latest' : 'Paused' })} aria-label={`OMEN AI for ${g.title}`} />
            </div>
            {g.on && (
              <div className="pv5-omm-game-body">
                <div className="pv5-omm-row">
                  <span className="pv5-omm-row-label">Goal</span>
                  <ToggleButtonGroup options={MODE_OPTIONS} value={g.mode} onChange={(v) => update(g.id, { mode: v as Mode })} aria-label={`${g.title} goal`} />
                </div>
                {g.mode === 'quality' && (
                  <div className="pv5-omm-row pv5-omm-row-fps">
                    <span className="pv5-omm-row-label">Target FPS</span>
                    <span className="pv5-omm-fps-chips">
                      {FPS_OPTIONS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={'pv5-omm-fps-chip' + (g.fps === f ? ' active' : '')}
                          onClick={() => update(g.id, { fps: f })}
                        >
                          {f}
                        </button>
                      ))}
                    </span>
                  </div>
                )}
                <div className="pv5-omm-game-foot">
                  {isEdited(g) && <span className="pv7-omm-edited">Edited by you</span>}
                  <Button variant="ghost" size="sm" onClick={() => revert(g.id)} disabled={!isEdited(g)}>
                    Revert to original
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pv5-omm-sect">Supported games</div>
      <div className="pv5-omm-supported">
        {SUPPORTED.map((s) => (
          <div className={'pv5-omm-sup' + (s.installed ? '' : ' pv5-omm-sup-new')} key={s.title}>
            <span className="pv5-omm-sup-title">{s.title}</span>
            {s.installed ? (
              <span className="pv5-omm-sup-badge">Installed</span>
            ) : (
              <a className="pv5-omm-sup-cta" href="#/perform-v7">Get on {s.platform}</a>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
