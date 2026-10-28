import { Button, ModalShell } from '../../components';
import {
  ago,
  revertChange,
  revertState,
  signatureFor,
  useChangeRecords,
  type ChangeRecord,
  type ChangeTarget,
} from '../../state/changeLog';

// ── The record's door: what software changed on this page (PerformV7) ──
// perform.5: every automatic write is kept in a record behind a door, found
// when someone looks (perform#open:1 asked where the door is; it is on the
// page's title row, because the record spans Performance and Maintenance).
// perform.33: nothing announces a write as it happens — this list is where
// it is found afterwards.
//
// Lists the automatic writes only: the player's own changes are in the record
// (they are what takes a signature off a card) but are not listed here. Newest
// first. Each row: who · what · when · Revert, or why there is nothing to
// revert. Only the latest change to a setting can be reverted (§3.5: no half-
// reverted state), so an older one says it was changed again since.

const STATE_TEXT: Record<Exclude<ReturnType<typeof revertState>, 'open'>, string> = {
  reverted: 'Reverted',
  restored: 'Restored when the game closed',
  'changed-since': 'Changed again since',
  final: "Deleted files can't be restored",
};

export interface ChangesModalProps {
  /** The cards on the page now: a change to a feature the page does not show is not listed. */
  targets: ChangeTarget[];
  onClose?: () => void;
}

export function ChangesModal({ targets, onClose }: ChangesModalProps) {
  const records = useChangeRecords();
  const rows = records.filter((r) => r.source !== 'user' && targets.includes(r.target)).reverse();

  return (
    <ModalShell title="Changes" onClose={onClose} className="pv7-changes" width="narrow">
      {rows.length === 0 ? (
        <div className="pv7-changes-empty">No automatic changes yet.</div>
      ) : (
        <ul className="pv7-changes-list">
          {rows.map((r) => (
            <ChangeRow key={r.id} record={r} state={revertState(r, records)} />
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

function ChangeRow({ record: r, state }: { record: ChangeRecord; state: ReturnType<typeof revertState> }) {
  return (
    <li className="pv7-change" data-change={r.id} data-target={r.target}>
      <div className="pv7-change-main">
        <span className="pv7-change-by">{signatureFor(r)}</span>
        <span className="pv7-change-what">{r.summary}</span>
        <time className="pv7-change-at" dateTime={new Date(r.at).toISOString()} title={new Date(r.at).toLocaleString()}>
          {ago(r.at)}
        </time>
      </div>
      <div className="pv7-change-act">
        {state === 'open' ? (
          <Button variant="ghost" size="sm" onClick={() => revertChange(r.id)}>
            Revert
          </Button>
        ) : (
          <span className="pv7-change-state">{STATE_TEXT[state]}</span>
        )}
      </div>
    </li>
  );
}
