import { useEffect, useMemo, useState } from 'react';
import { ModalShell, Toggle, Badge, Button, ToggleButtonGroup } from '../components';
import { gameArt } from '../widgets/gameArt';
import { useSettings } from '../state/Settings';
import {
  initialGamesFor,
  FPS_OPTIONS,
  SUPPORTED_GAMES,
  badgeFor,
  shortMonthDay,
  type AiGame,
  type AiMode,
} from './omenAiGames';
import './feature-modal.css';
import './omen-ai.css';

const MANUAL_MODES = [
  { label: 'Performance', value: 'performance' },
  { label: 'Quality', value: 'quality' },
];
// The guided goal — offered to the learner persona only, and listed first so
// it reads as the default rather than an extra option (cf. PowerThermal's Auto).
const AUTO_MODE = { label: 'Auto', value: 'auto' };

/**
 * OMEN AI game-profiles modal — ported from vanilla `tpl-ai` + `js/omen-ai.js`.
 * Left: feature intro; right: per-game settings (toggle / mode / target-FPS /
 * revert) with live counts, plus the Supported Games grid. State is in-memory
 * (resets on reload), matching the vanilla prototype.
 *
 * Persona shapes the *starting posture* (`useSettings().persona`), never what's
 * reachable: a **learner** lands with every game already optimizing on an "Auto"
 * goal that hides the FPS target; a **tinkerer** gets the Target FPS row up
 * front on every goal rather than only under Quality; a **minimalist** gets the
 * on/off list without the per-game tuning body. Re-picking the persona in
 * Settings reseeds the list live.
 */
