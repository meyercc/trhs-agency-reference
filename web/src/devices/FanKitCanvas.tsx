import { useEffect, useState } from 'react';
import './device-canvas.css';
import './pc-parts.css';
import './cooler-cap.css';
import './fan-kit.css';
import {
  Button,
  Dropdown,
  FanCurve,
  Icon,
  Input,
  Ng3Field,
  Ng3Grid,
  Ng3Label,
  Ng3Panel,
  Ng3Row,
  Ng3Section,
  Ng3Tool,
  Slider,
  ToggleButtonGroup,
} from '../components';
import {
  FAN_NAME_MAX,
  KIT_CURVE_TEMP,
  KIT_PORTS,
  addGroup,
  fanName,
  groupName,
  identifyFans,
  kitFans,
  kitPortFull,
  moveFan,
  plugKitFan,
  removeGroup,
  renameFan,
  renameGroup,
  setGroup,
  unplugKitFan,
  useFanKit,
  useGroupRpm,
  useIdentifying,
  type Fan,
  type FanGroup,
  type FanMode,
} from './fanKit';

/**
 * The DIY fan kit's window — the extra fans chained on the kit's own
 * controller (OpenGSW lcd-diy, "The kit's fans"). Like the cooler cap, a part
 * with something of its own to do, so it gets a window of its own; every door
 * to it opens this one (lcd-diy.25).
 *
 * The hero is the kit as wired: each port's chain, each fan under its name and
 * in its group's colour, so the player can see what Identify lit and where a
 * fan they just plugged in went.
 *
 *   Groups — each group runs as one: speed bar, curve, RPM, Identify
 *            (lcd-diy.10, lcd-diy.11), from the app's own fan controls
 *            (lcd-diy.29)
 *   Fans   — every kit fan, its name and its group (lcd-diy.12)
 *
 * Fan names are given here until lcd-diy#open:3 says where they belong (the
 * user's call, 2026-10-19). Changes reach the fans at once, like the app's
 * other fan controls.
 */

/** A group's colour in the hero and on its section — never the only signal:
 *  the group's name is beside it. */
const GROUP_TONES = ['var(--cyan)', 'var(--purple)', 'var(--orange)', 'var(--green)', 'var(--yellow)'];
const toneOf = (groups: FanGroup[], groupId: string | null | undefined) => {
  const i = groups.findIndex((g) => g.id === groupId);
  return i < 0 ? 'var(--text-muted)' : GROUP_TONES[i % GROUP_TONES.length];
};

const MODE_OPTIONS: { value: FanMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'max', label: 'Max' },
  { value: 'manual', label: 'Manual' },
  { value: 'curve', label: 'Curve' },
];

/** A name field that commits on blur or Enter, and shows the default while
 *  empty. Names are the player's, so they are never translated (lcd-diy.12). */
function NameField({ value, placeholder, onCommit, label, autoFocus }: { value: string | null; placeholder: string; onCommit: (v: string) => void; label: string; autoFocus?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value ?? '';
  return (
    <Input
      aria-label={label}
      autoFocus={autoFocus}
      value={shown}
      placeholder={placeholder}
      maxLength={FAN_NAME_MAX}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(null);
          e.stopPropagation();
        }
      }}
    />
  );
}

