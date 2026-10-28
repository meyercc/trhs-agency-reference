// The notebook's 3D hero: one machine (laptopModel.ts) under a camera that
// moves to a shot per tab — the front for Performance, the side for Settings,
// down onto the keyboard for Lights and Keys & Macros, behind the lid for the
// logo, low at the front for the light bar.
//
// The keyboard shot is solved against the drawn board on the page: the camera
// lands where the 3D board covers exactly the drawn one's box, and the host
// shows the drawn board (the one you click) once the camera is there.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { LightCaps } from '../pcLighting';
import { buildLaptop, type LaptopMachine, type LaptopPaint, type LaptopRig } from './laptopModel';
import { fly, frameBox, type Shot } from './flight';

export type LaptopPose = 'front' | 'side' | 'pair' | 'keyboard' | 'logo' | 'bar' | 'macro';

export interface LaptopStageState {
  pose: LaptopPose;
  /** False while the camera is on its way. */
  arrived: boolean;
}

/**
 * Where each shot looks from (toward the camera), and how much room it leaves.
 * The Lighting tab shows two of the machine, as a product shot does (JY,
 * 2026-10-21): one open to the camera, and behind it to the right one turned
 * away, its lid's outside — the logo — to the camera. `pair` frames both;
 * `keyboard` and `macro` look down at the front machine's board; `logo` at
 * the back machine's lid. The twin is in the picture only where the whole
 * machine or its lid is the subject; a zoom on the board is of one machine.
 */
type ShotSpec = { of: 'front' | 'twin' | 'pair'; box: keyof LaptopRig['boxes']; dir: [number, number, number]; margin: number };
const SHOTS: Record<LaptopPose, ShotSpec> = {
  front: { of: 'front', box: 'all', dir: [-0.62, 0.5, 1], margin: 1.08 },
  side: { of: 'front', box: 'all', dir: [1, 0.42, 0.62], margin: 1.08 },
  pair: { of: 'pair', box: 'all', dir: [-0.3, 0.42, 1], margin: 1.04 },
  keyboard: { of: 'front', box: 'keyboard', dir: [0, 1, 0.42], margin: 1.06 },
  logo: { of: 'twin', box: 'lid', dir: [0.25, 0.28, 1], margin: 1.12 },
  bar: { of: 'front', box: 'front', dir: [-0.3, 0.34, 1], margin: 1.12 },
  macro: { of: 'front', box: 'macro', dir: [-0.3, 1, 0.55], margin: 1.12 },
};
/** The shots the back machine is in the picture for. */
const TWIN_POSES: ReadonlySet<LaptopPose> = new Set<LaptopPose>(['pair', 'logo']);

