// One camera move, shared by the desktop's tower (lightstudio/scene.ts) and
// the notebook (LaptopStage): from where the camera is to a shot, over a
// fixed time. The camera swings around the point it looks at instead of
// sliding in a straight line, so going from the front of a machine to its
// back passes beside it rather than through it.

import * as THREE from 'three';

export interface Shot {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface Flyable {
  camera: THREE.PerspectiveCamera;
  /** OrbitControls, or anything with a target it looks at. */
  controls: { target: THREE.Vector3; update?: () => void };
}

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** How long a move takes. Short hops stay short. */
export const FLIGHT_MS = 850;

/**
 * Move the camera to `to`. Returns a cancel function; a new flight should
 * cancel the one before it. `onDone` runs when the camera arrives (at once
 * under reduced motion), not when cancelled.
 *
 * `to` may be a function: it is asked again every frame, so a shot that
 * depends on the page (the drawn board's box, the hero's size) follows the
 * page as it settles during the move.
 */
export function fly(
  rig: Flyable,
  to: Shot | (() => Shot | null),
  opts: { ms?: number; onDone?: () => void; alive?: () => boolean } = {},
): () => void {
  const { camera, controls } = rig;
  const ms = reduceMotion() ? 0 : (opts.ms ?? FLIGHT_MS);
  const fromTarget = controls.target.clone();
  const fromOffset = camera.position.clone().sub(fromTarget);
  const r0 = fromOffset.length();
  const dir0 = fromOffset.clone().normalize();
  let last: Shot | null = typeof to === 'function' ? to() : to;
  const shot = (): Shot | null => {
    if (typeof to === 'function') last = to() ?? last;
    return last;
  };

  const land = (end: Shot) => {
    camera.position.copy(end.position);
    controls.target.copy(end.target);
    camera.lookAt(end.target);
    controls.update?.();
  };
  const place = (k: number, end: Shot) => {
    const toOffset = end.position.clone().sub(end.target);
    const q = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(dir0, toOffset.clone().normalize()), k);
    const target = fromTarget.clone().lerp(end.target, k);
    const offset = dir0.clone().applyQuaternion(q).multiplyScalar(r0 + (toOffset.length() - r0) * k);
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
    camera.lookAt(target);
    controls.update?.();
  };

  if (!last) {
    opts.onDone?.();
    return () => {};
  }
  if (ms <= 0 || r0 < 1e-9) {
    land(last);
    opts.onDone?.();
    return () => {};
  }

  let raf = 0;
  let stopped = false;
  const t0 = performance.now();
  const step = () => {
    if (stopped || (opts.alive && !opts.alive())) return;
    const k = Math.min(1, (performance.now() - t0) / ms);
    const end = shot()!;
    if (k < 1) {
      place(easeInOut(k), end);
      raf = requestAnimationFrame(step);
    } else {
      land(end);
      opts.onDone?.();
    }
  };
  raf = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * A shot that frames a box from a direction: every corner of the box lands
 * inside the view, with `margin` to spare (1.2 = the box fills 1/1.2 of the
 * tighter side). `lift` raises the aim point by a share of the box height.
 *
 * `share` is for a view part of which is covered (the PC page's floating
 * cards): the width and height, as shares of the whole view, of the part left
 * uncovered. The box is then fitted to that part, whose middle the aim point
 * lands on once the camera's view offset is set to match (the scene's
 * `setInsets`). Left out, the box is fitted to the whole view.
 */
export function frameBox(
  box: THREE.Box3,
  dir: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  margin = 1.2,
  lift = 0,
  share?: { w: number; h: number },
): Shot {
  const target = box.getCenter(new THREE.Vector3());
  target.y += box.getSize(new THREE.Vector3()).y * lift;
  const back = dir.clone().normalize();
  const forward = back.clone().negate();
  const worldUp = Math.abs(forward.y) > 0.999 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = forward.clone().cross(worldUp).normalize();
  const up = right.clone().cross(forward);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (share?.h ?? 1);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * (share?.w ?? 1);
  let dist = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const c = new THREE.Vector3(x, y, z).sub(target);
        const depth = c.dot(forward);
        dist = Math.max(dist, (Math.abs(c.dot(right)) * margin) / tanH - depth, (Math.abs(c.dot(up)) * margin) / tanV - depth);
      }
  const position = target.clone().add(back.multiplyScalar(dist));
  return { position, target };
}
