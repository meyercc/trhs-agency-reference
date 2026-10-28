import { Badge, ModalShell, Ng3Label, Ng3Section, Ng3Spec } from '../components';
import { useSettings } from '../state/Settings';
import { getResolvedSku } from '../devices/skus';
import { aboutFacts } from '../devices/pcDirectory';
import { DeviceSettingsCard } from '../devices/DeviceSettingsCard';

/** HP's support site. The page for this exact machine needs its serial number,
 *  which the prototype's data does not carry. */
const SUPPORT_URL = 'https://support.hp.com';

/**
 * About this PC (`?modal=about-pc`), what the This PC button in My Devices
 * opens: the machine's own facts, the one thing about the PC that nothing else
 * in the app holds, and the device card every peripheral's Settings tab opens
 * with — the firmware line, Device Manager, Get Support (DeviceSettingsCard).
 * The PC's page has no Settings tab; this is where that card lives for the PC
 * (the user's arrangement, 2026-10-21). Nothing here is new content: the card
 * is the peripherals' as it is.
 *
 * Its spec sheet used to sit with System Vitals; it left because a spec sheet
 * does not belong with live readings, and this is where it lands (OpenGSW,
 * system-vitals: "does the hardware spec stay at all, and where?"). Machine
 * facts and HP's links live here; the app's own help, version and feedback stay
 * in Settings (help-feedback, open question 1, the split answer).
 *
 * One subject, so the narrow shell. Read-only: nothing here changes the
 * machine. Every row comes from the SKU's data, and a row the data does not
 * hold is not drawn.
 */
export function AboutPcModal({ onClose }: { onClose: () => void }) {
  const { thisPc, mvpScope } = useSettings();
  const pc = getResolvedSku(thisPc);
  if (!pc) return null;
  const ports = Array.isArray(pc.features.io) ? (pc.features.io as string[]) : [];
  const facts = aboutFacts(pc, mvpScope);

  return (
    <ModalShell title="About this PC" width="narrow" onClose={onClose}>
      {/* The peripherals' device card, unchanged: the name, the firmware line,
          Device Manager and Get Support (HP's support site, a new window). */}
      <DeviceSettingsCard
        name={pc.name}
        firmware={typeof pc.features.firmware === 'string' ? pc.features.firmware : null}
        onGetSupport={() => window.open(SUPPORT_URL, '_blank', 'noopener')}
      />
      <Ng3Section>
        <Ng3Label strong>Specifications</Ng3Label>
        {/* The card above names the machine and its firmware already. */}
        <Ng3Spec items={facts.filter((f) => f.label !== 'Model' && f.label !== 'Firmware')} />
      </Ng3Section>
      {ports.length > 0 && (
        <Ng3Section>
          <Ng3Label strong>Ports</Ng3Label>
          {/* The same tag row the part spec sheets draw their outputs with. */}
          <div className="sc-tags">
            {ports.map((port) => (
              <Badge key={port} variant="status" tone="neutral">
                {port}
              </Badge>
            ))}
          </div>
        </Ng3Section>
      )}
    </ModalShell>
  );
}