export class LaptopScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private rig: LaptopRig;
  /** The second machine, turned away, for the Lighting tab's shots. */
  private twin: LaptopRig;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private cancelFlight: () => void = () => {};
  private flying = false;
  /** The user turned the machine since the last shot: a resize leaves it be. */
  private userMoved = false;
  private pose: LaptopPose = 'front';

  constructor(
    private host: HTMLElement,
    caps: LightCaps,
    machine: LaptopMachine,
    private onState: (s: LaptopStageState) => void,
  ) {
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 400;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); // kept, so a screenshot of the page shows the canvas
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.className = 'lst-canvas';
    host.appendChild(canvas);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.4;
    env.dispose?.();
    pmrem.dispose();

    // A product shot on a dark canvas: a soft key from the front left, two rims
    // that draw the silhouette, a top light for the deck and the lid's back.
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-0.7, 1.1, 1.0);
    this.scene.add(key);
    const rimL = new THREE.DirectionalLight(0x9db4ff, 1.25);
    rimL.position.set(-1.2, 0.5, -1.0);
    this.scene.add(rimL);
    const rimR = new THREE.DirectionalLight(0xffc9d6, 1.2);
    rimR.position.set(1.3, 0.6, -0.6);
    this.scene.add(rimR);
    const top = new THREE.DirectionalLight(0xe6ecff, 0.9);
    top.position.set(0.2, 1.6, -0.3);
    this.scene.add(top);
    this.scene.add(new THREE.HemisphereLight(0xc8d0e0, 0x0b0d12, 0.45));

    this.camera = new THREE.PerspectiveCamera(28, w / h, 0.01, 20);
    this.camera.position.set(-0.5, 0.45, 0.9);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 2.4;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
    });

    this.rig = buildLaptop(caps, machine);
    this.rig.group.position.x = -0.2;
    this.scene.add(this.rig.group);
    // The twin: the same machine, turned round, a little behind and to the
    // right, so its lid's outside faces the camera beside the open one.
    this.twin = buildLaptop(caps, machine);
    this.twin.group.rotation.y = Math.PI;
    this.twin.group.position.set(0.24, 0, -0.12);
    this.twin.group.visible = false;
    this.scene.add(this.twin.group);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.loop();
    // For the verify scripts and the console: where the camera is.
    if (import.meta.env.DEV) (window as unknown as { __laptopStage?: LaptopScene }).__laptopStage = this;
  }

  /** The camera and the shot it is on, for checks. */
  debug() {
    return {
      pose: this.pose,
      flying: this.flying,
      camera: this.camera.position.toArray().map((v) => +v.toFixed(4)),
      target: this.controls.target.toArray().map((v) => +v.toFixed(4)),
      /** The 3D board's corners on screen, relative to the hero. */
      board: (() => {
        const { center, width, depth } = this.rig.board;
        const w = this.host.clientWidth;
        const h = this.host.clientHeight;
        const pt = (x: number, z: number) => {
          const v = new THREE.Vector3(center.x + x, center.y, center.z + z).applyMatrix4(this.rig.group.matrixWorld).project(this.camera);
          return [+(((v.x + 1) / 2) * w).toFixed(1), +(((1 - v.y) / 2) * h).toFixed(1)];
        };
        return { tl: pt(-width / 2, -depth / 2), br: pt(width / 2, depth / 2) };
      })(),
    };
  }

  paint(p: LaptopPaint) {
    this.rig.paint(p);
    // The back machine wears the same lights, with no selection drawn on it.
    this.twin.paint({ ...p, selected: undefined });
  }

  /** Move to a shot. */
  setPose(pose: LaptopPose, opts: { animate: boolean }) {
    const same = pose === this.pose && !this.flying;
    this.pose = pose;
    this.userMoved = false;
    this.cancelFlight();
    this.twin.group.visible = TWIN_POSES.has(pose);
    const shot = this.shotFor(pose);
    const animate = opts.animate && !same;
    this.flying = animate;
    this.onState({ pose, arrived: !animate });
    // The shot is asked again every frame: the hero can still be settling
    // into the new tab while the camera moves.
    const to = () => this.shotFor(pose);
    this.cancelFlight = fly({ camera: this.camera, controls: this.controls }, animate ? to : shot, {
      ms: animate ? undefined : 0,
      alive: () => !this.disposed,
      onDone: () => {
        this.flying = false;
        if (animate) this.onState({ pose, arrived: true });
      },
    });
  }

  /** The box a shot frames, in the scene's space. */
  private boxFor(spec: ShotSpec): THREE.Box3 {
    const world = (rig: LaptopRig, box: keyof LaptopRig['boxes']) => {
      rig.group.updateMatrixWorld(true);
      if (box === 'lid') return new THREE.Box3().setFromObject(rig.lid);
      return rig.boxes[box].clone().applyMatrix4(rig.group.matrixWorld);
    };
    if (spec.of === 'pair') return world(this.rig, 'all').union(world(this.twin, 'all'));
    return world(spec.of === 'twin' ? this.twin : this.rig, spec.box);
  }

  private shotFor(pose: LaptopPose): Shot {
    const s = SHOTS[pose];
    return frameBox(this.boxFor(s), new THREE.Vector3(...s.dir), this.camera, s.margin);
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Keep the shot framed as the hero changes size — unless the user has
    // turned the machine, or the camera is mid-flight.
    if (this.flying || this.userMoved) return;
    const shot = this.shotFor(this.pose);
    this.camera.position.copy(shot.position);
    this.controls.target.copy(shot.target);
    this.camera.lookAt(shot.target);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    if (!this.flying && this.controls.enabled) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.cancelFlight();
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.rig.dispose();
    this.twin.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
