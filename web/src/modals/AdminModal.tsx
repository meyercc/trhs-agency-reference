import { Fragment, useEffect, useRef, useState } from 'react';
import { ModalShell, Icon, Button, ContextMenu, ContextMenuLabel, ListItem, Separator, Dropdown } from '../components';
import { useNavigate } from 'react-router-dom';
import { useSettings, LEVEL_FOR_ROOM, ROOM_LABEL, type RoomLight } from '../state/Settings';
import { DESK_SCENARIOS, DESK_SCENARIO_GROUPS, scenarioOf, type DeskScenario } from '../devices/deskScenarios';
import type { DeskDevice } from '../devices/arrangement';
import { useDeviceSim, SIM_DEVICE_IDS } from '../state/DeviceSim';
import { LaptopGlyph } from '../widgets/DeskWidget';
// The same render files the DESK card and the monitor window draw with — one
// set of pictures, so the thumbnail can never show a different product.
import treehouseUrl from '../devices/monitor/assets/treehouse32-front-tight.png';
import oled27Url from '../devices/monitor/assets/omen-oled27-front.png';
import macbookUrl from '../devices/monitor/assets/macbook-front-generic.png';
import './admin-modal.css';

/**
 * The chosen desk as a picture (2026-09-21, Cindy: "드롭다운에서 선택했을 때 그
 * 글에 해당되는 이미지를 보여주는 건"). Left to right the way the desk model
 * stands (OMEN OLED 27 · MacBook · Treehouse 32 · tower, chris-decisions), no
 * names — the dropdown already says the counts, and the picture says which
 * kinds. Decorative for a screen reader for the same reason.
 */
function DeskThumb({ desk }: { desk: DeskDevice[] }) {
  return (
    <div className="admin-desk-thumb" aria-hidden="true">
      {desk.includes('pulse-27') && <img className="adt-oled" src={oled27Url} alt="" />}
      {desk.includes('macbook') && <img className="adt-lap" src={macbookUrl} alt="" />}
      <img className="adt-th" src={treehouseUrl} alt="" />
      {desk.includes('tower') && <span className="adt-tower"><LaptopGlyph /></span>}
    </div>
  );
}

/**
 * Admin & testing tools (`?modal=admin`), opened from the Admin submenu in the
 * profile dropdown. Each tool drops in as an `.admin-tool` row.
 */
