import { useState } from 'react';
import { Badge, Button, ModalShell, Toggle, ToggleButtonGroup } from '../../components';
import { OmenAiIcon } from '../perform3/OmenAiHeader';

// ── OMEN AI per-game modal (PerformV5, 1.0 = "quiz" design) ──
// Control-and-Status modal, NO interactive image (per the 3-template canon).
// V5-local port of the vanilla prototype's OMEN AI modal (js/omen-ai.js + the
// #tpl-ai template) — copied over, not modifying the original. Left = identity
// (status + benefits/considerations); right = the per-game configuration list +
// a supported-games grid. This is the Per-game dimension.

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

  const tracked = games.filter((g) => g.on).length;

  const left = (
    <div className="pv5-omm-left">
      <div className="pv5-omm-hero">
        <OmenAiIcon />
      </div>
      <div className="pv5-omm-id-title">OMEN AI</div>
      <div className="pv5-omm-id-sub">
        Continuously tunes each game against performance data from players on similar hardware; refreshes profiles every few days.
      </div>
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
      <div className="pv5-omm-list-head">Benefits</div>
      <ul className="pv5-omm-notes">
        <li>Zero-effort game optimization</li>
        <li>Improves over time automatically</li>
        <li>Hardware-matched community data</li>
      </ul>
      <div className="pv5-omm-list-head">Considerations</div>
      <ul className="pv5-omm-notes pv5-omm-notes-warn">
        <li>May override manual tweaks</li>
        <li>New versions change settings</li>
        <li>Requires internet for updates</li>
      </ul>
    </div>
  );

  return (
    <ModalShell title="OMEN AI" onClose={onClose} className="pv5-omm" left={left}>
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
                  <Button variant="ghost" size="sm">Revert to original</Button>
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
              <a className="pv5-omm-sup-cta" href="#/perform-v5">Get on {s.platform}</a>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
