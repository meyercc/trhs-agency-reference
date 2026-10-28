import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backdrop, Button } from '../components';
import { FanKitCanvas } from '../devices/FanKitCanvas';
import { resetFanKit } from '../devices/fanKit';

/* The cooler cap and the DIY fan kit (OpenGSW lcd-diy). The test doors only:
   the cap's opens its registry address, which lands on the PC page's LCD
   cooler cap tab like every other door to it (lcd-diy.25; JY, 2026-10-22). */
export function CoolerCapLabPlate() {
  const [, setParams] = useSearchParams();
  const [kitOpen, setKitOpen] = useState(false);
  return (
    <section className="clab-plate" data-plate="cooler-cap">
      <h2>
        PC parts · Cooler cap and DIY fan kit <span className="clab-ref">OpenGSW lcd-diy</span>
      </h2>
      <p className="clab-cap">
        <b>One place for each part.</b> The cap opens by its registry address, which lands on the
        PC page at its LCD cooler cap tab (out of scope under June 2027). The fan kit has no
        registry entry yet, so its window opens here directly. Both carry their own
        &ldquo;Simulate&rdquo; buttons for what the prototype cannot do: sleep, restart, a fan
        plugged in.
      </p>
      <div className="mlab-facts">
        <Button size="sm" onClick={() => setParams({ sku: 'forge-45l-cooler-cap' })}>
          Open the cooler cap
        </Button>
        <Button size="sm" onClick={() => setKitOpen(true)}>
          Open the DIY fan kit
        </Button>
        <Button size="sm" variant="ghost" onClick={resetFanKit}>
          Reset the fan kit
        </Button>
      </div>
      {kitOpen && (
        <>
          <Backdrop onClick={() => setKitOpen(false)} />
          <FanKitCanvas onClose={() => setKitOpen(false)} />
        </>
      )}
    </section>
  );
}