export function OmenAiModal({ onClose }: { onClose?: () => void }) {
  const { persona } = useSettings();
  const learner = persona === 'learner';
  const tinkerer = persona === 'tinkerer';
  const minimal = persona === 'minimalist';

  const modeOptions = learner ? [AUTO_MODE, ...MANUAL_MODES] : MANUAL_MODES;

  const [games, setGames] = useState<AiGame[]>(() => initialGamesFor(persona));
  // Persona can change live (Settings → Experience Style) — reseed so the
  // posture matches, and so no stale `auto` goal survives leaving the learner.
  useEffect(() => {
    setGames(initialGamesFor(persona));
  }, [persona]);

  const patch = (id: string, next: (g: AiGame) => AiGame) =>
    setGames((prev) => prev.map((g) => (g.id === id ? next(g) : g)));

  // ── State transitions (mirror the vanilla handlers) ──
  const toggleGame = (id: string) =>
    patch(id, (g) => {
      const enabled = !g.enabled;
      if (enabled) {
        // Turning ON: re-apply latest / resume
        if (g.status === 'reverted' || g.status === 'never') {
          return { ...g, enabled, status: 'latest', version: 'v1.0 · Just applied' };
        }
        return { ...g, enabled, status: 'latest', version: g.version.replace('Paused ', 'Resumed ') };
      }
      // Turning OFF: stamp a paused date if it was live
      if (g.status === 'latest') {
        const stamp = shortMonthDay(new Date());
        const base = g.version.split('·')[0].trim();
        return { ...g, enabled, status: 'updated', version: `${base} · Paused ${stamp}` };
      }
      return { ...g, enabled };
    });

  const revertGame = (id: string) =>
    patch(id, (g) => ({
      ...g,
      enabled: false,
      status: 'reverted',
      version: `Reverted · ${shortMonthDay(new Date())}`,
    }));

  const setMode = (id: string, mode: AiMode) => patch(id, (g) => ({ ...g, mode }));
  const setFps = (id: string, fps: number) => patch(id, (g) => ({ ...g, fps }));

  // ── Live counts for the right-panel header ──
  const counts = useMemo(() => {
    const c = { optimizing: 0, paused: 0, reverted: 0, never: 0 };
    for (const g of games) {
      if (g.enabled) c.optimizing++;
      else if (g.status === 'updated') c.paused++;
      else if (g.status === 'reverted') c.reverted++;
      else if (g.status === 'never') c.never++;
    }
    return c;
  }, [games]);

  return (
    <ModalShell
      title="OMEN AI"
      className="omenai-modal feature-modal"
      onClose={onClose}
      left={<OmenAiIntro persona={persona} tracked={games.length} active={counts.optimizing} />}
    >
      <div className="ai-right-header">
        <div className="ai-right-header-row">
          <span className="ai-right-title">Per-Game Settings</span>
          <span className="ai-right-meta">
            {minimal ? 'Switch OMEN AI on or off per game' : 'Toggle per game · select optimization goal'}
          </span>
        </div>
        <div className="ai-right-stat-row">
          <Stat label="Optimizing" value={counts.optimizing} cyan />
          <Stat label="Paused" value={counts.paused} />
          <Stat label="Reverted" value={counts.reverted} />
          <Stat label="Never Applied" value={counts.never} />
        </div>
      </div>

      <div className="ai-scroll">
        <div className="ai-games-list">
          {games.map((g) => {
            const badge = badgeFor(g);
            return (
              // `expanded` reveals the items body — a minimalist has none, so
              // the class would only add empty padding under each row.
              <div key={g.id} className={`ds-settings-group${minimal ? '' : ' expanded'}${g.enabled ? ' ai-active' : ''}`}>
                <div className="ds-settings-group-header">
                  <div
                    className="ds-settings-group-icon ai-game-thumb"
                    style={{ backgroundImage: `url('${gameArt(g.art) ?? ''}')` }}
                  />
                  <div className="ds-settings-group-titles">
                    <div className="ds-settings-group-title">{g.title}</div>
                    <div className="ds-settings-group-desc ai-game-sub">
                      {g.platform} · {g.genre}
                    </div>
                  </div>
                  <div className="ds-settings-group-meta">
                    <span className="ai-version-label">{g.version}</span>
                    <Badge variant="status" tone={badge.tone}>
                      {badge.text}
                    </Badge>
                    <Toggle checked={g.enabled} onChange={() => toggleGame(g.id)} aria-label={`OMEN AI for ${g.title}`} />
                  </div>
                </div>

                {/* Minimalist keeps the list to what it is — on or off. */}
                {!minimal && (
                <div className="ds-settings-group-items ai-widget-body" style={{ opacity: g.enabled ? 1 : 0.55 }}>
                  <div className="ds-settings-row" style={{ alignItems: 'center' }}>
                    <div className="ds-settings-row-labels" style={{ flex: '0 0 auto' }}>
                      <div className="ds-settings-row-label">Goal</div>
                    </div>
                    <ToggleButtonGroup
                      className="ai-mode-group"
                      options={modeOptions}
                      value={g.mode}
                      onChange={(v) => setMode(g.id, v as AiMode)}
                      aria-label={`${g.title} optimization goal`}
                    />
                  </div>

                  {g.mode === 'auto' && (
                    <div className="ds-settings-row ai-auto-note">
                      OMEN AI is choosing the balance for this game and re-tuning it as new data arrives.
                    </div>
                  )}

                  {/* Target FPS is a Quality-goal control, but a tinkerer gets it
                      up front on any manual goal — the persona's whole ask. */}
                  {(g.mode === 'quality' || (tinkerer && g.mode !== 'auto')) && (
                    <div className="ds-settings-row ai-fps-row visible" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <div className="ds-settings-row-labels" style={{ flex: '0 0 auto' }}>
                        <div className="ds-settings-row-label">Target FPS</div>
                      </div>
                      <div className="ds-chip-check-group" style={{ marginLeft: 'auto' }}>
                        {FPS_OPTIONS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`ds-chip-check${g.fps === f ? ' active' : ''}`}
                            onClick={() => setFps(g.id, f)}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="ds-settings-row" style={{ justifyContent: 'flex-end', borderBottom: 'none' }}>
                    <Button variant="ghost" size="sm" disabled={g.status === 'reverted'} onClick={() => revertGame(g.id)}>
                      Revert to Original
                    </Button>
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="ai-supported-games">
          <div className="ai-supported-title">Supported Games</div>
          <div className="ai-supported-desc">
            Here's the full list of games that OMEN AI can currently enhance. We're continuously adding support for more
            games.
          </div>
          <div className="ai-supported-grid">
            {SUPPORTED_GAMES.map((g) => (
              <div key={g.title} className="ds-tile glow" title={g.title} style={g.installed ? { opacity: 0.5 } : undefined}>
                <div className="ds-tile-art" style={{ backgroundImage: `url('${gameArt(g.art) ?? ''}')` }}>
                  {g.installed ? (
                    <span className="ds-badge status ai-grid-badge">Installed</span>
                  ) : (
                    <>
                      <span className="ds-badge status info ai-grid-badge">New</span>
                      <a
                        href={g.link}
                        target="_blank"
                        rel="noreferrer"
                        className="ds-btn sm ai-grid-cta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Get on {g.platform}
                      </a>
                    </>
                  )}
                </div>
                <div className="ds-tile-footer">
                  <div className="ds-tile-name">{g.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function Stat({ label, value, cyan }: { label: string; value: number; cyan?: boolean }) {
  return (
    <div className="ai-right-stat">
      <span className="ai-right-stat-label">{label}</span>
      <span className={`ai-right-stat-val${cyan ? ' cyan' : ''}`}>{value}</span>
    </div>
  );
}

/**
 * Feature description by persona. Same feature, same honesty about what it
 * does — the learner copy leads with reassurance and plain language, the
 * tinkerer copy leads with what it actually changes and how to take over.
 */
const INTRO_COPY: Record<string, string> = {
  learner:
    "OMEN AI takes care of your game settings for you. It watches how your PC runs, compares it with players on similar hardware, and quietly adjusts each game so it looks and plays its best. You don't have to do anything — and you can switch any game back whenever you like.",
  tinkerer:
    'OMEN AI cross-references telemetry from your hardware against profiles from comparable systems and generates per-game settings deltas every few days. Set a goal per title, pin a target frame rate, or revert any profile to your own configuration — it never overwrites a game you have switched off.',
  minimalist:
    'OMEN AI keeps your games tuned in the background — better frame rates and temperatures, no setup. Switch it off for any game you would rather leave alone.',
};
const INTRO_DEFAULT =
  'OMEN AI continuously monitors your hardware and cross-references real performance data from players running similar systems. Every few days it may generate an updated settings profile — silently improving frame rates, temperatures, and visual quality without you having to touch a thing.';

/**
 * Left hero/intro panel: neural diamond, description, status, stats,
 * benefits/considerations. The counts are passed in rather than hardcoded so
 * the panel can't contradict the live per-game list beside it.
 */
function OmenAiIntro({ persona, tracked, active }: { persona: string; tracked: number; active: number }) {
  return (
    <>
      <div className="ai-hero-icon">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <circle cx="50" cy="50" r="46" stroke="rgba(0,200,215,0.15)" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="36" stroke="rgba(0,200,215,0.22)" strokeWidth="1" strokeDasharray="4,3" />
          <polygon points="50,13 82,50 50,87 18,50" fill="rgba(0,200,215,0.05)" stroke="rgba(0,200,215,0.45)" strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="50,30 66,50 50,70 34,50" fill="rgba(0,200,215,0.08)" stroke="rgba(0,200,215,0.28)" strokeWidth="1" strokeLinejoin="round" />
          <line x1="50" y1="30" x2="66" y2="50" stroke="rgba(0,200,215,0.12)" strokeWidth="0.8" />
          <line x1="66" y1="50" x2="50" y2="70" stroke="rgba(0,200,215,0.12)" strokeWidth="0.8" />
          <line x1="50" y1="70" x2="34" y2="50" stroke="rgba(0,200,215,0.12)" strokeWidth="0.8" />
          <line x1="34" y1="50" x2="50" y2="30" stroke="rgba(0,200,215,0.12)" strokeWidth="0.8" />
          <line x1="50" y1="13" x2="50" y2="30" stroke="rgba(0,200,215,0.35)" strokeWidth="1.2" />
          <line x1="82" y1="50" x2="66" y2="50" stroke="rgba(0,200,215,0.35)" strokeWidth="1.2" />
          <line x1="50" y1="87" x2="50" y2="70" stroke="rgba(0,200,215,0.35)" strokeWidth="1.2" />
          <line x1="18" y1="50" x2="34" y2="50" stroke="rgba(0,200,215,0.35)" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="5" fill="rgba(0,200,215,0.12)" stroke="rgba(0,200,215,0.65)" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="2" fill="rgba(0,200,215,0.8)" />
          <circle cx="50" cy="13" r="2.5" fill="rgba(0,200,215,0.45)" />
          <circle cx="82" cy="50" r="2.5" fill="rgba(0,200,215,0.45)" />
          <circle cx="50" cy="87" r="2.5" fill="rgba(0,200,215,0.45)" />
          <circle cx="18" cy="50" r="2.5" fill="rgba(0,200,215,0.45)" />
          <circle cx="50" cy="30" r="3" fill="rgba(0,200,215,0.6)" />
          <circle cx="66" cy="50" r="3" fill="rgba(0,200,215,0.6)" />
          <circle cx="50" cy="70" r="3" fill="rgba(0,200,215,0.6)" />
          <circle cx="34" cy="50" r="3" fill="rgba(0,200,215,0.6)" />
        </svg>
      </div>

      <div className="modal-feature-title">OMEN AI</div>
      <div className="modal-feature-desc">{INTRO_COPY[persona] ?? INTRO_DEFAULT}</div>

      <div className="ai-status-row">
        <div className="ai-status-left">
          <div className="ai-status-dot" />
          <span className="ai-status-label">{active > 0 ? 'AI Optimization Active' : 'AI Optimization Paused'}</span>
        </div>
        <span className="ai-status-detail">
          {active} of {tracked} games
        </span>
      </div>

      <div className="ds-stat-grid" style={{ marginBottom: 'var(--gutter-sm)' }}>
        <div className="ds-stat-cell">
          <div className="ds-spark-lbl">Games Tracked</div>
          <div className="ds-spark-val" style={{ color: 'var(--cyan)' }}>{tracked}</div>
        </div>
        <div className="ds-stat-cell">
          <div className="ds-spark-lbl">Last Updated</div>
          <div className="ds-spark-val">1h ago</div>
        </div>
        <div className="ds-stat-cell">
          <div className="ds-spark-lbl">Active Profiles</div>
          <div className="ds-spark-val" style={{ color: 'var(--green)' }}>{active}</div>
        </div>
        <div className="ds-stat-cell">
          <div className="ds-spark-lbl">Data Source</div>
          <div className="ds-spark-val">Cloud</div>
        </div>
      </div>

      <div className="uv-info-grid">
        <div className="uv-info-card benefits">
          <div className="uv-info-card-title">✅ Benefits</div>
          <div className="uv-info-item">Zero-effort game optimization</div>
          <div className="uv-info-item">Improves over time automatically</div>
          <div className="uv-info-item">Hardware-matched community data</div>
          <div className="uv-info-item">Per-game granular control</div>
        </div>
        <div className="uv-info-card risks">
          <div className="uv-info-card-title">🚩 Considerations</div>
          <div className="uv-info-item">May override manual tweaks</div>
          <div className="uv-info-item">New versions change settings</div>
          <div className="uv-info-item">Requires internet for updates</div>
          <div className="uv-info-item">Varies by game support level</div>
        </div>
      </div>
    </>
  );
}
