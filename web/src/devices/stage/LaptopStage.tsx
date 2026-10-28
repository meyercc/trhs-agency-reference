import { useEffect, useRef } from 'react';
import type { LightCaps } from '../pcLighting';
import type { LaptopMachine, LaptopPaint } from './laptopModel';
import { LaptopScene, type LaptopPose, type LaptopStageState } from './laptopScene';
import './stage.css';

/**
 * The notebook's 3D hero (LaptopCanvas). Lazy-loaded with three.js, so the
 * page draws its photo until this arrives. `onState` reports where the
 * camera is; null means the browser refused a 3D canvas and the host should
 * fall back to its photo.
 */
export default function LaptopStage({
  caps,
  machine,
  paint,
  pose,
  onState,
}: {
  caps: LightCaps;
  /** The keyboard the model builds: a numpad, and how many macro keys. */
  machine: LaptopMachine;
  paint: LaptopPaint;
  pose: LaptopPose;
  onState: (s: LaptopStageState | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LaptopScene | null>(null);
  const latest = useRef({ paint, pose, onState });
  latest.current = { paint, pose, onState };

  useEffect(() => {
    if (!hostRef.current) return;
    let scene: LaptopScene;
    try {
      scene = new LaptopScene(hostRef.current, caps, machine, (s) => latest.current.onState(s));
    } catch (e) {
      console.warn('[laptop stage] no 3D context', e);
      latest.current.onState(null);
      return;
    }
    sceneRef.current = scene;
    scene.paint(latest.current.paint);
    scene.setPose(latest.current.pose, { animate: false });
    return () => {
      scene.dispose();
      sceneRef.current = null;
      latest.current.onState(null);
    };
  }, [caps.keyboard, caps.bar, caps.logo, machine.numpad, machine.macroKeys]);

  useEffect(() => {
    sceneRef.current?.paint(paint);
  }, [paint]);

  // A frame later, so the hero has taken its new size before the shot is worked out.
  useEffect(() => {
    const id = requestAnimationFrame(() => sceneRef.current?.setPose(pose, { animate: true }));
    return () => cancelAnimationFrame(id);
  }, [pose]);

  return <div ref={hostRef} className="lst" aria-hidden="true" />;
}
