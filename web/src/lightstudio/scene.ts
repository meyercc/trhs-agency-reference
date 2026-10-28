// ══════════════════════════════════════════════════════════════════════════
// Light Studio — 3D digital-desk scene controller (React port of the vanilla
// js/light-studio-v2.js). Framework-agnostic imperative Three.js: six devices
// (2 GLB + 3 OBJ + procedural mic) on a desk, OrbitControls, click-to-select
// (shift = multi) + drag along the desk, per-device RGB (color/effect/brightness
// /speed) driving emissive meshes + point lights, and camera-view presets. The
// React component owns the DOM/controls and drives this via the public methods;
// selection/state changes flow back through the `onChange` callback.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { DEVICE_IDS, LIT_DEVICE_IDS, isLit, type DeviceId, type Effect } from './lighting';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { fly, frameBox } from '../devices/stage/flight';
import { CAP_SCREEN_NODE, CapScreen, type CapScreenLook } from './capScreen';

// Device assets, imported by name rather than globbed. An eager glob over the
// asset folder emits EVERY file in it — including the spare headset variants
// and the retired keyboard OBJ — which put ~38MB of models nobody references
// into each build. Add an import here when a device starts using a model.
import towerUrl from '../../../Assets/3d-devices/coldsnap-35l.glb?url';
import {
  CHASSIS_FANS,
  FAN_LEDS,
  GPU_LEDS,
  MEMORY_LEDS,
  TOWER_NODES,
  clearsZones,
  ledAt,
  panelDrives,
  onMachine,
  readMachine,
  chassisOf,
  type ChassisLighting,
  type ChassisZoneId,
} from './towerZones';
import headsetUrl from '../../../Assets/3d-devices/koala-velvet.glb?url';
import mouseUrl from '../../../Assets/3d-devices/generic-mouse.obj?url';
import monitorUrl from '../../../Assets/3d-devices/monitor.obj?url';

/** How close the camera may come to the whole desk. */
const DESK_MIN_DISTANCE = 2.5;

/** Give the desk up as unloadable after this long and show what did arrive. */
const LOAD_TIMEOUT_MS = 12000;

/**
 * One Draco decoder for the whole app. Every DRACOLoader spins up its own wasm
 * workers, so a page that builds the studio many times (the Mode tile, the
 * modals, every hot reload) ran the browser out of Wasm memory and the models
 * stopped arriving at all. Shared, it is never disposed.
 */
let draco: DRACOLoader | undefined;
function sharedDraco(): DRACOLoader {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  }
  return draco;
}

export { DEVICE_IDS, LABELS } from './lighting';
export type { DeviceId, Effect } from './lighting';

