// ══════════════════════════════════════════════════════════════════════════
// The cooler cap's screen on the 3D tower — for illustration (JY, 2026-10-22).
//
// The tower model is the real 35L with an air cooler, and has no cap; the
// registry's cap is a round LCD on a liquid cooler's pump. So the screen is
// built here, not modelled: a round screen in a dark bezel on the cooler's
// face toward the glass, centred on it, where a pump's cap would show through
// the glass. It draws what it is given — a plain description of the face
// (CapScreenLook), made by the cap's own code — and reads no app state.
//
// It stays separable from the model: the scene adds it only when a host
// passes a look, and finds the cooler by name, falling back to the middle of
// the tower. A model that brings a cap of its own simply gets no look.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

/** One reading on the cap, in the cap's own words (System Vitals' numbers). */
export interface CapReading {
  label: string;
  big: string;
  small: string;
  /** 0–100, for an arc or ticks. */
  pct: number;
}

/** What the screen shows, already decided by the cap's code. */
export type CapFace =
  | { kind: 'dark' }
  | { kind: 'readings'; theme: 'ring' | 'list' | 'classic'; a: string; b: string; rows: CapReading[] }
  | { kind: 'clock'; style: 'digital' | 'analog'; a: string }
  /** A picture, a slideshow (several), a GIF or a video (its file, with a play mark). */
  | { kind: 'image'; srcs: string[]; crop?: { x: number; y: number; zoom: number }; play?: boolean }
  /** The cap's default art at power-on, drawn as the brand's name. */
  | { kind: 'logo'; text: string };

export interface CapScreenLook {
  face: CapFace;
  /** 10–100, as the cap's slider. */
  brightness: number;
  /** A quarter turn at a time (lcd-diy.26). */
  rotation: number;
  /** An app event over the content (lcd-diy.6). */
  event?: string | null;
}

/** The screen's name in the scene, for a camera shot to frame it. */
export const CAP_SCREEN_NODE = 'cooler-cap-screen';

const PX = 512;
const C = PX / 2;
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** Diameter in tower units (the 35L is 1.44 wide, about 21 cm): about 5.5 cm. */
const DIAMETER = 0.38;
const BEZEL = 0.022;
const DEPTH = 0.035;

export class CapScreen {
  readonly group = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly glass: THREE.MeshBasicMaterial;
  private look: CapScreenLook | null = null;
  private readonly images = new Map<string, HTMLImageElement>();
  private timer = 0;
  private slide = 0;

  constructor() {
    this.canvas.width = this.canvas.height = PX;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.group.name = CAP_SCREEN_NODE;

    // Built facing −x, the tower's glass side; the texture's right is +z,
    // which is the screen's right seen through the glass.
    const r = DIAMETER / 2;
    const bezelGeo = new THREE.CylinderGeometry(r + BEZEL, r + BEZEL, DEPTH, 64);
    bezelGeo.rotateZ(Math.PI / 2);
    const bezel = new THREE.Mesh(bezelGeo, new THREE.MeshStandardMaterial({ color: 0x1b1c20, metalness: 0.7, roughness: 0.35 }));
    bezel.name = 'cooler-cap-bezel';
    const screenGeo = new THREE.CircleGeometry(r, 64);
    screenGeo.rotateY(-Math.PI / 2);
    // Not tone mapped: the screen is a light of its own, its colours the cap's.
    this.glass = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    const screen = new THREE.Mesh(screenGeo, this.glass);
    screen.name = 'cooler-cap-glass';
    screen.position.x = -DEPTH / 2 - 0.0015;
    this.group.add(bezel, screen);
  }

  /** Put the screen on the tower: on the face of the node named `cooler`
   *  that looks at the glass (−x), centred on it. Coordinates are the
   *  tower's own, whether or not it has been placed on the desk yet. */
  attachTo(tower: THREE.Object3D, cooler: string) {
    const norm = (n: string) => n.replace(/[\s_]/g, '').toLowerCase();
    tower.updateMatrixWorld(true);
    const toTower = tower.matrixWorld.clone().invert();
    let node: THREE.Object3D | undefined;
    tower.traverse((o) => {
      if (!node && o.name && norm(o.name) === norm(cooler)) node = o;
    });
    const box = new THREE.Box3().setFromObject(node ?? tower).applyMatrix4(toTower);
    const mid = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // On the cooler: a little behind its middle, over the fins rather than the
    // fan at its front. Without it, the tower's glass side at the CPU's height.
    const x = node ? box.min.x - DEPTH / 2 - 0.004 : box.min.x + size.x * 0.2;
    this.group.position.set(x, node ? mid.y : box.min.y + size.y * 0.62, mid.z - size.z * (node ? 0.15 : 0.2));
    tower.add(this.group);
  }

  set(look: CapScreenLook) {
    this.look = look;
    window.clearInterval(this.timer);
    const f = look.face;
    // A clock moves on its own, a slideshow turns its pictures.
    // Every few seconds, so it turns the minute with the preview beside it.
    if (f.kind === 'clock') this.timer = window.setInterval(() => this.draw(), 3000);
    else if (f.kind === 'image' && f.srcs.length > 1)
      this.timer = window.setInterval(() => {
        this.slide += 1;
        this.draw();
      }, 3000);
    // The cap dims as the cap does: the 2D preview's 25–100%.
    const level = 0.22 + (look.brightness / 100) * 0.68;
    this.glass.color.setScalar(f.kind === 'dark' ? 1 : level);
    this.draw();
  }

  dispose() {
    window.clearInterval(this.timer);
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.texture.dispose();
  }