export function AdminModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { persona, onboarded, setPersona, setOnboarded,
          monitorFirstHour, setMonitorFirstHour, kvm, setKvm,
          deskDevices, setDeskDevices, roomLight, setRoomLight } = useSettings();
  // The desk is set by scenario only (2026-09-21, Cindy). The toggle chips that
  // used to sit here are read-only tags now: one control per state, so a desk
  // nobody can name cannot be made by accident and the buttons never claim a
  // desk that is not on the table.
  const scenario = scenarioOf(deskDevices);
  const pick = (s: DeskScenario) => {
    setDeskDevices(s.desk);
    // The Team demo desk opens with Gear Switch on and the OMEN 35L on the
    // Treehouse 32 (2026-09-24, Cindy). Wallpaper is the computer's, so with the
    // MacBook active every screen wore one desktop and the picture showed no
    // difference at first sight; with the tower active the Treehouse 32 shows
    // the other computer, which is what this desk is for.
    if (s.id === 'full-desk') {
      setKvm({ ...kvm, configured: true, activePc: 'pc2' });
      return;
    }
    // The keyboard stays on a computer that is here: MacBook = pc1, tower = pc2.
    const here = { pc1: s.desk.includes('macbook'), pc2: s.desk.includes('tower') };
    if (!here[kvm.activePc]) setKvm({ ...kvm, activePc: here.pc1 ? 'pc1' : 'pc2' });
  };
  const go = (to: string) => {
    onClose();
    navigate(to);
  };
  // The picker (2026-09-22). Open/close is the library Dropdown's own habit —
  // outside click and Escape close it (Dropdown.tsx, ProfileMenu.tsx).
  const [pickOpen, setPickOpen] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setPickOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickOpen]);
  // A stored desk outside the list is not a scenario: opening Admin sets it to
  // the first one (Cindy, 09-22 — a test tool, nothing to lose). This replaced
  // a `Custom` option nobody could read.
  useEffect(() => {
    if (!scenario) pick(DESK_SCENARIOS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);
  const { hudOpen, setHudOpen, simState } = useDeviceSim();
  const awayCount = SIM_DEVICE_IDS.filter((id) => !simState(id).connected).length;

  const launch = () => {
    onClose();
    navigate('/onboarding');
  };
  const reset = () => {
    setPersona('');
    setOnboarded(false);
    // Drop the onboarding-seeded dashboard so a re-run starts from scratch.
    try {
      localStorage.removeItem('board-layout');
    } catch { /* ignore */ }
  };

  return (
    <ModalShell title="Admin Settings" className="admin-modal" onClose={onClose}>
      <div className="admin-group">
        <div className="admin-group-label">Testing tools</div>
        <div className="admin-tool">
          <span className="admin-tool-ic"><Icon name="devices" size={18} /></span>
          <div className="admin-tool-meta">
            <div className="admin-tool-name">First-boot onboarding</div>
            <div className="admin-tool-desc">
              Run the full first-run flow — welcome, consent, HP ID, the intent fork, persona,
              module selection, and the dashboard build.
            </div>
            <div className="admin-tool-status">
              {onboarded ? (
                <>Onboarded · persona <b>{persona || '—'}</b></>
              ) : (
                'Not onboarded yet'
              )}
            </div>
          </div>
          <div className="admin-tool-actions">
            <Button size="sm" variant="accent" onClick={launch}>Launch</Button>
            {onboarded && (
              <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
            )}
          </div>
        </div>

        <div className="admin-tool">
          <span className="admin-tool-ic"><Icon name="devices" size={18} /></span>
          <div className="admin-tool-meta">
            <div className="admin-tool-name">Device simulator</div>
            {/* Every connected device since 2026-09-01, displays included — the
                roster used to be "devices with onboard memory", which quietly
                left both monitors out of the one screen that plays hardware.
                Each row offers only what that device can do, so this sentence
                names the acts rather than promising all of them everywhere. */}
            <div className="admin-tool-desc">
              Play the hardware's side: unplug a device, press its profile button, run its
              battery down, plug it back in.
            </div>
            <div className="admin-tool-status">
              {hudOpen ? 'Simulator shown' : 'Simulator hidden'}
              {awayCount > 0 && <> · {awayCount} device{awayCount > 1 ? 's' : ''} away</>}
            </div>
          </div>
          <div className="admin-tool-actions">
            {hudOpen ? (
              <Button size="sm" variant="ghost" onClick={() => setHudOpen(false)}>Hide</Button>
            ) : (
              // Close the modal on show — the whole point is watching the app
              // (usually an open device canvas) react while you press buttons.
              <Button size="sm" variant="accent" onClick={() => { setHudOpen(true); onClose(); }}>
                Show
              </Button>
            )}
          </div>
        </div>

        {/* ── Display scenario ───────────────────────────────────────────
            Ours, so LAST (2026-09-21, Cindy: "우리 거를 제일 밑으로 … 다른
            디자이너들이 스크롤 안 해도"). Every word here is read by designers
            who have never been in our reviews (Cindy, same day: "이거 나만 쓰는
            게 아니잖아") — so no `Desk`, no `already set up`, no `Other desk`:
            the title says it is about displays, the dropdown says counts, the
            picture shows the kinds, and the button is named for what it shows.
            The picker is grouped by computers with rows by monitor count
            (2026-09-22, Cindy via the flow window: "드롭다운 너무 헷갈려 …
            구분을 지어야"): the library Dropdown has no headers or dividers, so
            its trigger opens a library ContextMenu instead (ProfileMenu is the
            precedent). One number per row; the header says why a `1 monitor`
            desk still shows two screens (the laptop brings one).
            Icon = `screen-mirror`, the only screen-shaped glyph the library has;
            a plain monitor glyph stays a library request (rule 11). */}
        <div className="admin-tool admin-desk">
          <span className="admin-tool-ic"><Icon name="screen-mirror" size={18} /></span>
          <div className="admin-tool-meta">
            <div className="admin-tool-name">Display scenario</div>
            {/* No description line, no `Review:` prefix, no counts under a Custom
                desk (2026-09-21, Cindy: "서브텍스트가 정말 필요한 거니 … 내가 시키지도
                않은 글을 자꾸 늘려"). The title names the row, the dropdown says the
                counts, the picture shows the desk — each said once. What is left
                under the picture is the one word Cindy asked for, a link when it
                goes somewhere. */}
            <DeskThumb desk={deskDevices} />
            <div className="admin-tool-status admin-desk-status" data-desk={scenario ? scenario.desk.join(',') : ''}>
              {scenario?.to ? (
                <button type="button" className="admin-desk-go" onClick={() => go(scenario.to!)}>
                  {scenario.look}
                  <Icon name="chevron-right" size={10} aria-hidden />
                </button>
              ) : (
                scenario?.look
              )}
            </div>
          </div>
          <div className="admin-tool-actions admin-desk-actions">
            <div className={'ds-dropdown admin-desk-pick' + (pickOpen ? ' open' : '')} ref={pickRef}>
              <button
                type="button"
                className="ds-dropdown-trigger"
                aria-haspopup="menu"
                aria-expanded={pickOpen}
                aria-label="Display scenario"
                onClick={() => setPickOpen((o) => !o)}
              >
                <span className="ds-dropdown-label">{scenario ? `${scenario.group} · ${scenario.row}` : ''}</span>
                <span className="ds-dropdown-chevron" aria-hidden="true">
                  <Icon name="chevron-down" size={12} />
                </span>
              </button>
              {pickOpen && (
                <ContextMenu className="admin-desk-menu" aria-label="Display scenario">
                  {DESK_SCENARIO_GROUPS.map((g, i) => (
                    <Fragment key={g.group}>
                      {i > 0 && <Separator />}
                      <ContextMenuLabel>{g.group}</ContextMenuLabel>
                      {g.rows.map((x) => (
                        <ListItem
                          key={x.id}
                          role="menuitemradio"
                          aria-checked={x.id === scenario?.id}
                          selected={x.id === scenario?.id}
                          label={x.row}
                          trailing={<span className="admin-desk-look">{x.look}</span>}
                          onClick={() => {
                            pick(x);
                            setPickOpen(false);
                          }}
                        />
                      ))}
                    </Fragment>
                  ))}
                </ContextMenu>
              )}
            </div>
            {/* ONE button, one label (2026-09-21, Cindy: "그냥 First Time Setup 버튼
                하나만 있으면 되는 거 아니야?"). It is a switch: the accent variant
                is its ON look, the same way every other ON reads in this app, so
                no second label is needed to say which state it is in.
                Asymmetric on purpose: turning it off does NOT set Gear Switch
                `configured` back, because that would claim a setup nobody
                performed — the way back is `Set up Gear Switch` on Connectivity. */}
            <Button
              size="sm"
              variant={monitorFirstHour ? 'accent' : 'ghost'}
              aria-pressed={monitorFirstHour}
              title="Show the monitor as if it was just plugged in — Gear Switch resets with it"
              onClick={() => {
                if (monitorFirstHour) {
                  setMonitorFirstHour(false);
                  return;
                }
                setMonitorFirstHour(true);
                setKvm({ ...kvm, configured: false });
                onClose();
              }}
            >
              First-time setup
            </Button>
            {/* The room, in the same card as the desk (2026-09-23, Cindy: "이거
                모니터 카드 안에 합칠 순 없어?"). It started as a row of its own
                and that was one card too many: both controls answer the same
                question — what scene is this demo standing in — and our block
                should read as one thing, not two.
                A stand-in for the ambient light sensor, and deliberately not a
                clock: sunset would need a location permission, a time schedule
                is already Chris's profile layer, and 8pm is work for one person
                and a match for another. The room is a fact about the desk. */}
            <label className="admin-desk-room">
              <span className="admin-desk-room-label">Room light</span>
              <Dropdown
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'bright', label: 'Bright' },
                  { value: 'dim', label: 'Dim' },
                  { value: 'dark', label: 'Dark' },
                ]}
                value={roomLight}
                onChange={(v) => setRoomLight(v as RoomLight)}
                aria-label="Room light"
              />
            </label>
          </div>
        </div>


      </div>

    </ModalShell>
  );
}
