import { ModalShell } from '../components';
import { ForgeContent, ForgeNav, useForge, type ForgeSection } from './ForgeBody';
import './forge.css';

export type { ForgeSection };

/**
 * Forge (`?modal=agents`, optionally `&cat=<category>` / `&agent=<id>` /
 * `&listing=<id>`). It took the Agent Catalog's slot and URL, and its agents
 * are listings here — Assistants, beside the apps, skills and recipes.
 *
 * The Module Browser's shape — left nav, searchable right pane, a grid that
 * swaps to a detail page — so the two stores still read as the same room.
 */
export function ForgeModal({
  onClose,
  initialSection = 'discover',
  initialListingId,
}: {
  onClose: () => void;
  initialSection?: string;
  initialListingId?: string;
}) {
  const state = useForge({ initialSection, initialListingId });
  return (
    <ModalShell title="Forge" className="forge" onClose={onClose} left={<ForgeNav state={state} />}>
      <ForgeContent state={state} />
    </ModalShell>
  );
}