// HyperX brand red, for the HyperX effect.
const HYPERX_RED = new THREE.Color(224 / 255, 56 / 255, 62 / 255);
const WHITE = new THREE.Color(1, 1, 1);
/** Stable 0–1 pseudo-random from a number (per-device sparkle / confetti). */
const hash01 = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** How far the selection halo sits outside a device's footprint, and how wide
 *  its line is (scene units; the mic's base is 0.48 across the radius). */
const HALO_GAP = 0.08;
const HALO_LINE = 0.05;
/** A rounded-rectangle outline around a footprint of half-width `hw` and
 *  half-depth `hd`. The corner radius is the shorter half-side, so a round
 *  footprint (the mic) gets a circle and a long one (the keyboard) a pill. */
function haloGeometry(hw: number, hd: number): THREE.ShapeGeometry {
  const rect = (path: THREE.Path, w: number, d: number) => {
    const r = Math.min(w, d);
    path.moveTo(-w + r, -d);
    path.lineTo(w - r, -d);
    path.absarc(w - r, -d + r, r, -Math.PI / 2, 0, false);
    path.lineTo(w, d - r);
    path.absarc(w - r, d - r, r, 0, Math.PI / 2, false);
    path.lineTo(-w + r, d);
    path.absarc(-w + r, d - r, r, Math.PI / 2, Math.PI, false);
    path.lineTo(-w, -d + r);
    path.absarc(-w + r, -d + r, r, Math.PI, Math.PI * 1.5, false);
    return path;
  };
  const shape = rect(new THREE.Shape(), hw + HALO_LINE, hd + HALO_LINE) as THREE.Shape;
  shape.holes.push(rect(new THREE.Path(), hw, hd));
  return new THREE.ShapeGeometry(shape, 24);
}

export interface DeviceState {
  color: string; // "r,g,b"
  effect: Effect;
  brightness: number; // 0–100
  speed: number; // 1–10
  /** The preset this lighting was picked from — tells apart presets that light
   *  the same (Blue Skye and Captain America). */
  preset?: string;
  /** The tower only: the Lights panel's state (see towerZones.ts). */
  chassis?: ChassisLighting;
}
export type CameraView = 'front' | 'three-quarter' | 'top' | 'side';

/**
 * Where the camera looks at a focused device from — This PC's page moves it
 * per tab and per part (devices/stage/desktopShots.ts). `dir` points from the
 * device toward the camera, in the scene's axes (the tower's glass is −x, its
 * front +z). The camera frames `node` (a part of the model, matched loosely
 * by name), or `box` (a share of the device's box, 0–1 on each axis), or the
 * whole device; `margin` is the room left around it.
 */
export interface FocusShot {
  dir: [number, number, number];
  node?: string;
  box?: [[number, number, number], [number, number, number]];
  margin?: number;
}

/**
 * The part of the view a host covers with cards of its own, in CSS px in from
 * each edge (the PC page's full-screen layout: the panel at the bottom, the
 * cap's preview on the right). The focused device is framed in what is left
 * and centred on it, rather than on the whole canvas.
 */
export interface ViewInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const NO_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const noInsets = (i: ViewInsets) => !i.top && !i.right && !i.bottom && !i.left;
const sameInsets = (a: ViewInsets, b: ViewInsets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

/** How far the lights `setDimExcept` dims go down. Linear: through sRGB and
 *  tone mapping, 0.2 still read as about half lit, so dimmed parts go to a
 *  twentieth and read as dark (JY, 2026-10-22). */
const DIM_LEVEL = 0.05;
/** How long a dim takes to come or go, in seconds. */
const DIM_FADE_S = 0.3;
const ZONES: readonly ChassisZoneId[] = ['fans', 'memory', 'gpu'];
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A place on the desk a label can sit on: a device, or one of the tower's
 *  lit parts. Personalize's Lighting overview pins each look to its hardware.
 *  (JY, 2026-10-21: ported by hand from jy/light-overview 974fd07.) */
export type AnchorId = DeviceId | `tower:${ChassisZoneId}`;
/** Where an anchor is on the canvas, in CSS px from its top-left. `shown` is
 *  false while it is hidden (a focus on another device, a part the machine
 *  lacks) or out of frame. */
export interface AnchorPos {
  id: AnchorId;
  x: number;
  y: number;
  shown: boolean;
}
/** View the studio opens on. Exported so the React HUD can't drift from it. */
export const DEFAULT_CAMERA_VIEW: CameraView = 'front';

export interface UIState {
  selected: DeviceId[];
  sync: boolean;
  /** Effective target state (first selected / any device in sync) or null. */
  target: DeviceState | null;
  cameraView: CameraView;
  /** Every device's lighting, so a host that owns lighting state can mirror it. */
  states: DeviceStates;
}

export type DeviceStates = Record<DeviceId, DeviceState>;

interface DeviceObj {
  group: THREE.Group;
  rgbMeshes: THREE.Mesh[];
  pointLight: THREE.PointLight;
  /** Extra RGB-driven lights baked into a model (e.g. the monitor back wash). */
  extraLights: THREE.PointLight[];
  halo: THREE.Mesh;
  defaultPos: THREE.Vector3;
  /** The tower only: its lit parts, LED by LED (see `rigTower`). */
  rig?: LedPart[];
}

/** The most LEDs one lit mesh carries: two fans of twelve. */
const MAX_SLOTS = 24;

/**
 * One lit part of the tower — a fan mesh, the memory, the graphics card's bar
 * — as LEDs. Each vertex knows its LED (a static attribute); the LEDs'
 * colours are uniforms, so a frame sets a couple of dozen colours rather
 * than every vertex.
 */
interface LedPart {
  zone: ChassisZoneId;
  /** Fans: the fans on this mesh, in slot order (fan k's LEDs start at k × leds). */
  fanIds?: string[];
  leds: number;
  slots: THREE.Vector3[];
  /** The mesh, so a part the machine lacks can hide. */
  mesh: THREE.Mesh;
}

/** A lit material that glows in its LEDs' colours. */
function ledGlow(base: THREE.Material | undefined, slots: THREE.Vector3[]): THREE.MeshStandardMaterial {
  const m = (base as THREE.MeshStandardMaterial | undefined)?.clone() ?? new THREE.MeshStandardMaterial();
  m.color = new THREE.Color(0, 0, 0);
  m.emissive = new THREE.Color(1, 1, 1);
  m.emissiveIntensity = 1.6;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLeds = { value: slots };
    shader.vertexShader = `attribute float aLed;\nuniform vec3 uLeds[${MAX_SLOTS}];\nvarying vec3 vLed;\n` +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLed = uLeds[int(aLed + 0.5)];');
    shader.fragmentShader = 'varying vec3 vLed;\n' +
      shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vLed;');
  };
  m.customProgramCacheKey = () => 'led-glow';
  return m;
}

const DEFAULT_STATE = (): DeviceState => ({ color: '168,85,247', effect: 'solid', brightness: 80, speed: 5 });

export class LightStudioScene {
  private canvas: HTMLCanvasElement;
  private viewport: HTMLElement;
  private onChange: (s: UIState) => void;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private composer?: EffectComposer;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private deskPlane!: THREE.Mesh;
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private raf = 0;
  /**
   * Why the desk is not drawing right now. It renders every frame through the
   * bloom composer, and nothing else on the page can respond while it does:
   * measured 2026-10-01 with the Profiles modal open over Personalize, an
   * EMPTY frame took 36–91 ms, so every click in the modal (Game Link, a day
   * chip) waited 110–175 ms to show. A desk nobody can see stops drawing:
   *   · `host`      — the page says it is covered (a modal or device panel on top)
   *   · `offscreen` — scrolled out of view
   *   · `hidden`    — the window or tab is hidden
   */
  private hold = { host: false, offscreen: false, hidden: false };
  private running = false;
  private loadTimer = 0;
  private loaded = false;
  private disposed = false;
  /** Distance multiplier the current camera view was framed with (see fitScale). */
  private framedScale = 1;

  private devices: Partial<Record<DeviceId, DeviceObj>> = {};
  private deviceState: Record<DeviceId, DeviceState>;
  private selected = new Set<DeviceId>();
  private sync = false;
  private cameraView: CameraView = DEFAULT_CAMERA_VIEW;
  private hovered: DeviceId | null = null;

  constructor(
    viewport: HTMLElement,
    onChange: (s: UIState) => void,
    /** Starting lighting — passed in by a host that owns lighting state. */
    initialStates?: Partial<DeviceStates>,
    /** Told when the browser takes this desk's GL context away, so the host can
     *  build a new scene (and with it a new canvas) instead of going blank. */
    private onContextLost?: () => void,
  ) {
    // Its own canvas, not one React keeps: a canvas whose context was lost can
    // never hand out another, so every scene starts on a fresh one.
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ls-canvas';
    viewport.prepend(this.canvas);
    viewport.classList.remove('ls-loaded');
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    this.viewport = viewport;
    this.onChange = onChange;
    this.deviceState = Object.fromEntries(
      DEVICE_IDS.map((id) => [id, { ...DEFAULT_STATE(), ...initialStates?.[id] }]),
    ) as DeviceStates;
    this.init();
  }

  // ── Setup ────────────────────────────────────────────────────────────────
  private init() {
    const w = this.viewport.clientWidth || 800;
    const h = this.viewport.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.backdrop = this.makeBackdrop();
    this.roomFog = new THREE.Fog(0x11141c, 18, 38);
    this.scene.background = this.backdrop;
    this.scene.fog = this.roomFog;

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);

    // `alpha`: a device shown alone (focusDevice) stands on the page itself,
    // with no room and no backdrop behind it (JY, 2026-10-21).
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // The room reads as a lit desk at night, not an unlit void. Everything
    // below is a base the RGB sits ON TOP of — bright enough to see chassis
    // shapes and the desk surface, dim enough that emissive still carries.
    this.scene.add(new THREE.AmbientLight(0xb0b5c5, 0.75));
    this.scene.add(new THREE.HemisphereLight(0xc8d0e0, 0x191d28, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x99aacc, 0.75);
    fill.position.set(-5, 3, -2);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xddccff, 0.55);
    rim.position.set(0, 4, -6);
    this.scene.add(rim);
    // Soft overhead pool so the desk surface itself is legible from above —
    // the 3/4 and Top views spend most of their pixels on it.
    const overhead = new THREE.PointLight(0xdfe6f5, 24, 12, 2);
    overhead.position.set(0, 4.2, 0.6);
    this.scene.add(overhead);

    this.buildRoom();

    this.deskPlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshBasicMaterial({ visible: false }));
    this.deskPlane.rotation.x = -Math.PI / 2;
    this.deskPlane.position.y = 0.02;
    this.scene.add(this.deskPlane);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.6, 0);
    this.controls.minDistance = DESK_MIN_DISTANCE;
    // Room for fitScale to back narrow viewports away from the desk.
    this.controls.maxDistance = 24;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;

    this.setCameraView(DEFAULT_CAMERA_VIEW, false);

    // Bloom makes the RGB emissive pop.
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.5, 0.9);
      // The pass copies the frame to the screen with an opaque material, which
      // writes alpha 1 and paints the clear canvas black behind a device shown
      // alone (focusDevice). Let the copy keep the frame's alpha instead.
      // `_basic` is the pass's own copy material (three r185).
      const basic = (bloom as unknown as { _basic?: THREE.MeshBasicMaterial })._basic;
      if (basic) basic.transparent = true;
      this.composer.addPass(bloom);
    } catch {
      this.composer = undefined;
    }

    this.loadDevices();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.viewport);
    this.io = new IntersectionObserver(([e]) => this.setHold('offscreen', !e.isIntersecting));
    this.io.observe(this.viewport);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.bindPointer();
    this.running = true;
    this.animate();
  }

  /** Draw the desk and clear the loading state — once, however the models went. */
  private finishLoad() {
    if (this.disposed || this.loaded) return;
    this.loaded = true;
    this.placeDevice('keyboard', this.buildKeyboard(), { pos: [0, 0, 0.75] });
    this.placeDevice('mic', this.buildMic(), { pos: [-3.2, 0, 0.5] });
    DEVICE_IDS.forEach((id) => this.applyDeviceState(id));
    this.emit();
    this.viewport.classList.add('ls-loaded');
  }

  private loadDevices() {
    // Per-model: one model failing must not hold back the others.
    const settle = <T>(p: Promise<T>, what: string) =>
      p.catch((e) => {
        console.warn('[lightstudio] could not load', what, e);
      });
    // …and a model that neither loads nor errors (a lost context aborts the
    // Draco decoder mid-flight) must not hold back the desk.
    this.loadTimer = window.setTimeout(() => this.finishLoad(), LOAD_TIMEOUT_MS);
    Promise.all([
      settle(
        this.loadGLB(towerUrl).then((g) => {
          const rig = this.rigTower(g);
          this.addCaseRGB(g);
          // The cooler cap's screen, when a host asked for one before the model came.
          this.towerModel = g;
          this.syncCapScreen();
          this.placeDevice('tower', g, { targetWidth: 0.75, pos: [2.7, 0, -0.6], lightPos: [0, 0.7, 0.35] });
          // A scene closed while the model loaded places nothing.
          if (!this.devices.tower) return;
          this.devices.tower.rig = rig;
          // A focus asked for before the tower arrived lands now.
          if (this.focused === 'tower') this.focusDevice('tower', false);
        }),
        'tower',
      ),
      settle(
        this.loadGLB(headsetUrl).then((g) => this.placeDevice('headset', g, { targetWidth: 1.0, pos: [-2.3, 0, -0.5] })),
        'headset',
      ),
      settle(
        this.loadOBJDevice(mouseUrl, {
          targetWidth: 0.3,
          rotation: [-Math.PI / 2, Math.PI / 2, 0],
          glowOffsetY: 0.002,
        }).then((g) => this.placeDevice('mouse', g, { pos: [1.5, 0, 0.85] })),
        'mouse',
      ),
      settle(
        this.loadOBJDevice(monitorUrl, { targetWidth: 2.6, noUnderglow: true, backGlow: true }).then((g) =>
          this.placeDevice('monitor', g, { pos: [0, 0, -1.05], lightPos: [0, 1.0, -0.5] }),
        ),
        'monitor',
      ),
    ]).then(() => this.finishLoad());
  }

  private makeBackdrop(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(512, 380, 0, 512, 512, 720);
    grad.addColorStop(0, '#16182a');
    grad.addColorStop(0.5, '#0a0c11');
    grad.addColorStop(1, '#02030a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** The room: floor, wall, desk, mat and legs. Hidden while one device is shown alone. */
  private room = new THREE.Group();
  private backdrop!: THREE.Texture;
  private roomFog!: THREE.Fog;

  private buildRoom() {
    this.scene.add(this.room);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.9, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    floor.receiveShadow = true;
    this.room.add(floor);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 14),
      new THREE.MeshStandardMaterial({ color: 0x252b3a, roughness: 0.95, metalness: 0 }),
    );
    wall.position.set(0, 6, -7);
    this.room.add(wall);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.18, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x2d3341, roughness: 0.55, metalness: 0.35 }),
    );
    desk.position.set(0, -0.09, 0);
    desk.receiveShadow = true;
    this.room.add(desk);

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(8.02, 0.02, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x303544, roughness: 0.4, metalness: 0.7 }),
    );
    edge.position.set(0, 0.005, 1.8);
    this.room.add(edge);

    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.012, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x161a24, roughness: 0.95, metalness: 0 }),
    );
    mat.position.set(0.2, 0.01, 0.85);
    mat.receiveShadow = true;
    this.room.add(mat);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.6, metalness: 0.4 });
    (
      [
        [3.7, -0.6, -1.4],
        [-3.7, -0.6, -1.4],
        [3.7, -0.6, 1.4],
        [-3.7, -0.6, 1.4],
      ] as const
    ).forEach((p) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), legMat);
      leg.position.set(p[0], p[1], p[2]);
      leg.castShadow = true;
      this.room.add(leg);
    });
  }

  // ── Loaders ────────────────────────────────────────────────────────────────
  /**
   * The device GLBs are Draco-compressed, so GLTFLoader needs a decoder or it
   * rejects with "No DRACOLoader instance provided" — which is a SILENT
   * failure here: the promise is caught, the scene renders, and the device
   * just never appears. Decoder is vendored in public/draco (see its README).
   */
  private gltfLoader(): GLTFLoader {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(sharedDraco());
    return loader;
  }

  private loadGLB(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }

  private loadOBJDevice(
    url: string,
    opts: {
      targetWidth?: number;
      rotation?: [number, number, number];
      glowOffsetY?: number;
      /** Skip the desk-level underglow plane (wrong for anything standing up). */
      noUnderglow?: boolean;
      /** Bias-lighting panel on the rear of the chassis, washing the wall. */
      backGlow?: boolean;
    } = {},
  ): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      new OBJLoader().load(
        url,
        (obj) => {
          obj.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh)
              m.material = new THREE.MeshStandardMaterial({ color: 0x323847, roughness: 0.55, metalness: 0.4 });
          });
          if (opts.rotation) {
            const r = opts.rotation;
            if (r[0]) obj.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), r[0]);
            if (r[1]) obj.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), r[1]);
            if (r[2]) obj.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), r[2]);
          }
          const bbox = new THREE.Box3().setFromObject(obj);
          const size = bbox.getSize(new THREE.Vector3());
          if (opts.targetWidth && size.x > 0) obj.scale.setScalar(opts.targetWidth / size.x);

          const group = new THREE.Group();
          group.add(obj);
          const finalBbox = new THREE.Box3().setFromObject(obj);
          const finalSize = finalBbox.getSize(new THREE.Vector3());
          const center = finalBbox.getCenter(new THREE.Vector3());

          if (!opts.noUnderglow) {
            const glow = new THREE.Mesh(
              new THREE.PlaneGeometry(finalSize.x * 0.9, finalSize.z * 0.85),
              this.matRGB(),
            );
            glow.userData.rgb = true;
            glow.rotation.x = -Math.PI / 2;
            glow.position.y = finalBbox.min.y + (opts.glowOffsetY ?? 0.005);
            group.add(glow);
          }

          if (opts.backGlow) {
            // Bias lighting: a panel on the rear of the screen, set in from the
            // edges so it reads as light escaping from behind rather than as a
            // second screen. Faces the wall; the point light does the wash.
            const panel = new THREE.Mesh(
              new THREE.PlaneGeometry(finalSize.x * 0.8, finalSize.y * 0.55),
              this.matRGB(),
            );
            panel.userData.rgb = true;
            panel.position.set(center.x, finalBbox.max.y - finalSize.y * 0.42, finalBbox.min.z - 0.012);
            panel.rotation.y = Math.PI;
            group.add(panel);

            const wash = new THREE.PointLight(0xa855f7, 0, 5, 2);
            wash.position.set(center.x, finalBbox.max.y - finalSize.y * 0.42, finalBbox.min.z - 0.35);
            wash.userData.rgbLight = true;
            group.add(wash);
          }
          resolve(group);
        },
        undefined,
        reject,
      );
    });
  }

  private matChassis(color = 0x353b48, rough = 0.45, metal = 0.55) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }
  private matRGB() {
    return new THREE.MeshStandardMaterial({
      color: 0x111419,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0xa855f7,
      emissiveIntensity: 1.2,
    });
  }

  /**
   * Generic 65% keyboard, built rather than loaded. The RGB is a solid
   * emissive plate with the keycaps floating just above it, so the light
   * reads the way a real board does — bleeding up through the gaps between
   * caps and spilling out around the edge — instead of a flat glowing slab.
   */
  /**
   * The tower's lit parts, LED by LED. Each fan's `ls-emissive` mesh is cut
   * into its fans (the front and top meshes hold two each) and each vertex is
   * given the LED of its angle round the fan's centre; the memory's LEDs run
   * along the module; the graphics card gets a light bar, which the model
   * lacks, on the edge that faces the glass. The chassis strip is not lit on
   * this machine (2026-10-19). The meshes are tagged so `placeDevice` leaves
   * them out of the tower-wide RGB (the floor pool and corner bars stay).
   */
  private rigTower(group: THREE.Group): LedPart[] {
    const parts: LedPart[] = [];
    group.updateMatrixWorld(true);
    const norm = (n: string) => n.replace(/[\s_]/g, '').toLowerCase();
    const byName = new Map<string, THREE.Object3D>();
    group.traverse((o) => {
      if (o.name && !byName.has(norm(o.name))) byName.set(norm(o.name), o);
    });
    const litMeshes = (root: THREE.Object3D | undefined) => {
      const out: THREE.Mesh[] = [];
      root?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !Array.isArray(m.material) && m.material?.name === 'ls-emissive') out.push(m);
      });
      return out;
    };
    /** A mesh's vertices in the tower's own space. */
    const points = (m: THREE.Mesh) => {
      const pos = m.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      const out = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        out[i * 3] = v.x;
        out[i * 3 + 1] = v.y;
        out[i * 3 + 2] = v.z;
      }
      return out;
    };
    const extent = (p: Float32Array, idx: number[] | null) => {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      const n = idx ? idx.length : p.length / 3;
      for (let k = 0; k < n; k++) {
        const i = idx ? idx[k] : k;
        if (!Number.isFinite(p[i * 3]) || !Number.isFinite(p[i * 3 + 1]) || !Number.isFinite(p[i * 3 + 2])) continue;
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], p[i * 3 + a]);
          max[a] = Math.max(max[a], p[i * 3 + a]);
        }
      }
      return { min, max, size: [0, 1, 2].map((a) => max[a] - min[a]), mid: [0, 1, 2].map((a) => (min[a] + max[a]) / 2) };
    };
    /** Light a mesh as LEDs: `slotOf` is each vertex's LED slot. */
    const light = (m: THREE.Mesh, zone: ChassisZoneId, leds: number, slotOf: Float32Array, fanIds?: string[]) => {
      m.geometry.setAttribute('aLed', new THREE.BufferAttribute(slotOf, 1));
      const slots = Array.from({ length: MAX_SLOTS }, () => new THREE.Vector3());
      m.material = ledGlow(m.material as THREE.Material, slots);
      m.userData.towerZone = zone;
      parts.push({ zone, fanIds, leds, slots, mesh: m });
    };

    // The fans. Where one mesh holds two, the first is the upper one at the
    // front and the one nearer the front on top (CHASSIS_FANS' order).
    const frontMid = (() => {
      const m = litMeshes(byName.get(norm(TOWER_NODES.front)))[0];
      return m ? extent(points(m), null).mid : [0, 0, 0];
    })();
    (['front', 'top', 'rear', 'cpu'] as const).forEach((node) => {
      const fans = CHASSIS_FANS.filter((f) => f.node === node);
      litMeshes(byName.get(norm(TOWER_NODES[node]))).forEach((m) => {
        if (m.geometry.getAttribute('aLed')) return; // a mesh shared with a node already done
        const p = points(m);
        const n = p.length / 3;
        const all = extent(p, null);
        const long = all.size.indexOf(Math.max(...all.size));
        // Which fan each vertex is on: split along the mesh's long side.
        const part = new Uint8Array(n);
        if (fans.length > 1) {
          const ends = [all.min[long], all.max[long]];
          // The first fan is the end nearer the front fans (top) or higher (front).
          const firstAtMax = node === 'front' ? true : Math.abs(ends[1] - frontMid[long]) < Math.abs(ends[0] - frontMid[long]);
          for (let i = 0; i < n; i++) {
            const k = Math.min(fans.length - 1, Math.floor(((p[i * 3 + long] - all.min[long]) / (all.size[long] || 1)) * fans.length));
            part[i] = firstAtMax ? fans.length - 1 - k : k;
          }
        }
        // Each vertex's LED: its angle round its fan's centre, in the fan's plane.
        const slotOf = new Float32Array(n);
        fans.forEach((_, fi) => {
          const idx: number[] = [];
          for (let i = 0; i < n; i++) if (part[i] === fi) idx.push(i);
          if (!idx.length) return;
          const e = extent(p, idx);
          const thin = e.size.indexOf(Math.min(...e.size));
          const [a, b] = [0, 1, 2].filter((x) => x !== thin);
          idx.forEach((i) => {
            const ang = Math.atan2(p[i * 3 + b] - e.mid[b], p[i * 3 + a] - e.mid[a]);
            const led = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * FAN_LEDS) % FAN_LEDS;
            slotOf[i] = fi * FAN_LEDS + (Number.isFinite(led) ? led : 0);
          });
        });
        light(m, 'fans', FAN_LEDS, slotOf, fans.map((f) => f.id));
      });
    });

    // The memory: five LEDs along each module, every module in step (lighting.10).
    litMeshes(byName.get(norm(TOWER_NODES.memory))).forEach((m) => {
      const p = points(m);
      const e = extent(p, null);
      const long = e.size.indexOf(Math.max(...e.size));
      const slotOf = new Float32Array(p.length / 3);
      for (let i = 0; i < slotOf.length; i++) {
        slotOf[i] = Math.max(0, Math.min(MEMORY_LEDS - 1, Math.floor(((p[i * 3 + long] - e.min[long]) / (e.size[long] || 1)) * MEMORY_LEDS))) || 0;
      }
      light(m, 'memory', MEMORY_LEDS, slotOf);
    });

    // The chassis strip: dark on this machine.
    litMeshes(byName.get(norm(TOWER_NODES.chassis))).forEach((m) => {
      const dark = (m.material as THREE.MeshStandardMaterial).clone();
      dark.emissive = new THREE.Color(0, 0, 0);
      dark.emissiveIntensity = 0;
      dark.color = new THREE.Color(0.04, 0.04, 0.05);
      m.material = dark;
      m.userData.towerZone = 'chassis';
    });

    // The graphics card's light bar. The model's RTX5070 node is empty (the
    // card is part of the motherboard's one mesh), so the bar is placed by eye
    // on the card's edge that faces the glass (the model's −x), along the
    // card. Tower space: x across (glass at −0.72), y up, z front (+) to back.
    {
      const BAR = { x: -0.4, y: -0.22, z0: -0.85, z1: 0.45, h: 0.045 };
      const len = BAR.z1 - BAR.z0;
      const geo = new THREE.BoxGeometry(0.006, BAR.h, len, 1, 1, GPU_LEDS * 2);
      const bar = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'ls-emissive' }));
      bar.name = 'gpu-light-bar';
      bar.position.set(BAR.x, BAR.y, (BAR.z0 + BAR.z1) / 2);
      group.add(bar);
      const pos = geo.getAttribute('position');
      const slotOf = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        // Front to back, so a wave reads the way the fans' does.
        const t = (len / 2 - pos.getZ(i)) / len;
        slotOf[i] = Math.max(0, Math.min(GPU_LEDS - 1, Math.floor(t * GPU_LEDS)));
      }
      light(bar, 'gpu', GPU_LEDS, slotOf);
    }

    // The side glass, nearly clear: the zones are inside it, and a tinted
    // panel hid every fan from every angle.
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const next = list.map((mat) => {
        if (mat?.name !== 'ls-glass') return mat;
        const glass = (mat as THREE.MeshPhysicalMaterial).clone();
        glass.transparent = true;
        glass.opacity = 0.12;
        glass.transmission = 0;
        glass.depthWrite = false;
        return glass;
      });
      m.material = Array.isArray(m.material) ? next : next[0];
    });
    return parts;
  }

  /**
   * Give a loaded model RGB the controls can actually drive. The GLB chassis
   * have their own baked emissive (the tower's fans), but nothing tagged
   * `userData.rgb`, so without this a device renders fine and then ignores
   * every color/effect change — lit, but not controllable.
   */
  private addCaseRGB(group: THREE.Group) {
    const bbox = new THREE.Box3().setFromObject(group);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    // Underglow pool — visible from every camera preset, so the device always
    // reads as responding even when its strip faces away.
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.15, size.z * 1.15), this.matRGB());
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(center.x, bbox.min.y + 0.004, center.z);
    pool.userData.rgb = true;
    // The pool lies on the desk; with the device shown alone there is no desk.
    pool.userData.deskPool = true;
    group.add(pool);

    // Vertical light bar down the front corner, both faces so it reads from
    // either side without having to know the model's facing.
    [bbox.max.z + 0.008, bbox.min.z - 0.008].forEach((z) => {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.07, size.y * 0.66), this.matRGB());
      bar.position.set(bbox.min.x + size.x * 0.12, center.y, z);
      bar.userData.rgb = true;
      group.add(bar);
    });
  }

  private buildKeyboard(): THREE.Group {
    const g = new THREE.Group();
    const W = 2.0;
    const D = 0.78;
    const caseH = 0.075;

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, caseH, D), this.matChassis(0x2b313d, 0.5, 0.5));
    body.position.y = caseH / 2;
    g.add(body);

    // The light layer: a plate inset into the case, just below the caps.
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.05, 0.012, D - 0.05),
      this.matRGB(),
    );
    plate.position.y = caseH + 0.006;
    plate.userData.rgb = true;
    g.add(plate);

    // Keycaps. A 65% has a 15-column main block plus a nav column; rows step
    // in width the way a real layout does (tab/caps/shift offsets).
    const capMat = this.matChassis(0x3c4353, 0.75, 0.15);
    const U = 0.118;         // one key unit
    const GAP = 0.017;       // the gap the plate light comes up through
    const capH = 0.05;
    const rows: { widths: number[] }[] = [
      { widths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6, 1] },
      { widths: [1.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.2, 1] },
      { widths: [1.7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9, 1] },
      { widths: [2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1, 1] },
      { widths: [1.3, 1.3, 1.3, 6.2, 1.2, 1.2, 1, 1, 1] },
    ];
    const capY = caseH + 0.012 + capH / 2;
    rows.forEach((row, r) => {
      const total = row.widths.reduce((a, w) => a + w * U + GAP, -GAP);
      let x = -total / 2;
      const z = -D / 2 + 0.085 + r * (U + GAP);
      row.widths.forEach((w) => {
        const cw = w * U;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(cw, capH, U), capMat);
        cap.position.set(x + cw / 2, capY, z);
        g.add(cap);
        x += cw + GAP;
      });
    });

    // Underglow — the strip that washes the desk under the front lip.
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.94, D * 0.9), this.matRGB());
    under.rotation.x = -Math.PI / 2;
    under.position.y = 0.004;
    under.userData.rgb = true;
    g.add(under);

    return g;
  }

  private buildMic(): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 32), this.matChassis(0x1a1d28));
    base.position.y = 0.06;
    g.add(base);
    const postMat = this.matChassis(0x22262e, 0.35, 0.7);
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), postMat);
    lp.position.set(-0.28, 0.4, 0);
    const rp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), postMat);
    rp.position.set(0.28, 0.4, 0);
    g.add(lp, rp);
    const bodyMat = this.matChassis(0x1c1f27, 0.4, 0.65);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 8, 24), bodyMat);
    body.position.set(0, 0.62, 0);
    g.add(body);
    // RGB ring around the mic body
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.03, 12, 40), this.matRGB());
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.5, 0);
    ring.userData.rgb = true;
    g.add(ring);
    return g;
  }

  private placeDevice(
    id: DeviceId,
    group: THREE.Group,
    opts: {
      scale?: number;
      targetWidth?: number;
      pos?: [number, number, number];
      /** Where the device's RGB point light sits, in wrap space. Defaults to
       *  just in front, which is right for anything lying on the desk but
       *  wrong for a screen — that wants its light behind, washing the wall. */
      lightPos?: [number, number, number];
    } = {},
  ) {
    if (this.disposed) return;
    if (opts.targetWidth) {
      const pre = new THREE.Box3().setFromObject(group);
      const preSize = pre.getSize(new THREE.Vector3());
      if (preSize.x > 0) group.scale.setScalar(opts.targetWidth / preSize.x);
    } else if (opts.scale) {
      group.scale.setScalar(opts.scale);
    }

    const bbox = new THREE.Box3().setFromObject(group);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    group.position.x -= center.x;
    group.position.z -= center.z;
    group.position.y -= bbox.min.y;

    const wrap = new THREE.Group();
    wrap.add(group);
    wrap.name = 'ls-device-' + id;
    wrap.userData = { deviceId: id };
    if (opts.pos) wrap.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    this.scene.add(wrap);

    const rgbMeshes: THREE.Mesh[] = [];
    const extraLights: THREE.PointLight[] = [];
    wrap.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight && o.userData.rgbLight) {
        extraLights.push(o as THREE.PointLight);
      }
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.towerZone && (m.userData.rgb || (m.name && m.name.toLowerCase().startsWith('zone-')))) {
        m.material = (m.material as THREE.Material).clone();
        rgbMeshes.push(m);
      }
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    const pointLight = new THREE.PointLight(0xa855f7, 0, 4, 2);
    const lp = opts.lightPos ?? [0, 0.5, 0.4];
    pointLight.position.set(lp[0], lp[1], lp[2]);
    wrap.add(pointLight);

    // The selection halo traces the device's footprint, just outside it. It was
    // a circle sized to 0.455 × the longest side, i.e. inside the footprint, so
    // a round or square device (the mic's base, the tower) sat on top of its own
    // halo and a selected one looked unselected (2026-10-06).
    const hw = size.x / 2 + HALO_GAP;
    const hd = size.z / 2 + HALO_GAP;
    const halo = new THREE.Mesh(
      haloGeometry(hw, hd),
      new THREE.MeshBasicMaterial({ color: 0x00c8d7, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    wrap.add(halo);

    this.devices[id] = { group: wrap, rgbMeshes, pointLight, extraLights, halo, defaultPos: wrap.position.clone() };
  }

  // ── State → meshes ──────────────────────────────────────────────────────────
  private applyDeviceState(id: DeviceId) {
    const dev = this.devices[id];
    const s = this.deviceState[id];
    if (!dev || !s) return;
    const [r, g, b] = s.color.split(',').map(Number);
    const col = new THREE.Color(r / 255, g / 255, b / 255);
    const intensity = isLit(id) ? (s.brightness / 100) * (s.effect === 'off' ? 0 : 1) : 0;
    dev.rgbMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat) return;
      mat.emissive = col;
      mat.emissiveIntensity = intensity * 1.0;
      mat.needsUpdate = true;
    });
    dev.pointLight.color = col;
    dev.pointLight.intensity = intensity * 1.9;
    dev.extraLights.forEach((l) => {
      l.color = col;
      l.intensity = intensity * 3.2;
    });
  }

  /** The host covers or uncovers the desk (see `hold`). */
  setCovered(covered: boolean) {
    this.setHold('host', covered);
  }

  private onVisibility = () => this.setHold('hidden', document.hidden);

  private setHold(why: keyof typeof this.hold, on: boolean) {
    if (this.hold[why] === on) return;
    this.hold[why] = on;
    const stop = this.hold.host || this.hold.offscreen || this.hold.hidden;
    if (stop && this.running) {
      cancelAnimationFrame(this.raf);
      this.running = false;
      // Effects run on the clock; stopping it (which keeps its elapsed time)
      // means the desk resumes where it paused instead of jumping ahead.
      this.clock.stop();
    } else if (!stop && !this.running && !this.disposed) {
      this.running = true;
      const at = this.clock.elapsedTime;
      this.clock.start();
      this.clock.elapsedTime = at;
      this.raf = requestAnimationFrame(this.animate);
    }
  }

  private animate = () => {
    if (this.disposed || !this.running) return;
    this.raf = requestAnimationFrame(this.animate);
    const t = this.clock.getElapsedTime();
    // A slow frame (a machine drawing the desk in software) still moves by the time that passed.
    const dt = Math.min(0.25, Math.max(0, t - this.frameAt));
    this.frameAt = t;
    this.easeInsets(dt);
    this.fadeDim(dt);
    this.controls.update();

    DEVICE_IDS.forEach((id, idx) => {
      const dev = this.devices[id];
      const s = this.deviceState[id];
      if (!dev || !s) return;
      const { col, intensity } = this.lookAt(s, isLit(id), idx, t);
      // The tower's pool, bars and point light glow in the fans' colour, so they dim with the fans.
      const dim = id === 'tower' ? this.dimNow.fans : 1;
      dev.rgbMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!mat) return;
        mat.emissive = col;
        mat.emissiveIntensity = intensity * 1.0 * dim;
      });
      dev.pointLight.color = col;
      dev.pointLight.intensity = intensity * 1.9 * dim;
      dev.extraLights.forEach((l) => {
        l.color = col;
        l.intensity = intensity * 3.2;
      });
      // The tower's zones, each in its own look (or the tower's). Each zone
      // steps a little along the desk so a wave rolls across the fans too.
      if (dev.rig) {
        this.lightRig(dev.rig, s, idx, t);
        // While the panel drives the lights, the floor pool and the corner
        // bars glow with the fans rather than the old desk look.
        if (panelDrives(s)) {
          const fans = dev.rig.filter((p) => p.zone === 'fans');
          const sum = new THREE.Vector3();
          let n = 0;
          fans.forEach((p) => p.slots.slice(0, (p.fanIds?.length ?? 1) * p.leds).forEach((v) => (sum.add(v), n++)));
          if (n) sum.divideScalar(n);
          const k = Math.max(sum.x, sum.y, sum.z);
          const glow = k > 0 ? new THREE.Color(sum.x / k, sum.y / k, sum.z / k) : new THREE.Color(0, 0, 0);
          dev.rgbMeshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            if (!mat) return;
            mat.emissive = glow;
            mat.emissiveIntensity = k;
          });
          dev.pointLight.color = glow;
          dev.pointLight.intensity = k * 1.9;
        }
      }
    });

    this.selected.forEach((id) => {
      const halo = this.devices[id]?.halo;
      if (halo) (halo.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(t * 2);
    });

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.reportAnchors();
  };

  // ── Anchors ──────────────────────────────────────────────────────────────────
  private anchorIds: AnchorId[] = [];
  private anchorSink: ((list: AnchorPos[]) => void) | null = null;
  /** Each anchor's point in its object's own space, found once: a device's
   *  top centre, a tower part's centre. Objects move (a drag, a focus), so the
   *  point is carried to the screen through the object every frame. */
  private anchorLocal = new Map<AnchorId, { obj: THREE.Object3D; local: THREE.Vector3 }>();

  /** Report where these anchors are, every drawn frame, to `sink`. The host
   *  moves its labels with it rather than re-rendering, so a label costs a
   *  transform per frame. Null stops it. */
  setAnchors(ids: AnchorId[], sink: ((list: AnchorPos[]) => void) | null) {
    this.anchorIds = ids;
    this.anchorSink = sink;
    if (sink && !this.running) this.reportAnchors();
  }

  private anchorPoint(id: AnchorId) {
    const known = this.anchorLocal.get(id);
    if (known) return known;
    let obj: THREE.Object3D | undefined;
    let world: THREE.Vector3 | undefined;
    if (id.startsWith('tower:')) {
      // The first mesh of the part: the front fans for Fans (rigTower's order).
      const part = this.devices.tower?.rig?.find((p) => `tower:${p.zone}` === id);
      if (!part) return null;
      obj = part.mesh;
      obj.updateWorldMatrix(true, false);
      world = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    } else {
      const dev = this.devices[id as DeviceId];
      if (!dev) return null;
      obj = dev.group;
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      world = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    }
    const found = { obj, local: obj.worldToLocal(world.clone()) };
    this.anchorLocal.set(id, found);
    return found;
  }

  private reportAnchors() {
    if (!this.anchorSink || !this.camera) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    const list = this.anchorIds.map((id): AnchorPos => {
      const at = this.anchorPoint(id);
      if (!at) return { id, x: 0, y: 0, shown: false };
      let seen = true;
      for (let o: THREE.Object3D | null = at.obj; o; o = o.parent) if (!o.visible) seen = false;
      v.copy(at.local);
      at.obj.localToWorld(v);
      v.project(this.camera);
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      const inFrame = v.z < 1 && x >= 0 && x <= w && y >= 0 && y <= h;
      return { id, x, y, shown: seen && inFrame };
    });
    this.anchorSink(list);
  }

  /** The machine as the lab set it up (towerZones.ts `readMachine`). */
  private machine = readMachine();
  private offMachine = onMachine(() => (this.machine = readMachine()));

  /**
   * The tower's LEDs at time `t`. While the Lights panel drives them, each
   * zone runs its own look; otherwise (a desk-wide preset put them back) they
   * wear the tower's desk look. A part the machine lacks stays dark and
   * hidden (lighting-family.6), and the panel's switch puts everything out.
   */
  private lightRig(rig: LedPart[], s: DeviceState, idx: number, t: number) {
    const drives = panelDrives(s);
    const c = drives ? chassisOf(s) : null;
    const desk = drives ? null : this.lookAt(s, true, idx, t);
    rig.forEach((part) => {
      const present = part.zone === 'memory' ? this.machine.modules > 0 : part.zone === 'gpu' ? this.machine.hpGpu : true;
      part.mesh.visible = part.zone === 'gpu' ? present : true;
      (part.fanIds ?? [undefined]).forEach((fanId, k) => {
        const fanThere = !fanId || this.machine.fans.includes(fanId);
        for (let i = 0; i < part.leds; i++) {
          const slot = part.slots[k * part.leds + i];
          if (!present || !fanThere) slot.set(0, 0, 0);
          else if (!c) slot.set(desk!.col.r * desk!.intensity, desk!.col.g * desk!.intensity, desk!.col.b * desk!.intensity);
          else {
            const { rgb, a } = ledAt(c, part.zone, i, part.leds, t, fanId);
            slot.set((rgb[0] / 255) * a, (rgb[1] / 255) * a, (rgb[2] / 255) * a);
          }
        }
      });
    });
    // A dimmed zone (setDimExcept): the LEDs shine at a share of what they are
    // set to. Before the tower's glow is read off the fans below, so it follows.
    rig.forEach((part) => {
      const k = this.dimNow[part.zone];
      if (k !== 1) part.slots.forEach((v) => v.multiplyScalar(k));
    });
  }

  /** One look at time `t`: the colour and the strength it lights at. `idx`
   *  is the position along the desk, which the moving effects step by. */
  private lookAt(s: { color: string; effect: Effect; brightness: number; speed: number }, lit: boolean, idx: number, t: number) {
    const baseIntensity = lit ? (s.brightness / 100) * (s.effect === 'off' ? 0 : 1) : 0;
    const speedFactor = 0.4 + (s.speed / 10) * 1.6;
    let mod = 1;
    let hue: number | null = null;
    let override: THREE.Color | null = null;
    const n = DEVICE_IDS.length;
    const ts = t * speedFactor;
    switch (s.effect) {
      case 'breathe':
        mod = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(ts * 2));
        break;
      case 'wave':
        // A rainbow rolling across the desk.
        hue = ts * 0.15 - idx * 0.12;
        break;
      case 'rainbow':
        // Every device cycles through the colors together.
        hue = ts * 0.12;
        break;
      case 'starlight':
        // Each device twinkles on its own beat.
        mod = 0.15 + 0.85 * Math.pow(Math.max(0, Math.sin(ts * (1.5 + hash01(idx)) + idx * 2.4)), 6);
        break;
      case 'raindrop': {
        // A colored drop lands, then fades; each drop picks a new color.
        const drop = ts * 0.5 + hash01(idx + 7);
        hue = hash01(Math.floor(drop) + idx * 5.3);
        mod = 0.15 + 0.85 * Math.exp(-(drop % 1) * 6);
        break;
      }
      case 'audio-eq': {
        // A level meter: quiet reads green, loud reads red.
        const level = Math.abs(Math.sin(ts * 3.1 + idx) * Math.sin(ts * 1.7 + idx * 0.5));
        hue = 0.33 * (1 - level);
        mod = 0.3 + 0.7 * level;
        break;
      }
      case 'rave':
        // Hard color jumps and a strobe on the beat.
        hue = hash01(Math.floor(ts * 2) + idx * 1.7);
        mod = (Math.floor(ts * 4) + idx) % 2 ? 1 : 0.35;
        break;
      case 'ripple': {
        // Color rings out from the middle of the desk.
        const dist = Math.abs(idx - (n - 1) / 2);
        hue = ts * 0.2 - dist * 0.15;
        mod = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ts * 3 - dist * 1.4));
        break;
      }
      case 'ghosting': {
        // One lit device with a fading trail behind it.
        const d = (((ts * 0.8) % n) - idx + n) % n;
        mod = 0.1 + 0.9 * Math.exp(-d * 1.3);
        break;
      }
      case 'confetti':
        hue = hash01(Math.floor(ts * 1.5) + idx * 3.1);
        break;
      case 'sun': {
        // Warm light swelling between amber and gold.
        const warm = 0.5 + 0.5 * Math.sin(ts * 0.8 + idx * 0.4);
        hue = 0.06 + 0.07 * warm;
        mod = 0.55 + 0.45 * warm;
        break;
      }
      case 'hyperx':
        // Brand red and white chase each other across the desk.
        override = (Math.floor(ts * 1.2) + idx) % 2 ? WHITE : HYPERX_RED;
        break;
      case 'swipe': {
        // A sweep of a new color across the desk, then dark, on repeat.
        const pass = (ts * 0.5) / 1.4;
        const edge = ((ts * 0.5) % 1.4) * n;
        hue = hash01(Math.floor(pass) + 11);
        mod = idx < edge ? 1 : 0.1;
        break;
      }
    }

    const [r, g, b] = s.color.split(',').map(Number);
    const col = override ? override.clone() : new THREE.Color(r / 255, g / 255, b / 255);
    if (hue !== null) col.setHSL(((hue % 1) + 1) % 1, 1, 0.55);
    return { col, intensity: baseIntensity * mod };
  }

  resize() {
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    if (!w || !h) return;
    this.applyView();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    // A narrower viewport pulls the camera back so the whole desk stays in frame.
    if (this.focused) this.focusDevice(this.focused, false);
    else if (Math.abs(this.fitScale() - this.framedScale) > 0.02) this.setCameraView(this.cameraView, false);
  }

  // ── Dimming: one part in light, the rest down ────────────────────────────────
  /** The tower's zones that stay at full strength while its other lights dim;
   *  `[]` dims them all, null dims nothing (every desk but the PC page's). */
  private dimKeep: ChassisZoneId[] | null = null;
  /** Each zone's display multiplier now: it fades toward 1 (kept) or DIM_LEVEL. */
  private dimNow: Record<ChassisZoneId, number> = { fans: 1, memory: 1, gpu: 1 };

  /**
   * Dim the focused tower's lights to a fifth, all but these zones' (fans,
   * memory, graphics card): the part a tab is about stays lit and the rest of
   * the glow stops competing with it (This PC's full-screen layout, JW's
   * review 2026-10-22). Null puts every light back. The fade takes about 300 ms.
   *
   * A display multiplier only: it scales the LEDs' colours and the lights that
   * glow with them each frame, and no lighting state or preset is touched. The
   * fans' multiplier is also the one the tower's floor pool, corner bars and
   * point light wear, since they glow in the fans' colour. The cap's screen
   * (capScreen.ts) is a light of its own and is not dimmed.
   */
  setDimExcept(keep: ChassisZoneId[] | null) {
    this.dimKeep = keep;
  }

  /** The multipliers as last written to the viewport for a check to read. */
  private dimShown = '';

  private fadeDim(dt: number) {
    // Nothing dims and nothing is dimmed: every desk but the PC page's, every frame.
    if (!this.dimKeep && !this.dimShown) return;
    const step = ((1 - DIM_LEVEL) * dt) / DIM_FADE_S;
    const reduce = reducedMotion();
    ZONES.forEach((z) => {
      const to = this.dimKeep && !this.dimKeep.includes(z) ? DIM_LEVEL : 1;
      const now = this.dimNow[z];
      this.dimNow[z] = reduce || Math.abs(to - now) <= step ? to : now + Math.sign(to - now) * step;
    });
    // The multipliers while any light is down, nothing once all are back.
    const shown = ZONES.every((z) => this.dimNow[z] === 1) ? '' : ZONES.map((z) => `${z}:${this.dimNow[z].toFixed(2)}`).join(',');
    if (shown === this.dimShown) return;
    this.dimShown = shown;
    if (shown) this.viewport.dataset.dimLevels = shown;
    else delete this.viewport.dataset.dimLevels;
  }

  // ── Insets: a view the host covers part of ───────────────────────────────────
  /** Where the host's cards end, which the shot is framed inside (`setInsets`). */
  private insets: ViewInsets = NO_INSETS;
  /** What the projection is using this frame: it eases toward `insets`, so a
   *  card appearing slides the picture rather than jumping it. */
  private insetsNow: ViewInsets = NO_INSETS;
  /** The clock's time at the last drawn frame, for the eases. */
  private frameAt = 0;

  /**
   * Tell the scene how much of its view a host covers (null: none, as every
   * desk but the PC page's). The projection's centre moves to the middle of
   * what is left (`setViewOffset`, which the pointer's ray and the anchors'
   * projection both follow), and a focused device is framed to fit it. The
   * first insets, and ones set before the models arrive, take hold at once;
   * a change after that eases, and the focused device's camera reframes with
   * it. Only a focused device is framed to them — the whole desk is not.
   */
  setInsets(next: ViewInsets | null) {
    const to = next ?? NO_INSETS;
    if (sameInsets(to, this.insets)) return;
    const snap = !this.loaded || noInsets(this.insets) || noInsets(to);
    this.insets = to;
    if (snap) this.insetsNow = to;
    this.applyView();
    if (!this.focused) return;
    // A flight on its way works its end out again every frame, so it takes the
    // new insets by itself; otherwise the camera reframes (flying, unless it snapped).
    if (snap || !this.focusFlying) this.focusDevice(this.focused, !snap);
  }

  /** Ease the view's centre toward the insets, a step of the frame's time. */
  private easeInsets(dt: number) {
    if (sameInsets(this.insetsNow, this.insets)) return;
    const k = reducedMotion() ? 1 : 1 - Math.exp(-dt / 0.18);
    const step = (a: number, b: number) => (Math.abs(b - a) < 0.5 ? b : a + (b - a) * k);
    const a = this.insetsNow;
    const b = this.insets;
    this.insetsNow = { top: step(a.top, b.top), right: step(a.right, b.right), bottom: step(a.bottom, b.bottom), left: step(a.left, b.left) };
    this.applyView();
  }

  /** The camera's aspect and, with insets, its view offset: the projection's
   *  centre on the middle of the uncovered part, the picture's scale as ever. */
  private applyView() {
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    const { top, right, bottom, left } = this.insetsNow;
    if (noInsets(this.insetsNow)) {
      this.camera.clearViewOffset();
      delete this.viewport.dataset.viewCenter;
    } else {
      const cx = (left + (w - right)) / 2;
      const cy = (top + (h - bottom)) / 2;
      this.camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
      // Where the projection's centre is, in px from the view's top-left, for a check to read.
      this.viewport.dataset.viewCenter = `${cx.toFixed(1)},${cy.toFixed(1)}`;
    }
    this.camera.updateProjectionMatrix();
  }

  /** The uncovered part's size as shares of the view, for fitting a shot to it;
   *  undefined with nothing covered, so a framing is then exactly what it was. */
  private uncoveredShare(): { w: number; h: number } | undefined {
    const i = this.insets;
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    if (noInsets(i) || !w || !h) return undefined;
    return { w: Math.max(0.2, (w - i.left - i.right) / w), h: Math.max(0.2, (h - i.top - i.bottom) / h) };
  }

  /** The camera views are framed for a wide viewport; narrower ones back the
   *  camera away from the desk by the aspect shortfall so no device is cut off. */
  private fitScale() {
    const FRAMED_ASPECT = 1.9;
    return Math.max(1, FRAMED_ASPECT / (this.camera?.aspect || FRAMED_ASPECT));
  }

  // ── Pointer: pick + drag + select ────────────────────────────────────────────
  private bindPointer() {
    // `offsetXZ` is null when the click ray missed the desk plane (the top of
    // the monitor, the tower): that device can still be picked, it just cannot
    // be dragged from there — a click up there used to do nothing at all.
    let drag: { id: DeviceId; startX: number; startY: number; offsetXZ: THREE.Vector3 | null; moved: boolean; shift: boolean } | null =
      null;

    const pickDevice = (ev: PointerEvent): DeviceId | null => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      // A device hidden by a focus cannot be picked through.
      const targets = Object.values(this.devices).map((d) => d!.group).filter((g) => g.visible);
      const hits = this.raycaster.intersectObjects(targets, true);
      for (const hit of hits) {
        let n: THREE.Object3D | null = hit.object;
        while (n && !(n.userData && n.userData.deviceId)) n = n.parent;
        if (n) return n.userData.deviceId as DeviceId;
      }
      return null;
    };
    const deskHit = (ev: PointerEvent): THREE.Vector3 | null => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObject(this.deskPlane);
      return hits.length ? hits[0].point : null;
    };

    this.canvas.addEventListener('pointermove', (ev) => {
      if (drag) {
        if (!drag.offsetXZ) return;
        const p = deskHit(ev);
        if (!p) return;
        if (!this.movable) {
          if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 4) drag.moved = true;
          return;
        }
        const dev = this.devices[drag.id]!;
        dev.group.position.x = Math.max(-3.7, Math.min(3.7, p.x - drag.offsetXZ.x));
        dev.group.position.z = Math.max(-1.6, Math.min(1.6, p.z - drag.offsetXZ.z));
        if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 4) drag.moved = true;
        return;
      }
      const hovered = pickDevice(ev);
      if (hovered !== this.hovered) {
        this.hovered = hovered;
        this.canvas.classList.toggle('over-device', !!hovered);
      }
    });
    this.canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      // Focused on one device: its zones are picked in the host's list, and the
      // device stays where it is, so the canvas only orbits.
      if (this.focused) return;
      const id = pickDevice(ev);
      if (!id) return;
      const p = deskHit(ev);
      const dev = this.devices[id]!;
      drag = {
        id,
        startX: ev.clientX,
        startY: ev.clientY,
        offsetXZ: p ? new THREE.Vector3(p.x - dev.group.position.x, 0, p.z - dev.group.position.z) : null,
        moved: false,
        shift: ev.shiftKey,
      };
      this.controls.enabled = false;
      this.canvas.classList.add('dragging-device');
      this.canvas.setPointerCapture(ev.pointerId);
    });
    const endDrag = (ev: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved) this.select(drag.id, drag.shift);
      this.controls.enabled = true;
      this.canvas.classList.remove('dragging-device');
      try {
        this.canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* not captured */
      }
      drag = null;
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  // ── Public API (React drives these) ──────────────────────────────────────────
  private getTargets(): DeviceId[] {
    if (this.sync) return [...LIT_DEVICE_IDS];
    if (this.selected.size) return [...this.selected].filter(isLit);
    return [];
  }
  private targetState(): DeviceState | null {
    const t = this.getTargets();
    return t.length ? this.deviceState[t[0]] : null;
  }
  private emit() {
    this.onChange({
      selected: [...this.selected],
      sync: this.sync,
      target: this.targetState(),
      cameraView: this.cameraView,
      states: Object.fromEntries(DEVICE_IDS.map((id) => [id, { ...this.deviceState[id] }])) as DeviceStates,
    });
  }
  private refreshHalos() {
    DEVICE_IDS.forEach((id) => {
      const dev = this.devices[id];
      if (dev) (dev.halo.material as THREE.MeshBasicMaterial).opacity = this.selected.has(id) ? 0.5 : 0;
    });
  }

  /** Whether a device can be dragged to a new place on the desk. A desk that
   *  only shows the lights (the Lighting overview) keeps every device put. */
  movable = true;

  /** Whether an unlit device can be picked: yes where a pick opens the device
   *  (the Personalize tile), no in Light Studio, where a pick is for lighting. */
  pickUnlit = false;

  select(id: DeviceId, shift = false) {
    // Synced: the desk moves as one, so there is nothing to pick.
    if (this.sync) return;
    if (!isLit(id) && !this.pickUnlit) return;
    if (!shift) this.selected.clear();
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.refreshHalos();
    this.emit();
  }
  selectAll() {
    this.selected = new Set(LIT_DEVICE_IDS);
    this.refreshHalos();
    this.emit();
  }
  clearSelection() {
    this.selected.clear();
    this.refreshHalos();
    this.emit();
  }
  setSync(on: boolean) {
    this.sync = on;
    // Sync IS "everything selected": show it on the desk rather than leaving a
    // stale one-device selection that no longer means anything.
    if (on) this.selected = new Set(LIT_DEVICE_IDS);
    else this.selected.clear();
    this.refreshHalos();
    this.emit();
  }
  applyToTargets(patch: Partial<DeviceState>) {
    this.applyTo(this.getTargets(), patch);
  }
  /** Apply to specific devices, whatever is selected. */
  applyTo(ids: DeviceId[], patch: Partial<DeviceState>) {
    ids = ids.filter(isLit);
    if (!ids.length) return;
    ids.forEach((id) => {
      Object.assign(this.deviceState[id], patch);
      // A look for the whole tower puts its zones back on it (towerZones.ts).
      if (clearsZones(patch)) delete this.deviceState[id].chassis;
      this.applyDeviceState(id);
    });
    this.emit();
  }
  /** Replace lighting from outside (a host's shared state). It emits so the
   *  panel re-reads the target; the host compares before echoing it back. */
  setStates(states: Partial<DeviceStates>) {
    DEVICE_IDS.forEach((id) => {
      const next = states[id];
      if (!next) return;
      this.deviceState[id] = { ...next };
      this.applyDeviceState(id);
    });
    this.emit();
  }
  resetLayout() {
    DEVICE_IDS.forEach((id) => {
      const dev = this.devices[id];
      if (dev) dev.group.position.copy(dev.defaultPos);
    });
  }
  setCameraView(view: CameraView, doAnimate = true) {
    this.cameraView = view;
    const targets: Record<CameraView, [number, number, number]> = {
      front: [0, 1.6, 6.2],
      'three-quarter': [4.6, 3.4, 5.4],
      top: [0, 8.5, 0.01],
      side: [7.5, 2.0, 0.01],
    };
    const scale = this.fitScale();
    this.framedScale = scale;
    // Scale the offset from the look-at point, not the raw position.
    const LOOK_Y = 0.6;
    const base = targets[view];
    const tgt: [number, number, number] = [base[0] * scale, LOOK_Y + (base[1] - LOOK_Y) * scale, base[2] * scale];
    if (!doAnimate || !this.camera) {
      this.camera?.position.set(tgt[0], tgt[1], tgt[2]);
      this.controls?.target.set(0, 0.6, 0);
      this.emit();
      return;
    }
    const start = this.camera.position.clone();
    const end = new THREE.Vector3(...tgt);
    const t0 = performance.now();
    const DUR = 600;
    const step = () => {
      if (this.disposed) return;
      const k = Math.min(1, (performance.now() - t0) / DUR);
      const ease = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(start, end, ease);
      this.controls.target.lerp(new THREE.Vector3(0, 0.6, 0), ease);
      if (k < 1) requestAnimationFrame(step);
    };
    step();
    this.emit();
  }

  /** The one device the desk is showing, or null for the whole desk. */
  private focused: DeviceId | null = null;
  /** The shot the focused device is framed with; null is the glass side. */
  private focusShot: FocusShot | null = null;
  /** The loaded tower, in its own space, and the cap's screen on it (capScreen.ts). */
  private towerModel: THREE.Group | null = null;
  private capScreen: CapScreen | null = null;
  private capLook: CapScreenLook | null = null;

  /**
   * Show the cooler cap's screen on the tower, drawing `look`, or take it off
   * with null. For illustration: the model has no cap, so the screen is built
   * on the CPU cooler's face toward the glass (JY, 2026-10-22). A look asked
   * for before the tower loads lands with it.
   */
  setCapScreen(look: CapScreenLook | null) {
    this.capLook = look;
    this.syncCapScreen();
  }

  private syncCapScreen() {
    const tower = this.towerModel;
    if (!tower || this.disposed) return;
    if (!this.capLook) {
      this.capScreen?.dispose();
      this.capScreen = null;
      return;
    }
    if (!this.capScreen) {
      this.capScreen = new CapScreen();
      this.capScreen.attachTo(tower, TOWER_NODES.cpu);
      // A shot that frames the screen, taken before it was there, frames it now.
      if (this.focused === 'tower' && this.focusShot?.node === CAP_SCREEN_NODE) this.focusDevice('tower', false);
    }
    this.capScreen.set(this.capLook);
  }
  private cancelFocusFlight: () => void = () => {};
  private focusFlying = false;

  /**
   * Show one device alone and frame it — the PC's zones, edited from Light
   * Studio (option A) or from the PC's own page (option B). The other devices
   * hide and the canvas only orbits. Null puts the desk back. A `shot` moves
   * the camera to it and is kept for later reframes (a resize, the model
   * landing); without one the last shot holds.
   */
  focusDevice(id: DeviceId | null, doAnimate = true, shot?: FocusShot | null) {
    this.focused = id;
    if (shot !== undefined) this.focusShot = shot;
    if (!id) this.focusShot = null;
    DEVICE_IDS.forEach((d) => {
      const dev = this.devices[d];
      if (dev) {
        dev.group.visible = !id || d === id;
        dev.group.traverse((o) => {
          if (o.userData.deskPool) o.visible = !id;
        });
      }
    });
    // Alone, the device stands on the page: no room, no backdrop, no fog, a
    // clear canvas — as the notebook's stage draws it (laptopScene.ts).
    this.room.visible = !id;
    this.scene.background = id ? null : this.backdrop;
    this.scene.fog = id ? null : this.roomFog;
    this.renderer?.setClearColor(0x000000, id ? 0 : 1);
    // The desk keeps the camera back from it; one device may be looked at close
    // (a part's shot frames the memory or the cooler alone).
    if (this.controls) this.controls.minDistance = id ? 0.4 : DESK_MIN_DISTANCE;
    if (!id) {
      this.cancelFocusFlight();
      this.focusFlying = false;
      this.setCameraView(this.cameraView, doAnimate);
      return;
    }
    const dev = this.devices[id];
    if (!dev || !this.camera) return; // not loaded yet: the load lands it
    // A resize mid-flight leaves the flight be: the flight works its shot out
    // again every frame, so it lands framed for the hero as it is by then.
    if (!doAnimate && this.focusFlying && shot === undefined) return;
    const group = dev.group;
    this.cancelFocusFlight();
    this.focusFlying = doAnimate;
    this.cancelFocusFlight = fly({ camera: this.camera, controls: this.controls }, doAnimate ? () => this.focusFrame(id, group) : this.focusFrame(id, group), {
      ms: doAnimate ? undefined : 0,
      alive: () => !this.disposed,
      onDone: () => {
        this.focusFlying = false;
      },
    });
  }

  /** Where the camera goes for the focused device under the current shot. */
  private focusFrame(id: DeviceId, group: THREE.Group): { position: THREE.Vector3; target: THREE.Vector3 } {
    const box = new THREE.Box3().setFromObject(group);
    const shot = this.focusShot;
    if (!shot) {
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // Far enough that the device fills the frame with a margin, whatever the
      // viewport's shape (the desk-wide fitScale is for a whole desk).
      const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const across = Math.max(size.x, size.z);
      const share = this.uncoveredShare();
      const dist = Math.max(size.y / (2 * half * (share?.h ?? 1)), across / (2 * half * this.camera.aspect * (share?.w ?? 1))) * 1.45;
      // The tower from the glass side (the model's −x) and a little in front,
      // where the fans, the cooler and the memory show through. The others from
      // the front and above, the way they face the player (JY, 2026-10-21: the
      // Lighting overview flies to a mic or a keyboard).
      const position =
        id === 'tower'
          ? new THREE.Vector3(c.x - dist * 0.9, c.y + dist * 0.12, c.z + dist * 0.45)
          : new THREE.Vector3(c.x, c.y + dist * 0.55, c.z + dist * 0.85);
      return { position, target: c };
    }
    let region = box.clone();
    if (shot.node) {
      const norm = (n: string) => n.replace(/[\s_]/g, '').toLowerCase();
      const want = norm(shot.node);
      let node: THREE.Object3D | undefined;
      group.traverse((o) => {
        if (!node && o.name && norm(o.name) === want) node = o;
      });
      if (node) region = new THREE.Box3().setFromObject(node);
    } else if (shot.box) {
      const size = box.getSize(new THREE.Vector3());
      const [a, b] = shot.box;
      region = new THREE.Box3(
        new THREE.Vector3(box.min.x + size.x * a[0], box.min.y + size.y * a[1], box.min.z + size.z * a[2]),
        new THREE.Vector3(box.min.x + size.x * b[0], box.min.y + size.y * b[1], box.min.z + size.z * b[2]),
      );
    }
    return frameBox(region, new THREE.Vector3(...shot.dir), this.camera, shot.margin ?? 1.2, 0, this.uncoveredShare());
  }

  private contextLost = (e: Event) => {
    e.preventDefault();
    if (!this.disposed) this.onContextLost?.();
  };

  dispose() {
    this.disposed = true;
    this.capScreen?.dispose();
    this.cancelFocusFlight();
    this.offMachine();
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.canvas.remove();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.loadTimer);
    this.ro?.disconnect();
    this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.controls?.dispose();
    this.composer?.dispose?.();
    this.renderer?.dispose();
    // Hand the GL context back now rather than whenever the canvas is collected:
    // opening the studio a dozen times otherwise hits the browser's context
    // limit and it starts killing live ones. Safe because this canvas is the
    // scene's own and has just been removed — nothing will draw on it again.
    this.renderer?.forceContextLoss();
    this.scene?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
