import { CardDoor, Facts, FeatStatus } from './CardKit';

// ── OMEN AI card (PerformV6) ──
// V6 fork of perform5/OmenAiCard: identical anatomy and readings (its data is
// receipts by nature, so Facts stays the hero form). Readings persist through
// Inactive (history doesn't vanish). (Icon tiles tried and removed.)

export interface OmenAiCardProps {
  on: boolean;
  onConfigure: () => void;
  tracked?: number;
}

export function OmenAiCard({ on, onConfigure, tracked = 5 }: OmenAiCardProps) {
  return (
    <div className="ds-feature-card pv5-omen-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">OMEN AI</div>
        <CardDoor verb="settings" onClick={onConfigure} />
      </div>

      <FeatStatus word={on ? 'idle' : 'inactive'} /* V6 note: see V5 resting-state principle */ />

      <Facts
        items={[
          { label: 'Games tracked', value: String(tracked) },
          { label: 'Last optimized', value: 'Cyberpunk 2077 · 2h ago' },
        ]}
      />
    </div>
  );
}