/** The kit as wired: one row per port, fans in chain order. */
function KitHero() {
  const kit = useFanKit();
  const lit = useIdentifying();
  const fans = kitFans(kit);
  return (
    <div className="fk-hero" role="img" aria-label={`DIY fan kit, ${fans.length} fans on ${KIT_PORTS} ports`}>
      {Array.from({ length: KIT_PORTS }, (_, i) => i + 1).map((port) => {
        const chain = fans.filter((f) => f.port === port).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return (
          <div key={port} className="fk-chain">
            <span className="fk-port">Port {port}</span>
            {chain.length === 0 && <span className="fk-empty">Nothing plugged in</span>}
            {chain.map((f) => (
              <div key={f.id} className={'fk-fan' + (lit.has(f.id) ? ' lit' : '')} style={{ ['--fk-tone' as string]: toneOf(kit.groups, f.groupId) }} data-fan={f.id}>
                <span className="fk-fan-disc">
                  <Icon name="breeze" size={20} />
                </span>
                <span className="fk-fan-name">{fanName(f)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GroupSection({ group, members, tone }: { group: FanGroup | undefined; members: Fan[]; tone: string }) {
  const rpm = useGroupRpm(group);
  const title = group ? groupName(group) : 'Ungrouped';
  const [renaming, setRenaming] = useState(false);
  return (
    <Ng3Section className="fk-group" data-group={group?.id ?? 'ungrouped'} style={{ ['--fk-tone' as string]: tone }}>
      <Ng3Row className="fk-group-head">
        <span className="fk-swatch" aria-hidden="true" />
        {group && renaming ? (
          <NameField
            label="Group name"
            value={group.name}
            placeholder={groupName({ ...group, name: null })}
            onCommit={(v) => {
              renameGroup(group.id, v);
              setRenaming(false);
            }}
            autoFocus
          />
        ) : (
          <Ng3Label strong className="fk-group-name">
            {title}
          </Ng3Label>
        )}
        {group && !renaming && (
          <button type="button" className="dc-mute" aria-label={`Rename ${title}`} onClick={() => setRenaming(true)}>
            <Icon name="edit" size={16} />
          </button>
        )}
        <span className="dc-mono-val fk-rpm" aria-label={`${title} speed`}>
          {members.length ? `${rpm.toLocaleString()} RPM` : '—'}
        </span>
      </Ng3Row>
      <span className="pcp-reason">
        {members.length ? members.map(fanName).join(' · ') : 'No fans yet. Add them on the Fans tab.'}
      </span>
      {group ? (
        <>
          <ToggleButtonGroup
            aria-label={`${title} fan mode`}
            value={group.mode}
            onChange={(v) => setGroup(group.id, { mode: v as FanMode })}
            options={MODE_OPTIONS}
            fullWidth
          />
          {/* What makes sense under one option grows under it (card grammar P3). */}
          {group.mode === 'manual' && (
            <Ng3Field>
              <Ng3Row>
                <Ng3Label plain>Speed</Ng3Label>
                <span className="dc-mono-val">{group.manualPct}%</span>
              </Ng3Row>
              <Slider min={20} max={100} step={5} value={group.manualPct} onChange={(v) => setGroup(group.id, { manualPct: v })} aria-label={`${title} speed`} />
            </Ng3Field>
          )}
          {group.mode === 'curve' && (
            <FanCurve points={group.curve} onChange={(curve) => setGroup(group.id, { curve })} liveTemp={KIT_CURVE_TEMP} aria-label={`${title} fan curve`} />
          )}
        </>
      ) : (
        members.length > 0 && <span className="pcp-reason">Ungrouped fans run on Auto.</span>
      )}
      <div className="pcp-action">
        <Button size="sm" disabled={!members.length} onClick={() => identifyFans(members.map((f) => f.id))}>
          <Icon name="target" size={16} />
          Identify
        </Button>
        {group && (
          <Button size="sm" variant="ghost" onClick={() => removeGroup(group.id)}>
            <Icon name="trash" size={16} />
            Remove group
          </Button>
        )}
      </div>
    </Ng3Section>
  );
}

function GroupsTab() {
  const kit = useFanKit();
  const fans = kitFans(kit);
  const ungrouped = fans.filter((f) => !f.groupId || !kit.groups.some((g) => g.id === f.groupId));
  return (
    <Ng3Grid className="fk-groups">
      {kit.groups.map((g) => (
        <GroupSection key={g.id} group={g} members={fans.filter((f) => f.groupId === g.id)} tone={toneOf(kit.groups, g.id)} />
      ))}
      {ungrouped.length > 0 && <GroupSection group={undefined} members={ungrouped} tone="var(--text-muted)" />}
    </Ng3Grid>
  );
}

function FansTab() {
  const kit = useFanKit();
  const fans = kitFans(kit);
  const groupOptions = [{ value: '', label: 'Ungrouped' }, ...kit.groups.map((g) => ({ value: g.id, label: groupName(g) }))];
  return (
    <Ng3Grid>
      {Array.from({ length: KIT_PORTS }, (_, i) => i + 1).map((port) => {
        const chain = fans.filter((f) => f.port === port).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const full = kitPortFull(port, kit);
        return (
          <Ng3Section key={port} data-port={port}>
            <Ng3Row>
              <Ng3Label strong info>
                Port {port}
              </Ng3Label>
              <span className="dc-mono-val">
                {chain.length} {chain.length === 1 ? 'fan' : 'fans'}
              </span>
            </Ng3Row>
            {chain.map((f) => (
              <Ng3Row key={f.id} className="fk-fan-row" data-fan={f.id}>
                <span className="fk-pos" aria-hidden="true">
                  {f.position}
                </span>
                <NameField label={`Name of fan ${f.position} on port ${port}`} value={f.name} placeholder={fanName({ ...f, name: null })} onCommit={(v) => renameFan(f.id, v)} />
                <Dropdown
                  aria-label={`Group of ${fanName(f)}`}
                  value={f.groupId ?? ''}
                  onChange={(v) => moveFan(f.id, v || null)}
                  options={groupOptions}
                />
                <button type="button" className="dc-mute" aria-label={`Identify ${fanName(f)}`} onClick={() => identifyFans([f.id])}>
                  <Icon name="target" size={16} />
                </button>
              </Ng3Row>
            ))}
            {/* The prototype's stand-in for plugging a fan in or pulling one
                out: names must survive it (lcd-diy.37). */}
            <div className="pcp-action fk-sim">
              <Button size="sm" variant="ghost" disabled={!!full} onClick={() => plugKitFan(port)}>
                Simulate: plug in a fan
              </Button>
              {chain.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => unplugKitFan(chain[0].id)}>
                  Simulate: unplug the first
                </Button>
              )}
              {full && <span className="pcp-reason">{full}</span>}
            </div>
          </Ng3Section>
        );
      })}
    </Ng3Grid>
  );
}

const TABS = [
  { id: 'groups', icon: 'breeze' as const, title: 'Groups', width: 'full' as const },
  { id: 'fans', icon: 'edit' as const, title: 'Fans', width: 'full' as const },
];

export function FanKitCanvas({ onClose, initialTab, partOf }: { onClose: () => void; initialTab?: string; partOf?: string }) {
  const [tabId, setTabId] = useState(TABS.some((t) => t.id === initialTab) ? initialTab! : TABS[0].id);
  const active = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const kit = useFanKit();
  const count = kitFans(kit).length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dc-canvas pcp-window fk-canvas" role="dialog" aria-label="DIY fan kit">
      <div className="dc-status">
        <div className="dc-chip">
          <Icon name="breeze" size={16} />
          <span className="dc-chip-val">DIY fan kit</span>
        </div>
        {partOf && (
          <div className="dc-chip">
            <span className="dc-chip-val">Part of {partOf}</span>
          </div>
        )}
        <div className="dc-chip">
          <span className="dc-chip-val">
            {count} {count === 1 ? 'fan' : 'fans'}
          </span>
        </div>
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      <div className="dc-hero">
        <KitHero />
      </div>

      <div className="dc-panel-wrap">
        <Ng3Panel
          width={active.width}
          header={active.title}
          actions={
            active.id === 'groups' ? (
              <button type="button" className="ds-ng3-action" aria-label="New group" title="New group" onClick={() => addGroup()}>
                <Icon name="add" />
              </button>
            ) : undefined
          }
          tools={TABS.map((t) => (
            <Ng3Tool key={t.id} icon={t.icon} title={t.title} active={t.id === active.id} onClick={() => setTabId(t.id)} />
          ))}
          bare
        >
          {active.id === 'groups' ? <GroupsTab /> : <FansTab />}
        </Ng3Panel>
      </div>
    </div>
  );
}
