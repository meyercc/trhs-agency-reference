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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Device assets, imported by name rather than globbed. An eager glob over the
// asset folder emits EVERY file in it — including the spare headset variants
// and the retired keyboard OBJ — which put ~38MB of models nobody references
// into each build. Add an import here when a device starts using a model.
import towerUrl from '../../../Assets/3d-devices/coldsnap-35l.glb?url';
import headsetUrl from '../../../Assets/3d-devices/koala-velvet.glb?url';
import mouseUrl from '../../../Assets/3d-devices/generic-mouse.obj?url';
import monitorUrl from '../../../Assets/3d-devices/monitor.obj?url';

export const DEVICE_IDS = ['tower', 'monitor', 'keyboard', 'mouse', 'headset', 'mic'] as const;
export type DeviceId = (typeof DEVICE_IDS)[number];
export const LABELS: Record<DeviceId, string> = {
  tower: 'OMEN 35L',
  monitor: 'OMEN Monitor',
  keyboard: 'Origins 65',
  mouse: 'Pulsefire',
  headset: 'Cloud III',
  mic: 'QuadCast S',
};

export type Effect = 'solid' | 'breathe' | 'wave' | 'rainbow' | 'off';
export interface DeviceState {
  color: string; // "r,g,b"
  effect: Effect;
  brightness: number; // 0–100
  speed: number; // 1–10
}
export type CameraView = 'front' | 'three-quarter' | 'top' | 'side';
/** View the studio opens on. Exported so the React HUD can't drift from it. */
export const DEFAULT_CAMERA_VIEW: CameraView = 'front';

export interface UIState {
  selected: DeviceId[];
  sync: boolean;
  /** Effective target state (first selected / any device in sync) or null. */
  target: DeviceState | null;
  cameraView: CameraView;
}

interface DeviceObj {
  group: THREE.Group;
  rgbMeshes: THREE.Mesh[];
  pointLight: THREE.PointLight;
  /** Extra RGB-driven lights baked into a model (e.g. the monitor back wash). */
  extraLights: THREE.PointLight[];
  halo: THREE.Mesh;
  defaultPos: THREE.Vector3;
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
  private raf = 0;
  private disposed = false;

  private devices: Partial<Record<DeviceId, DeviceObj>> = {};
  private deviceState: Record<DeviceId, DeviceState>;
  private selected = new Set<DeviceId>();
  private sync = false;
  private cameraView: CameraView = DEFAULT_CAMERA_VIEW;
  private hovered: DeviceId | null = null;

