import { useState } from 'react';
import { Backdrop, Button, Toggle, ToggleButtonGroup } from '../components';
import { DesktopCanvas } from '../devices/DesktopCanvas';
import { getResolvedSku } from '../devices/skus';
import { CHASSIS_FANS, CPU_FAN, DEFAULT_MACHINE, writeMachine } from '../lightstudio/towerZones';
import { useChassisMachine } from '../lightstudio/ChassisLights';

/**
 * The desktop's Lights panel on its own, for review: the machine it runs on (what the lighting board found, the
 * memory, the card) and a door that opens the desktop's window on Lights.
 * The machine switches are the lab's stand-in for what the PC reports.
 */
export function ChassisLightingPlate() {
  const m = useChassisMachine();
  const [open, setOpen] = useState(false);
  const sku = getResolvedSku('forge-45l');

  return (
    <section className="clab-plate" aria-label="Desktop lights">
      <h2>
        Desktop lights · ARGB Gen2 <span className="clab-ref">lightstudio/ChassisLights.tsx</span>
      </h2>
      <p className="clab-cap">
        <b>The desktop's Lights tab, by zone.</b> Fans on the lighting board, memory and an HP-supplied graphics card;
        a part the machine lacks is not offered (lighting-family.6, lighting.7).
      </p>
      <div className="mlab-toggles" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gutter)', alignItems: 'center' }}>
        <label>
          Memory modules{' '}
          <ToggleButtonGroup
            options={[0, 1, 2, 4].map((n) => ({ label: String(n), value: String(n) }))}
            value={String(m.modules)}
            onChange={(v) => writeMachine({ ...m, modules: Number(v) })}
            aria-label="Memory modules"
          />
        </label>
        <label>
          <Toggle checked={m.hpGpu} onChange={(v) => writeMachine({ ...m, hpGpu: v })} aria-label="HP-supplied graphics card" /> HP-supplied
          graphics card
        </label>
        <label>
          Board fans found{' '}
          <ToggleButtonGroup
            options={[1, 3, 5].map((n) => ({ label: String(n), value: String(n) }))}
            value={String(m.fans.filter((f) => f !== CPU_FAN).length)}
            onChange={(v) =>
              writeMachine({ ...m, fans: [...CHASSIS_FANS.filter((f) => f.id !== CPU_FAN).slice(0, Number(v)).map((f) => f.id), CPU_FAN] })
            }
            aria-label="Fans found"
          />
        </label>
        <Button variant="ghost" size="sm" onClick={() => writeMachine(DEFAULT_MACHINE)}>
          Full machine
        </Button>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!sku}>
          Open the desktop's Lights
        </Button>
      </div>
      {open && sku && (
        <>
          <Backdrop open onClick={() => setOpen(false)} />
          <DesktopCanvas sku={sku} initialTab="lighting" onClose={() => setOpen(false)} />
        </>
      )}
    </section>
  );
}
