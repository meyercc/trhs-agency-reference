import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './profile-bar.css';
import { Icon, Button, Dropdown, SoftwareOnlyProvider, type DropdownGroup } from '../components';
import { useProfiles } from '../state/Profiles';
import { useDeviceProfiles, type SlotSettings, type SlotSource } from '../state/DeviceProfiles';
import { useDeviceSim } from '../state/DeviceSim';
import { onboardSlotCount, slotLabel, isOnboardScope, type ProfileScope } from './onboard';
import type { ResolvedSku } from './skus';

/**
 * The profile selector of a device canvas: the software profile and this
 * device's onboard memory, as one dropdown in the leading aside of the panel's
 * tab strip (Figma Hardware-Mode "Profile Selector"), with the slot's status
 * and Save/Undo in the trailing aside. It used to be a two-half radio bar above
 * the hero; folding it into the strip hands that band back to the product
 * image and leaves one control where the eye already is — beside the tabs.
 *
 * The menu is two groups, because there are exactly two kinds of place
 * settings can live: "Software" holds the active profile, "Onboard" the slots.
 * The headings carry the kind; a slot never reads as a sixth peer of the
 * profile, and a mouse's five slots no longer need collapsing.
 *
 * The selector is a *switch*: picking a slot puts the device on it, and picking
 * the software profile hands the device back. There is no preview step and no
 * separate "Activate" — what you are looking at and what the device is running
 * are one fact, so `scope` is derived from `activeSlot` rather than tracked
 * beside it. A device-side button press therefore moves the selector with it.
 *
 * Saving is still its own act. Activation is free; a Save writes flash, which
 * has finite cycles, so edits sit in a draft until the user commits them.
 *
 * A disconnected device disables the selector outright — you cannot switch a
 * device that isn't here.
 *
 * Devices with no onboard memory (`onboard.slots: 0` — the monitor, every
 * long-tail component) render no selector at all rather than a one-option menu.
 */

/** Stable empty bag, so a device with nothing captured yet doesn't churn deps. */
const EMPTY_BAG: SlotSettings = {};

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
  /** Display name of the active software profile. */
  profileName: string;
}

/** Owns the open panel's working copy and dirty state. */
export function useDeviceProfileBar(sku: ResolvedSku): ProfileBarState {
  const { activeProfile, mergeDeviceSettings } = useProfiles();
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
  // Software-scope values live ON the active profile. They used to be local
  // state seeded empty on every mount — "session-local, like the old app" —
  // so everything set in software scope was thrown away when the panel closed.
  // Now the profile is the store, which is what makes the two halves of this
  // bar genuinely parallel: a software profile holds, per device, the same
  // shape a flash slot holds. Switching profiles swaps this bag wholesale.
  const softwareValues = activeProfile.devices[sku.id] ?? EMPTY_BAG;

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
        // Straight to the profile — no draft and no Save, because nothing here
        // writes flash. Only the onboard half has a cost worth deferring.
        //
        // MERGE, never replace: spreading `softwareValues` here would capture
        // the bag as it was at render, so two settings changed in the same tick
        // would each start from that same copy and the first would vanish.
        mergeDeviceSettings(activeProfile.id, sku.id, { [key]: v });
      }
    },
    [scope, activeProfile.id, sku.id, mergeDeviceSettings],
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
    profileId: activeProfile.id,
    profileName: activeProfile.name,
  };
}

/**
 * `useState`, but the value lives in the active scope — the software profile, or
 * the onboard slot the device is running.
 *
 * Shaped as a drop-in for `useState` on purpose. Most device settings were
 * written as plain local state, which meant they survived nothing: not closing
 * the panel, not switching profile, not a slot save. Migrating one is a
 * one-line change with an identical call site, so the diff stays readable and
 * the risk stays low.
 *
 * `key` is namespaced by the tab that owns it (`sensor.dpi`) because that
 * prefix is what the Profiles modal groups the read-only manifest by.
 */
export function useProfileValue<T>(
  state: ProfileBarState,
  key: string,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const value = state.value<T>(key, fallback);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      // Functional updates resolve against the last committed value. Two
      // functional updates to the SAME key in one tick would still collapse —
      // no caller does that, and writes to different keys compose correctly
      // because the store merges inside its updater.
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(state.value<T>(key, fallback)) : next;
      state.setValue(key, resolved);
    },
    [state, key, fallback],
  );
  return [value, set];
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