  constructor(canvas: HTMLCanvasElement, viewport: HTMLElement, onChange: (s: UIState) => void) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.onChange = onChange;
    this.deviceState = Object.fromEntries(DEVICE_IDS.map((id) => [id, DEFAULT_STATE()])) as Record<
      DeviceId,
      DeviceState
    >;
    this.init();
  }

  // ── Setup ────────────────────────────────────────────────────────────────
  private init() {
    const w = this.viewport.clientWidth || 800;
    const h = this.viewport.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.scene.background = this.makeBackdrop();
    this.scene.fog = new THREE.Fog(0x11141c, 18, 38);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
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
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;

    this.setCameraView(DEFAULT_CAMERA_VIEW, false);

    // Bloom makes the RGB emissive pop.
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.5, 0.9));
    } catch {
      this.composer = undefined;
    }

    this.loadDevices();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.viewport);
    this.bindPointer();
    this.animate();
  }

  private loadDevices() {
    Promise.all([
      this.loadGLB(towerUrl).then((g) => {
        this.addCaseRGB(g);
        this.placeDevice('tower', g, { targetWidth: 0.75, pos: [2.7, 0, -0.6], lightPos: [0, 0.7, 0.35] });
      }),
      this.loadGLB(headsetUrl).then((g) =>
        this.placeDevice('headset', g, { targetWidth: 1.0, pos: [-2.3, 0, -0.5] }),
      ),
      this.loadOBJDevice(mouseUrl, {
        targetWidth: 0.3,
        rotation: [-Math.PI / 2, Math.PI / 2, 0],
        glowOffsetY: 0.002,
      }).then((g) => this.placeDevice('mouse', g, { pos: [1.5, 0, 0.85] })),
      this.loadOBJDevice(monitorUrl, { targetWidth: 2.6, noUnderglow: true, backGlow: true }).then((g) =>
        this.placeDevice('monitor', g, { pos: [0, 0, -1.05], lightPos: [0, 1.0, -0.5] }),
      ),
    ])
      .catch((e) => console.warn('[lightstudio] model load error', e))
      .then(() => {
        if (this.disposed) return;
        this.placeDevice('keyboard', this.buildKeyboard(), { pos: [0, 0, 0.75] });
        this.placeDevice('mic', this.buildMic(), { pos: [-3.2, 0, 0.5] });
        DEVICE_IDS.forEach((id) => this.applyDeviceState(id));
        this.emit();
        this.viewport.classList.add('ls-loaded');
      });
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

  private buildRoom() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.9, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 14),
      new THREE.MeshStandardMaterial({ color: 0x252b3a, roughness: 0.95, metalness: 0 }),
    );
    wall.position.set(0, 6, -7);
    this.scene.add(wall);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.18, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x2d3341, roughness: 0.55, metalness: 0.35 }),
    );
    desk.position.set(0, -0.09, 0);
    desk.receiveShadow = true;
    this.scene.add(desk);

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(8.02, 0.02, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x303544, roughness: 0.4, metalness: 0.7 }),
    );
    edge.position.set(0, 0.005, 1.8);
    this.scene.add(edge);

    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.012, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x161a24, roughness: 0.95, metalness: 0 }),
    );
    mat.position.set(0.2, 0.01, 0.85);
    mat.receiveShadow = true;
    this.scene.add(mat);

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
      this.scene.add(leg);
    });
  }

  // ── Loaders ────────────────────────────────────────────────────────────────
  /**
   * The device GLBs are Draco-compressed, so GLTFLoader needs a decoder or it
   * rejects with "No DRACOLoader instance provided" — which is a SILENT
   * failure here: the promise is caught, the scene renders, and the device
   * just never appears. Decoder is vendored in public/draco (see its README).
   */
  private dracoLoader?: DRACOLoader;
  private gltfLoader(): GLTFLoader {
    if (!this.dracoLoader) {
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    }
    const loader = new GLTFLoader();
    loader.setDRACOLoader(this.dracoLoader);
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
   * Give a loaded model RGB the controls can actually drive. The GLB chassis
   * have their own baked emissive (the tower's fans), but nothing tagged
   * `userData.rgb`, so without this a device renders fine and then ignores
   * every colour/effect change — lit, but not controllable.
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
      if (m.isMesh && (m.userData.rgb || (m.name && m.name.toLowerCase().startsWith('zone-')))) {
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

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.65, 48),
      new THREE.MeshBasicMaterial({ color: 0x00c8d7, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    const footprint = Math.max(size.x, size.z) * (opts.scale || 1) * 0.7;
    halo.scale.setScalar(Math.max(footprint, 0.4));
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
    const intensity = (s.brightness / 100) * (s.effect === 'off' ? 0 : 1);
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

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const t = this.clock.getElapsedTime();
    this.controls.update();

    DEVICE_IDS.forEach((id, idx) => {
      const dev = this.devices[id];
      const s = this.deviceState[id];
      if (!dev || !s) return;
      const baseIntensity = (s.brightness / 100) * (s.effect === 'off' ? 0 : 1);
      const speedFactor = 0.4 + (s.speed / 10) * 1.6;
      let mod = 1;
      let hueShift = 0;
      if (s.effect === 'breathe') mod = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * speedFactor * 2));
      else if (s.effect === 'wave') mod = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * speedFactor * 2 - idx * 0.7));
      else if (s.effect === 'rainbow') hueShift = (t * speedFactor * 0.15) % 1;

      const [r, g, b] = s.color.split(',').map(Number);
      const col = new THREE.Color(r / 255, g / 255, b / 255);
      if (hueShift) {
        const hsl = { h: 0, s: 0, l: 0 };
        col.getHSL(hsl);
        col.setHSL((hsl.h + hueShift) % 1, hsl.s, hsl.l);
      }
      const finalIntensity = baseIntensity * mod;
      dev.rgbMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!mat) return;
        mat.emissive = col;
        mat.emissiveIntensity = finalIntensity * 1.0;
      });
      dev.pointLight.color = col;
      dev.pointLight.intensity = finalIntensity * 1.9;
      dev.extraLights.forEach((l) => {
        l.color = col;
        l.intensity = finalIntensity * 3.2;
      });
    });

    this.selected.forEach((id) => {
      const halo = this.devices[id]?.halo;
      if (halo) (halo.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(t * 2);
    });

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  resize() {
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }

  // ── Pointer: pick + drag + select ────────────────────────────────────────────
  private bindPointer() {
    let drag: { id: DeviceId; startX: number; startY: number; offsetXZ: THREE.Vector3; moved: boolean; shift: boolean } | null =
      null;

    const pickDevice = (ev: PointerEvent): DeviceId | null => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const targets = Object.values(this.devices).map((d) => d!.group);
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
        const p = deskHit(ev);
        if (!p) return;
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
      const id = pickDevice(ev);
      if (!id) return;
      const p = deskHit(ev);
      if (!p) return;
      const dev = this.devices[id]!;
      drag = {
        id,
        startX: ev.clientX,
        startY: ev.clientY,
        offsetXZ: new THREE.Vector3(p.x - dev.group.position.x, 0, p.z - dev.group.position.z),
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
    if (this.sync) return [...DEVICE_IDS];
    if (this.selected.size) return [...this.selected];
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
    });
  }
  private refreshHalos() {
    DEVICE_IDS.forEach((id) => {
      const dev = this.devices[id];
      if (dev) (dev.halo.material as THREE.MeshBasicMaterial).opacity = this.selected.has(id) ? 0.5 : 0;
    });
  }

  select(id: DeviceId, shift = false) {
    if (!shift) this.selected.clear();
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.refreshHalos();
    this.emit();
  }
  selectAll() {
    this.selected = new Set(DEVICE_IDS);
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
    this.emit();
  }
  applyToTargets(patch: Partial<DeviceState>) {
    const targets = this.getTargets();
    if (!targets.length) return;
    targets.forEach((id) => {
      Object.assign(this.deviceState[id], patch);
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
    const tgt = targets[view];
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

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls?.dispose();
    this.dracoLoader?.dispose();
    this.composer?.dispose?.();
    this.renderer?.dispose();
    this.scene?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
