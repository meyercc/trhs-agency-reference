import type { ReactNode } from 'react';
import './device-settings.css';
import { Button, Icon, Ng3Label, Ng3Section, type IconName } from '../components';

/**
 * The device card every Settings tab opens with (Figma Device Settings
 * 10461:54650 for the headset, 12065:12944 for the SoloCast): the product's
 * name, its firmware line, Device Manager / Get Support, an optional partner
 * credit and an optional OS hand-off pinned to the card's floor. One
 * composition for every canvas, so the headset's and the mic's read the same.
 */
export interface DeviceSettingsCardProps {
  name: string;
  firmware?: string | null;
  /** Show the Device Manager button (default yes). */
  deviceManager?: boolean;
  /** Show the Get Support button (default yes). */
  getSupport?: boolean;
  /** Partner wordmark credit — "Audio powered by …". The text names it for anyone who can't see the mark. */
  audioCredit?: string | null;
  /** A hand-off to the OS on the card's floor, e.g. Windows Sound Devices. */
  handoff?: { label: string; icon: IconName };
  /** Extra rows between the buttons and the floor. */
  children?: ReactNode;
  className?: string;
}

export function DeviceSettingsCard({
  name,
  firmware,
  deviceManager = true,
  getSupport = true,
  audioCredit,
  handoff,
  children,
  className,
}: DeviceSettingsCardProps) {
  return (
    <Ng3Section className={['dsc', className].filter(Boolean).join(' ')}>
      <Ng3Label strong>{name}</Ng3Label>
      {firmware && <p className="dsc-fw">Firmware Version {firmware}</p>}
      {(deviceManager || getSupport) && (
        <div className="dsc-btns">
          {deviceManager && (
            <Button>
              <Icon name="screen-mirror" size={16} />
              Device Manager
            </Button>
          )}
          {getSupport && (
            <Button>
              <Icon name="question" size={16} />
              Get Support
            </Button>
          )}
        </div>
      )}
      {audioCredit && (
        <p className="dsc-credit">
          <span>Audio powered by</span>
          <Icon name="hear360" className="dsc-hear360" label={audioCredit} />
        </p>
      )}
      {children}
      {handoff && (
        <Button className="dsc-handoff">
          <Icon name={handoff.icon} size={16} />
          {handoff.label}
        </Button>
      )}
    </Ng3Section>
  );
}