/** Hand a device type to a sentence: "notebook-keyboard" → "keyboard". */
const useDeviceNoun = (sku: ResolvedSku) => useMemo(() => sku.type.replace(/^notebook-|^desktop-/, ''), [sku.type]);

const SOFTWARE = 'software';

/**
 * The profile dropdown — goes in `Ng3Panel`'s `leading` slot. Two groups:
 * the software profile, then the device's onboard slots; the row the device
 * is running says "Running" in words as well as by being the selected row.
 */
export function ProfileBar({ state }: { state: ProfileBarState }) {
  const { sku, slotCount, scope, setScope, activeSlot, profileName, connected } = state;
  const deviceNoun = useDeviceNoun(sku);

  if (slotCount === 0) return null;

  const groups: DropdownGroup[] = [
    { label: 'Software', options: [{ value: SOFTWARE, label: profileName, icon: 'profile' }] },
    {
      label: 'Onboard',
      options: Array.from({ length: slotCount }, (_, i) => ({
        value: String(i),
        label: slotLabel(i),
        icon: 'profile' as const,
        // The running slot says so in words as well as by its selected surface —
        // the state never rides on shade alone.
        trailing:
          activeSlot === i ? (
            <span className="pb-running">
              <span className="pb-live" aria-hidden="true" />
              Running
            </span>
          ) : undefined,
      })),
    },
  ];

  return (
    <div className="pb">
      <Dropdown
        className="pb-select"
        aria-label={`Profile — the software profile or an onboard slot on the ${deviceNoun}`}
        groups={groups}
        value={isOnboardScope(scope) ? String(scope) : SOFTWARE}
        onChange={(v) => setScope(v === SOFTWARE ? SOFTWARE : Number(v))}
        disabled={!connected}
        openUp
      />
    </div>
  );
}

/**
 * What the current scope means right now, and what you can do about it — goes
 * in `Ng3Panel`'s `trailing` slot. One note at a time: disconnected outranks
 * everything; on a slot, either the unsaved warning with its Undo/Save or a
 * confirmation that retires itself. Nothing in software scope while connected.
 */
export function ProfileActions({ state }: { state: ProfileBarState }) {
  const { sku, slotCount, scope, dirty, connected, slotSource } = state;
  const deviceNoun = useDeviceNoun(sku);

  // The onboard confirmation is a moment, not a standing fact. It says how the
  // device got onto this slot, which stops being news — and the selector itself
  // carries the standing state (the slot is the selected row, marked Running),
  // so retiring the sentence loses nothing. It fades in place rather than
  // unmounting so the strip's height never changes. The unsaved-changes warning
  // never retires — it is actionable and belongs with its buttons.
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

  if (slotCount === 0) return null;

  // The strip is a single line, so every sentence here is short and truncates
  // with an ellipsis before it wraps; the full text rides on `title`.
  const note = (text: string, extra?: string, role?: 'status') => (
    <span role={role} className={'pb-note' + (extra ? ' ' + extra : '')} title={text}>
      <Icon name={extra?.startsWith('pb-ok') ? 'check' : 'alert'} size="sm" aria-hidden />
      <span className="pb-note-text">{text}</span>
    </span>
  );

  if (!connected) {
    return <div className="pb-actions">{note(`Disconnected — the ${deviceNoun} is away, running its onboard memory`)}</div>;
  }
  if (!isOnboardScope(scope)) return null;

  return (
    <div className="pb-actions">
      {dirty ? (
        <>
          {/* Short on purpose: the strip is one line and the Save button already
              names where the changes are going. */}
          {note('Unsaved changes', 'pb-warn')}
          <Button size="sm" onClick={state.undo}>
            Undo
          </Button>
          <Button size="sm" variant="accent" onClick={state.save}>
            Save to {slotLabel(scope)}
          </Button>
        </>
      ) : (
        // role="status" because it leaves: a message that retires has to be
        // announced when it arrives, or a screen-reader user meets an empty
        // strip. The standing state stays readable in the selector.
        note(
          slotSource === 'device'
            ? `Switched to ${slotLabel(scope)} on the ${deviceNoun} — travels with it`
            : slotSource === 'reconnect'
              ? `Came back running ${slotLabel(scope)} — it was switched while away`
              : `Running on the ${deviceNoun} — travels with it`,
          'pb-ok pb-transient' + (noteFaded ? ' faded' : ''),
          'status',
        )
      )}
    </div>
  );
}
