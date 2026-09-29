import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ContextMenu, Dropdown, Icon, Input, ListItem, Ng3Label } from '../components';
import type { CustomEqPreset } from '../state/Settings';
import { EqCurve, TEST_CLIPS } from './eqData';
import './eq-rail.css';

/**
 * The left rail both equalizer editors share: the preset list with its row
 * menu (Rename / Duplicate / Reset / Delete), and the test bench under it.
 *
 * The editors own the drafts and every mutation; the rail owns only what is
 * chrome — which row's menu is open, a rename in progress, and the test-bench
 * clip. Extracted from the Simple Equalizer the day the Advanced one needed
 * the same rail, so the two cannot drift.
 */
export interface EqPresetRailProps {
  presets: CustomEqPreset[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, label: string) => void;
  onDuplicate: (preset: CustomEqPreset) => void;
  onReset: (preset: CustomEqPreset) => void;
  onDelete: (preset: CustomEqPreset) => void;
  /** The 40×14 glyph points for a preset's row. */
  curve: (preset: CustomEqPreset) => string;
  /** What the info glyph beside "EQ Presets" explains. */
  presetsHelp?: React.ReactNode;
}

export interface EqPresetRailHandle {
  /** Close an open row menu. Returns true if one was open — the editor's Escape handler asks first. */
  closeMenu: () => boolean;
}

/** Roughly the row menu's height — only used to decide which way it opens. */
const MENU_H = 172;
const GUTTER = 8;

export const EqPresetRail = forwardRef<EqPresetRailHandle, EqPresetRailProps>(function EqPresetRail(
  { presets, selectedId, onSelect, onAdd, onRename, onDuplicate, onReset, onDelete, curve, presetsHelp },
  ref,
) {
  // ── Row menu ──────────────────────────────────────────────────────────────
  // The name is a label until you ask to change it: renaming is one action in
  // the row's menu, not a permanently-open field. An always-editable row reads
  // as unsaved and gives the caret somewhere to land on every selection.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // The menu is portalled to <body> and positioned from the button's rect.
  // Two reasons it cannot just live in the row: the preset list is a scroll
  // container, which clips an absolutely-positioned child; and .modal-shell
  // carries a backdrop-filter, which makes it the containing block for
  // `position: fixed` — so viewport coordinates land ~110px out while looking
  // perfectly correct in the inline style. Outside the shell, both go away.
  // Flips above the button when it would run off the bottom.
  const [menuAt, setMenuAt] = useState<{ top: number; right: number } | null>(null);
  const openMenu = (id: string, btn: HTMLElement) => {
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setMenuAt(
      below < MENU_H
        ? { top: Math.max(GUTTER, r.top - MENU_H - 4), right: window.innerWidth - r.right }
        : { top: r.bottom + 4, right: window.innerWidth - r.right },
    );
    setMenuFor(id);
  };
  useImperativeHandle(ref, () => ({
    closeMenu: () => {
      if (!menuFor) return false;
      setMenuFor(null);
      return true;
    },
  }));

  // A click anywhere else puts the menu away — the same shape LightingTab uses.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.seq-row-menu, .seq-cmenu')) setMenuFor(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const startRename = (p: CustomEqPreset) => {
    setMenuFor(null);
    setDraftName(p.label);
    setRenaming(p.id);
  };
  const commitRename = () => {
    if (renaming) onRename(renaming, draftName.trim() || 'Untitled');
    setRenaming(null);
  };
  const act = (fn: (p: CustomEqPreset) => void) => (p: CustomEqPreset) => {
    setMenuFor(null);
    fn(p);
  };

  // ── Test bench — no audio engine in the prototype, so a sample "plays" for a
  // few seconds and stops itself. The control is real; the sound is not.
  const [clip, setClip] = useState(TEST_CLIPS[0].value);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setPlaying(false), 4000);
    return () => clearTimeout(t);
  }, [playing, clip]);

  return (
    <div className="seq-rail">
      <section className="seq-rail-block">
        <Ng3Label strong tooltip={presetsHelp ?? 'Your own presets. Pick one to edit it; the row menu renames, copies, flattens or removes it.'}>
          EQ Presets
        </Ng3Label>
        <div className="seq-preset-list" role="listbox" aria-label="Your equalizer presets">
          <ListItem label="Add EQ Preset" leading={<Icon name="add-small" size={16} />} onClick={onAdd} />
          {presets.map((p) => (
            <div className="seq-row" key={p.id}>
              <ListItem
                role="option"
                aria-selected={p.id === selectedId}
                selected={p.id === selectedId}
                onClick={() => onSelect(p.id)}
                leading={<EqCurve points={curve(p)} />}
                label={
                  renaming === p.id ? (
                    <Input
                      className="seq-name"
                      autoFocus
                      value={draftName}
                      aria-label="Preset name"
                      onChange={(e) => setDraftName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        // Enter commits, Escape abandons. stopPropagation so
                        // Escape does not also close the modal behind it.
                        e.stopPropagation();
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                  ) : (
                    p.label
                  )
                }
                trailing={
                  <button
                    type="button"
                    className="seq-row-menu"
                    aria-label={`${p.label} options`}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuFor === p.id) setMenuFor(null);
                      else openMenu(p.id, e.currentTarget);
                    }}
                  >
                    <Icon name="more" size={16} />
                  </button>
                }
              />
              {menuFor === p.id &&
                menuAt &&
                createPortal(
                  <ContextMenu
                    className="seq-cmenu"
                    aria-label={`${p.label} options`}
                    style={{ top: menuAt.top, right: menuAt.right }}
                  >
                    <ListItem label="Rename" leading={<Icon name="edit" size={16} />} onClick={() => startRename(p)} />
                    <ListItem label="Duplicate" leading={<Icon name="duplicate" size={16} />} onClick={() => act(onDuplicate)(p)} />
                    <ListItem label="Reset" leading={<Icon name="reset" size={16} />} onClick={() => act(onReset)(p)} />
                    <ListItem label="Delete" leading={<Icon name="trash" size={16} />} onClick={() => act(onDelete)(p)} />
                  </ContextMenu>,
                  document.body,
                )}
            </div>
          ))}
        </div>
      </section>

      <section className="seq-rail-block seq-bench">
        <Ng3Label strong tooltip="Play a clip through the preset you are editing to hear the change.">
          Test Bench
        </Ng3Label>
        <Dropdown options={TEST_CLIPS} value={clip} onChange={setClip} aria-label="Choose audio" />
        <Button onClick={() => setPlaying((p) => !p)} aria-pressed={playing} className="seq-play">
          <Icon name={playing ? 'media-stop' : 'media-play'} size={16} />
          {playing ? 'Stop Sample' : 'Play Sample'}
        </Button>
      </section>
    </div>
  );
});