  private image(src: string): HTMLImageElement | null {
    let img = this.images.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => this.draw();
      img.src = src;
      this.images.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  private draw() {
    const look = this.look;
    if (!look) return;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050507';
    g.fillRect(0, 0, PX, PX);
    const f = look.face;
    if (f.kind !== 'dark') {
      g.save();
      g.translate(C, C);
      g.rotate((look.rotation * Math.PI) / 180);
      g.translate(-C, -C);
      this.face(f);
      if (look.event) this.event(look.event);
      g.restore();
    }
    this.texture.needsUpdate = true;
  }

  private face(f: Exclude<CapFace, { kind: 'dark' }>) {
    const g = this.ctx;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    switch (f.kind) {
      case 'readings': {
        const [first, second] = f.rows;
        if (f.theme === 'list') {
          const rows = f.rows.slice(0, 4);
          const top = C - ((rows.length - 1) * 74) / 2;
          rows.forEach((row, i) => {
            const y = top + i * 74;
            g.textAlign = 'left';
            g.fillStyle = 'rgba(233,238,243,0.6)';
            g.font = `500 28px ${SANS}`;
            g.fillText(row.label, 112, y);
            g.textAlign = 'right';
            g.fillStyle = i === 0 ? f.a : '#e9eef3';
            g.font = `600 ${i === 0 ? 48 : 38}px ${MONO}`;
            g.fillText(row.big, PX - 112, y);
          });
          return;
        }
        if (f.theme === 'ring' && first) {
          ring(g, 200, 26, 'rgba(255,255,255,0.12)', 1);
          ring(g, 200, 26, f.a, first.pct / 100);
          text(g, first.small, C, C - 62, `500 30px ${SANS}`, 'rgba(233,238,243,0.7)');
          text(g, first.big, C, C + 22, `600 104px ${MONO}`, '#ffffff', 320);
          return;
        }
        // Classic: a ticked ring, two readings stacked.
        for (let i = 0; i < 48; i++) {
          g.save();
          g.translate(C, C);
          g.rotate((i / 48) * Math.PI * 2);
          g.globalAlpha = first && i / 48 < first.pct / 100 ? 1 : 0.3;
          g.strokeStyle = i < 24 ? f.a : f.b;
          g.lineWidth = 8;
          g.beginPath();
          g.moveTo(0, -226);
          g.lineTo(0, i % 4 === 0 ? -192 : -202);
          g.stroke();
          g.restore();
        }
        if (first) {
          text(g, first.small, C, C - 92, `500 28px ${SANS}`, f.a);
          text(g, first.big, C, C - 44, `600 64px ${MONO}`, '#ffffff', 300);
        }
        if (second) {
          text(g, second.small, C, C + 40, `500 28px ${SANS}`, f.b);
          text(g, second.big, C, C + 88, `600 64px ${MONO}`, '#ffffff', 300);
        }
        return;
      }
      case 'clock': {
        const now = new Date();
        if (f.style === 'digital') {
          text(g, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), C, C - 10, `600 112px ${MONO}`, '#ffffff', 360);
          text(g, now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), C, C + 74, `500 32px ${SANS}`, 'rgba(233,238,243,0.7)');
          return;
        }
        ring(g, 214, 6, 'rgba(255,255,255,0.25)', 1);
        const hand = (deg: number, len: number, width: number, color: string) => {
          g.save();
          g.translate(C, C);
          g.rotate((deg * Math.PI) / 180);
          g.strokeStyle = color;
          g.lineWidth = width;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(0, -len);
          g.stroke();
          g.restore();
        };
        hand(((now.getHours() % 12) + now.getMinutes() / 60) * 30, 120, 16, '#e9eef3');
        hand(now.getMinutes() * 6, 180, 10, f.a);
        return;
      }
      case 'image': {
        const src = f.srcs[this.slide % f.srcs.length];
        const img = src ? this.image(src) : null;
        if (img) {
          // Cover the screen, then the crop: its point and its zoom (lcd-diy.28).
          const crop = f.crop ?? { x: 50, y: 50, zoom: 100 };
          const s = Math.max(PX / img.naturalWidth, PX / img.naturalHeight) * (crop.zoom / 100);
          const w = img.naturalWidth * s;
          const h = img.naturalHeight * s;
          g.drawImage(img, (PX - w) * (crop.x / 100), (PX - h) * (crop.y / 100), w, h);
        }
        if (f.play) {
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.beginPath();
          g.moveTo(C - 34, C - 48);
          g.lineTo(C - 34, C + 48);
          g.lineTo(C + 50, C);
          g.closePath();
          g.fill();
        }
        return;
      }
      case 'logo':
        text(g, f.text.toUpperCase(), C, C, `800 84px ${SANS}`, '#ffffff', 360);
        return;
    }
  }

  /** An app event, a pill over the content. */
  private event(label: string) {
    const g = this.ctx;
    g.font = `600 30px ${SANS}`;
    const w = Math.min(PX - 120, g.measureText(label).width + 56);
    const y = PX - 150;
    g.fillStyle = 'rgba(10,12,16,0.82)';
    g.beginPath();
    g.roundRect(C - w / 2, y - 30, w, 60, 30);
    g.fill();
    text(g, label, C, y, `600 30px ${SANS}`, '#ffffff');
  }
}

function ring(g: CanvasRenderingContext2D, r: number, width: number, color: string, share: number) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(C, C, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, share)));
  g.stroke();
}

/** Centred text; with `fit`, made smaller until it is no wider than that,
 *  so a long reading or a 12-hour time stays inside the round screen. */
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, fit?: number) {
  g.font = font;
  if (fit) {
    const w = g.measureText(s).width;
    if (w > fit) g.font = font.replace(/(\d+)px/, (_, n) => `${Math.floor((Number(n) * fit) / w)}px`);
  }
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}
