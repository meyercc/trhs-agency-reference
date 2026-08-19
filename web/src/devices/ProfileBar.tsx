import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './profile-bar.css';
import { Icon, Button, ListBox, ListItem, SoftwareOnlyProvider } from '../components';
import { useSettings } from '../state/Settings';
import { useDeviceProfiles, type SlotSettings, type SlotSource } from '../state/DeviceProfiles';
import { useDeviceSim } from '../state/DeviceSim';
import { profileName } from '../state/profiles';
import { onboardSlotCount, slotLabel, isOnboardScope, type ProfileScope } from './onboard';
import type { ResolvedSku } from './skus';

/**
 * The profile bar above a device's hero: the software profile and this
 * device's onboard memory, as one row of what the user is looking at.
 *
 * Two halves, 50/50, because there are exactly two kinds of place settings can
 * live. The onboard slots collapse into the right half's list rather than
 * running along the bar as peers — a mouse has five of them, which both
 * overflowed the bar and made "software profile" read as the sixth option in a
 * set instead of the other kind of thing.
 *
 * The bar is a *switch*: selecting a slot puts the device on it, and selecting
 * the software profile hands the device back. There is no preview step and no
 * separate "Activate" — what you are looking at and what the device is running
 * are one fact, so `scope` is derived from `activeSlot` rather than tracked
 * beside it. A device-side button press therefore moves the bar with it.
 *
 * Saving is still its own act. Activation is free; a Save writes flash, which
 * has finite cycles, so edits sit in a draft until the user commits them.
 *
 * A disconnected device disables the bar outright — you cannot switch a device
 * that isn't here.
 *
 * Devices with no onboard memory (`onboard.slots: 0` — the monitor, every
 * long-tail component) render no bar at all rather than a one-option radio.
 */

/** How long the onboard confirmation stays up before it retires itself. */
const NOTE_LINGER_MS = 5000;

export interface ProfileBarState {
  sku: ResolvedSku;
  slotCount: number;
  /** Derived from what the device is running — never independent state. */
  scope: ProfileScope;
  /** Switch the device: a slot index puts it on that slot, 'software' hands it back. */
  setScope: (s: ProfileScope) => void;
  /** True while the device runs an onboard slot — software-only regions lock. */
  locked: boolean;
  /** Remount key: bumped when the running slot changes and on Undo. */
  revision: number;
  dirty: boolean;
  markDirty: () => void;
  /** Read a value for the current scope (per-slot while on a slot). */
  value: <T>(key: string, fallback: T) => T;
  setValue: (key: string, v: unknown) => void;
  activeSlot: number | null;
  /** Who put the device on its active slot — the app, its own button, or a reconnect. */
  slotSource: SlotSource;
  /** Is the device at this PC right now (simulated)? Disables the whole bar. */
  connected: boolean;
  save: () => void;
  undo: () => void;
  profileId: string;
}

/** Owns the open panel's working copy and dirty state. */
export function useDeviceProfileBar(sku: ResolvedSku): ProfileBarState {
  const { activeProfileId } = useSettings();
  const { deviceState, saveSlot, activateSlot } = useDeviceProfiles();
  const { simState } = useDeviceSim();

  const slotCount = onboardSlotCount(sku);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);

  const dev = deviceState(sku.id);
  const connected = simState(sku.id).connected;
  // What the device runs IS what the panel shows. Nothing to keep in sync,
  // and a device-side switch moves the panel because it moves activeSlot.
  const scope: ProfileScope = dev.activeSlot ?? 'software';

  // Working copy of the slot in view. Edits land here, never in the store,
  // until Save — so closing the panel discards them like any draft.
  const [draft, setDraft] = useState<SlotSettings>(() =>
    dev.activeSlot != null ? { ...(dev.slots[dev.activeSlot] ?? {}) } : {},
  );
  // Software-scope values are state, not a ref — controlled controls (sliders)
  // have to re-render when they're moved. Session-local, like the old app.
  const [softwareValues, setSoftwareValues] = useState<SlotSettings>({});

  // Reload the draft whenever the running slot changes — whoever changed it.
  // A device-side press lands here too, which is the point: the panel follows
  // the hardware. Ref-compared so it fires on real changes only, not on every
  // store write (a Save must not clobber its own result).
  const prevScope = useRef<ProfileScope>(scope);
  useEffect(() => {
    if (prevScope.current === scope) return;
    prevScope.current = scope;
    setDraft(isOnboardScope(scope) ? { ...(dev.slots[scope] ?? {}) } : {});
    setDirty(false);
    setRevision((r) => r + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const setScope = useCallback(
    (next: ProfileScope) => {
      // Selecting IS switching. A device that isn't here can't be switched.
      if (!connected) return;
      activateSlot(sku.id, isOnboardScope(next) ? next : null);
    },
    [connected, activateSlot, sku.id],
  );

  const value = useCallback(
    <T,>(key: string, fallback: T): T => {
      const bag = isOnboardScope(scope) ? draft : softwareValues;
      return (key in bag ? (bag[key] as T) : fallback);
    },
    [scope, draft, softwareValues],
  );

  const setValue = useCallback(
    (key: string, v: unknown) => {
      if (isOnboardScope(scope)) {
        setDraft((d) => ({ ...d, [key]: v }));
        setDirty(true);
      } else {
        setSoftwareValues((s) => ({ ...s, [key]: v }));
      }
    },
    [scope],
  );

  const markDirty = useCallback(() => {
    if (isOnboardScope(scope)) setDirty(true);
  }, [scope]);

  return {
    sku,
    slotCount,
    scope,
    setScope,
    // The device runs an onboard slot, so software-only features genuinely
    // aren't running. Same condition as the scope now — one fact, one lock.
    locked: dev.activeSlot != null,
    revision,
    dirty,
    markDirty,
    value,
    setValue,
    activeSlot: dev.activeSlot,
    slotSource: dev.slotSource ?? 'app',
    connected,
    save: () => {
      // Saving writes flash on the device — it has to actually be here.
      if (!isOnboardScope(scope) || !connected) return;
      saveSlot(sku.id, scope, draft);
      setDirty(false);
    },
    undo: () => {
      if (!isOnboardScope(scope)) return;
      setDraft({ ...(dev.slots[scope] ?? {}) });
      setDirty(false);
      setRevision((r) => r + 1);
    },
    profileId: activeProfileId,
  };
}

/**
 * Wraps a tab body: locks software-only regions while a slot is in view, and
 * catches any control change so the bar can offer Save/Undo. Catching at the
 * container avoids threading a dirty callback through every control — the
 * panels stay presentational, which is how the rest of the canvases work.
 */
export function ProfileScopeBody({ state, children }: { state: ProfileBarState; children: ReactNode }) {
  return (
    <SoftwareOnlyProvider locked={state.locked}>
      <div
        className="pb-scope-body"
        onInputCapture={state.markDirty}
        onClickCapture={state.markDirty}
        onKeyDownCapture={(e) => {
          // Arrow keys drive sliders/radios without firing click.
          if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Enter') state.markDirty();
        }}
      >
        {children}
      </div>
    </SoftwareOnlyProvider>
  );
}

export function ProfileBar({ state }: { state: ProfileBarState }) {
  const {
    sku, slotCount, scope, setScope, activeSlot, dirty, profileId,
    connected, slotSource,
  } = state;

  const deviceNoun = useMemo(() => sku.type.replace(/^notebook-|^desktop-/, ''), [sku.type]);
  const swName = profileName(profileId);

  // Which slot the collapsed onboard half is showing. On a slot that is simply
  // the scope; on the software profile it offers the last slot the device ran,
  // so the half is a one-click way back to where you were.
  const [pickedSlot, setPickedSlot] = useState<number | null>(null);
  const shownSlot = isOnboardScope(scope) ? scope : (pickedSlot ?? 0);
  // Remember the last slot the device ran, however it got there — including a
  // press on the device itself — so handing back to software leaves the half
  // pointing at where you were.
  useEffect(() => {
    if (activeSlot != null) setPickedSlot(activeSlot);
  }, [activeSlot]);

  const [open, setOpen] = useState(false);
  const halfRef = useRef<HTMLDivElement>(null);
  const chevRef = useRef<HTMLButtonElement>(null);

  const rows = useCallback(
    () => Array.from(halfRef.current?.querySelectorAll<HTMLElement>('.pb-pop .ds-list-item') ?? []),
    [],
  );

  // Open lands focus on the row you are already on, so the list starts where
  // the eye is.
  useEffect(() => {
    if (!open) return;
    rows()[shownSlot]?.focus();
    const onDoc = (e: MouseEvent) => {
      if (halfRef.current && !halfRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, shownSlot, rows]);

  // Close hands focus back to the chevron that opened it — but only once the
  // list has actually unmounted. Focusing inside the handler is undone by the
  // commit that removes the focused row, which drops focus to the body.
  const refocusRef = useRef(false);
  useEffect(() => {
    if (open || !refocusRef.current) return;
    refocusRef.current = false;
    chevRef.current?.focus();
  }, [open]);

  // The onboard confirmation is a moment, not a standing fact. It says how the
  // device got onto this slot, which stops being news — and the bar itself
  // already carries the standing state (the "On the <device>" kicker, the green
  // dot, "Running" in the list), so retiring the sentence loses nothing. It
  // fades in place rather than unmounting: the actions row keeps its height, so
  // nothing below the bar moves on a timer. The unsaved-changes warning never
  // retires — it is actionable and belongs with its buttons.
  const noteLive = connected && isOnboardScope(scope) && !dirty;
  const [noteFaded, setNoteFaded] = useState(false);
  useEffect(() => {
    if (!noteLive) return;
    setNoteFaded(false);
    const t = setTimeout(() => setNoteFaded(true), NOTE_LINGER_MS);
    return () => clearTimeout(t);
    // Re-times whenever the sentence changes: a different slot, a different way
    // of getting there, or a Save that hands the row back from the warning.
  }, [noteLive, scope, slotSource]);

  const close = (refocus: boolean) => {
    refocusRef.current = refocus;
    setOpen(false);
  };
  const pick = (i: number) => {
    setScope(i);
    close(true);
  };

  const onPopKeyDown = (e: React.KeyboardEvent, i: number) => {
    const list = rows();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      list[(i + d + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); }
    else if (e.key === 'Escape' || e.key === 'Tab') {
      // Escape dismisses the list, not the whole device modal — the host closes
      // on a document-level Escape, so this one must not reach it.
      if (e.key === 'Escape') e.stopPropagation();
      close(e.key === 'Escape');
    }
  };

  // A radiogroup promises arrow-key navigation, so it has to actually work:
  // arrows move (and select) between the two halves, Home/End jump to the ends.
  // The selected half is the only tab stop, per the roving-tabindex pattern —
  // the chevron is a separate stop, reached with Tab.
  const scopes: ProfileScope[] = ['software', shownSlot];
  const onKeyDown = (e: React.KeyboardEvent) => {
    // The chevron and the open list own their own keys; everything else in the
    // row drives the roving selection.
    if ((e.target as HTMLElement).closest?.('.pb-chev, .pb-pop')) return;
    const i = isOnboardScope(scope) ? 1 : 0;
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % scopes.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + scopes.length) % scopes.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = scopes.length - 1;
    else return;
    e.preventDefault();
    setScope(scopes[next]);
    const row = e.currentTarget as HTMLElement;
    (row.querySelectorAll('.pb-opt')[next] as HTMLElement | undefined)?.focus();
  };

  if (slotCount === 0) return null;

  return (
    <div className="pb" role="group" aria-label="Profile">
      <div
        className={'pb-row' + (connected ? '' : ' disabled')}
        role="radiogroup"
        aria-label="Profile source"
        onKeyDown={onKeyDown}
      >
        <div className={'pb-half' + (scope === 'software' ? ' active' : '')}>
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'software'}
            tabIndex={scope === 'software' ? 0 : -1}
            className="pb-opt"
            disabled={!connected}
            onClick={() => setScope('software')}
          >
            <span className="pb-opt-kicker">Software profile</span>
            <span className="pb-opt-name">{swName}</span>
          </button>
        </div>

        <span className="pb-sep" aria-hidden="true" />

        {/* Onboard half: a split control. The body selects the onboard scope at
            the slot on show; the chevron opens the list to change which slot.
            Collapsing the slots keeps the bar a 50/50 read of the two kinds of
            thing rather than a run of up to six equal-looking options. */}
        <div
          className={
            'pb-half pb-onboard' +
            (isOnboardScope(scope) ? ' active' : '') +
            (activeSlot === shownSlot ? ' on-device' : '') +
            (open ? ' open' : '')
          }
          ref={halfRef}
        >
          <button
            type="button"
            role="radio"
            aria-checked={isOnboardScope(scope)}
            tabIndex={isOnboardScope(scope) ? 0 : -1}
            className="pb-opt"
            disabled={!connected}
            onClick={() => setScope(shownSlot)}
          >
            <span className="pb-opt-kicker">
              On the {deviceNoun}
              {activeSlot === shownSlot && <span className="pb-live" aria-label="running on the device" />}
            </span>
            <span className="pb-opt-name">{slotLabel(shownSlot)}</span>
          </button>
          <button
            type="button"
            ref={chevRef}
            className="pb-chev"
            disabled={!connected}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Choose an onboard slot on the ${deviceNoun} — ${slotCount} available`}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
              } else if (e.key === 'Escape' && open) {
                // Same guard as the list: dismiss the list, keep the modal.
                e.stopPropagation();
                close(false);
              }
            }}
          >
            <Icon name="chevron-down" size={12} aria-hidden />
          </button>

          {open && (
            <ListBox className="pb-pop" aria-label={`Onboard slots on the ${deviceNoun}`} maxHeight={240}>
              {Array.from({ length: slotCount }, (_, i) => (
                <ListItem
                  key={i}
                  label={slotLabel(i)}
                  selected={scope === i}
                  // The running slot says so in words as well as with the dot —
                  // the state never rides on color alone.
                  trailing={
                    activeSlot === i ? (
                      <span className="pb-pop-live">
                        <span className="pb-live" aria-hidden="true" />
                        Running
                      </span>
                    ) : undefined
                  }
                  onClick={() => pick(i)}
                  onKeyDown={(e) => onPopKeyDown(e, i)}
                />
              ))}
            </ListBox>
          )}
        </div>
      </div>

      {/* One note at a time. Disconnected outranks everything — a device that
          isn't here can't be switched, so the bar says so and goes inert. */}
      {!connected ? (
        <div className="pb-actions">
          <span className="pb-note">
            <Icon name="alert" size={14} aria-hidden />
            Disconnected — the {deviceNoun} is away, running its onboard memory
          </span>
        </div>
      ) : isOnboardScope(scope) ? (
        <div className="pb-actions">
          {dirty ? (
            <>
              <span className="pb-note pb-warn">
                <Icon name="alert" size={14} aria-hidden />
                Unsaved changes — not on the {deviceNoun} yet
              </span>
              <Button size="sm" onClick={state.undo}>
                Undo
              </Button>
              <Button size="sm" variant="accent" onClick={state.save}>
                Save to {slotLabel(scope)}
              </Button>
            </>
          ) : (
            <span
              // role="status" because it now leaves: a message that retires has
              // to be announced when it arrives, or a screen-reader user meets
              // an empty row. The standing state stays readable on the bar.
              role="status"
              className={'pb-note pb-ok pb-transient' + (noteFaded ? ' faded' : '')}
            >
              <Icon name="check" size={14} aria-hidden />
              {slotSource === 'device'
                ? `Switched to ${slotLabel(scope)} on the ${deviceNoun} — travels with it`
                : slotSource === 'reconnect'
                  ? `Came back running ${slotLabel(scope)} — it was switched while away`
                  : `Running on the ${deviceNoun} — travels with it`}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
