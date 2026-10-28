// An illustrative notebook, built rather than loaded: a base, a lid on a hinge,
// a keyboard, a light bar and a lid logo. It stands in for whichever notebook
// This PC is — the shape is generic, the lit parts are the SKU's (pcLighting
// `capsOf`). JY 2026-10-20: the models are for illustration, not exact.
//
// The keyboard is a notebook's board (keyboardGeometry.ts, laptopBoardGeometry:
// the main block, the arrows, a numpad where the machine has one, and the
// macro keys as a column on the left), one keycap mesh per key, named by the
// key's code — the same code lighting and key assignments use. The lights are
// painted on the caps themselves; a selection is drawn as a rim round its
// keys (the Lighting tab's zone, the Macro tab's four keys).
//
// Units are metres. The base sits on y = 0, its front faces +z, the hinge is
// at the back (−z).

import * as THREE from 'three';
import type { LightCaps } from '../pcLighting';
import { laptopBoardGeometry, macroKeyCodes, type LaptopBoardOptions } from './keyboardGeometry';

const BASE_W = 0.36;
const BASE_D = 0.255;
const BASE_H = 0.021;
const LID_H = 0.238;
const LID_T = 0.0065;
/** Open past upright, the way a notebook sits on a desk. */
const LID_TILT = -0.3;
const BOARD_W = 0.3;
/** The board's back edge, measured from the base's back edge. */
const BOARD_INSET_BACK = 0.022;

export interface LaptopRig {
  group: THREE.Group;
  /** The keyboard's outer rectangle (the drawn board's `.kbd` box) at the
   *  height of the cap tops, in the group's space. */
  board: { center: THREE.Vector3; width: number; depth: number };
  /** Boxes the camera frames, in the group's space. `keyboard` is the board
   *  at the cap tops; `macro` the macro keys' column (the board, without any). */
  boxes: { all: THREE.Box3; base: THREE.Box3; lid: THREE.Box3; front: THREE.Box3; keyboard: THREE.Box3; macro: THREE.Box3 };
  /** The lid on its hinge, for a shot of its outside (the logo). */
  lid: THREE.Object3D;
  /** What the lights show. Keys: code → css colour; bar and logo: one colour
   *  (or null for dark) per zone, in zone order. */
  paint(p: LaptopPaint): void;
  dispose(): void;
}

export interface LaptopPaint {
  keys: Map<string, string>;
  bar: (string | null)[];
  logo: (string | null)[];
  /** Keys to draw a rim round: the zone being edited, or the macro keys. */
  selected?: ReadonlySet<string>;
}

/** What the machine's keyboard has (the SKU's record), for the model. */
export type LaptopMachine = LaptopBoardOptions;

function canvasTexture(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas, ctx, tex };
}

/** A soft round glow, white, for additive halos tinted by their material. */
function glowTexture(): THREE.CanvasTexture {
  const { ctx, tex } = canvasTexture(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  tex.needsUpdate = true;
  return tex;
}

/** A rounded rectangle as a flat shape, centred on the origin. */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A slab with rounded corners in plan: width along x, depth along z, height up from y = 0. */
function slab(w: number, d: number, h: number, r: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h, bevelEnabled: true, bevelSize: 0.0012, bevelThickness: 0.0012, bevelSegments: 2, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); // shape's y → −z, extrusion → +y
  geo.translate(0, 0.0012, 0);
  return new THREE.Mesh(geo, mat);
}

const css = (c: string | null | undefined, fallback = '#000000'): THREE.Color => {
  const col = new THREE.Color();
  if (!c) return col.set(fallback);
  const m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return col.setRGB(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, THREE.SRGBColorSpace);
  return col.set(c);
};

export function buildLaptop(caps: LightCaps, machine: LaptopMachine = { numpad: true, macroKeys: 0 }): LaptopRig {
  const group = new THREE.Group();
  group.name = 'laptop';
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const shell = keep(new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.35, roughness: 0.46 }));
  const shellDark = keep(new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.4, roughness: 0.55 }));
  const capMat = keep(new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.15, roughness: 0.62 }));
  const wellMat = keep(new THREE.MeshStandardMaterial({ color: 0x101114, metalness: 0.2, roughness: 0.8 }));
  const pad = keep(new THREE.MeshStandardMaterial({ color: 0x30343d, metalness: 0.25, roughness: 0.36 }));

  // ── Base ──────────────────────────────────────────────────────────────────
  const base = slab(BASE_W, BASE_D, BASE_H - 0.0024, 0.012, shell);
  group.add(base);
  const deckY = BASE_H;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const geo = laptopBoardGeometry(machine);
  const macroCodes = new Set(macroKeyCodes(machine.macroKeys));
  const ku = BOARD_W / geo.width;
  const boardD = geo.height * ku;
  const boardZ = -BASE_D / 2 + BOARD_INSET_BACK + boardD / 2;
  const capTop = deckY + 0.0004;
  // Board-space (key units, from the top-left) → group space.
  const bx = (x: number) => -BOARD_W / 2 + x * ku;
  const bz = (y: number) => boardZ - boardD / 2 + y * ku;

  const well = new THREE.Mesh(keep(new THREE.PlaneGeometry(BOARD_W, boardD)), wellMat);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, deckY - 0.0026, boardZ);
  group.add(well);
  // The well's walls, so the recess reads from a low angle.
  const wallMat = shellDark;
  const wallH = 0.0028;
  [
    [BOARD_W, 0.0008, 0, boardZ - boardD / 2],
    [BOARD_W, 0.0008, 0, boardZ + boardD / 2],
    [0.0008, boardD, -BOARD_W / 2, boardZ],
    [0.0008, boardD, BOARD_W / 2, boardZ],
  ].forEach(([w, d, x, z]) => {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, wallH, d)), wallMat);
    m.position.set(x, deckY - wallH / 2 + 0.0002, z);
    group.add(m);
  });

  // Backlight: one plane under the caps, painted per key, bleeding between them.
  const PX = 80; // canvas pixels per key unit
  const back = canvasTexture(Math.round(geo.width * PX), Math.round(geo.height * PX));
  const backMat = keep(new THREE.MeshBasicMaterial({ map: back.tex, toneMapped: false }));
  const backPlane = new THREE.Mesh(keep(new THREE.PlaneGeometry(BOARD_W, boardD)), backMat);
  backPlane.rotation.x = -Math.PI / 2;
  backPlane.position.set(0, deckY - 0.0024, boardZ);
  group.add(backPlane);
  keep(back.tex);

  // Caps.
  const capGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const capH = 0.0024;
  const keysGroup = new THREE.Group();
  keysGroup.name = 'keyboard';
  geo.keys.forEach((k) => {
    const inset = 0.04 * ku;
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.name = `key:${k.code}`;
    cap.userData.code = k.code;
    cap.scale.set(k.w * ku - inset * 2, capH, k.h * ku - inset * 2);
    cap.position.set(bx(k.x + k.w / 2), capTop - capH / 2, bz(k.y + k.h / 2));
    keysGroup.add(cap);
  });
  group.add(keysGroup);

  // Legends: one plane at the cap tops, the letters lit in each key's colour.
  const legend = canvasTexture(back.canvas.width, back.canvas.height);
  const legendMat = keep(new THREE.MeshBasicMaterial({ map: legend.tex, transparent: true, toneMapped: false, depthWrite: false }));
  const legendPlane = new THREE.Mesh(keep(new THREE.PlaneGeometry(BOARD_W, boardD)), legendMat);
  legendPlane.rotation.x = -Math.PI / 2;
  legendPlane.position.set(0, capTop + 0.00012, boardZ);
  group.add(legendPlane);
  keep(legend.tex);

  // ── Touchpad, centred under the main block like a notebook's ──────────────
  const mainCx = bx((geo.keys.find((k) => k.code === 'space')?.x ?? 0) + (geo.keys.find((k) => k.code === 'space')?.w ?? 0) / 2);
  const tpGeo = keep(new THREE.ShapeGeometry(roundedRect(0.118, 0.072, 0.006), 6));
  const tp = new THREE.Mesh(tpGeo, pad);
  tp.rotation.x = -Math.PI / 2;
  tp.position.set(mainCx, deckY + 0.0001, boardZ + boardD / 2 + 0.012 + 0.036);
  group.add(tp);

  // ── Light bar ─────────────────────────────────────────────────────────────
  const glowTex = keep(glowTexture());
  const barMats: THREE.MeshBasicMaterial[] = [];
  const barHalos: THREE.MeshBasicMaterial[] = [];
  const halo = (w: number, d: number, x: number, z: number) => {
    const m = keep(new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), m);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, 0.0005, z);
    group.add(plane);
    return m;
  };
  if (caps.bar !== 'none') {
    const stripH = 0.0026;
    const stripY = 0.0075;
    const segs = caps.bar === 'four' ? 4 : 1;
    const span = BASE_W * 0.82;
    for (let i = 0; i < segs; i++) {
      const w = span / segs - 0.003;
      const x = -span / 2 + (i + 0.5) * (span / segs);
      const mat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
      const strip = new THREE.Mesh(keep(new THREE.BoxGeometry(w, stripH, 0.0012)), mat);
      strip.position.set(x, stripY, BASE_D / 2 + 0.0006);
      group.add(strip);
      barMats.push(mat);
      barHalos.push(halo(w * 1.35, 0.09, x, BASE_D / 2 + 0.03));
    }
    if (caps.bar === 'u') {
      // OMEN Max's U: the bar turns the front corners and runs along both sides.
      [-1, 1].forEach((side) => {
        const mat = barMats[0];
        const strip = new THREE.Mesh(keep(new THREE.BoxGeometry(0.0012, stripH, BASE_D * 0.55)), mat);
        strip.position.set(side * (BASE_W / 2 + 0.0006), stripY, BASE_D * 0.2);
        group.add(strip);
      });
    }
  }

  // ── Lid on its hinge ──────────────────────────────────────────────────────
  const hinge = new THREE.Group();
  hinge.position.set(0, deckY, -BASE_D / 2 + 0.006);
  hinge.rotation.x = LID_TILT;
  group.add(hinge);
  const lidGeo = keep(new THREE.ExtrudeGeometry(roundedRect(BASE_W, LID_H, 0.012), { depth: LID_T, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 2, curveSegments: 6 }));
  lidGeo.translate(0, LID_H / 2, -LID_T); // stands up from the hinge, screen face at z = 0
  const lid = new THREE.Mesh(lidGeo, shell);
  hinge.add(lid);
  const barrel = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0055, 0.0055, BASE_W * 0.74, 20)), shellDark);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.002, -0.004);
  hinge.add(barrel);

  // The screen: a dim picture, so the lid reads as a notebook from the front.
  const scr = canvasTexture(1024, 640);
  {
    const { ctx } = scr;
    const g = ctx.createLinearGradient(0, 0, 1024, 640);
    g.addColorStop(0, '#0d0f1c');
    g.addColorStop(0.55, '#1a1033');
    g.addColorStop(1, '#2a0d1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 640);
    const r = ctx.createRadialGradient(720, 250, 10, 720, 250, 420);
    r.addColorStop(0, 'rgba(255,60,90,0.35)');
    r.addColorStop(1, 'rgba(255,60,90,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, 1024, 640);
    scr.tex.needsUpdate = true;
  }
  keep(scr.tex);
  const bezel = 0.008;
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(BASE_W - bezel * 2, LID_H - bezel * 2 - 0.012)), keep(new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })));
  screen.position.set(0, LID_H / 2 + 0.004, 0.0013);
  hinge.add(screen);

  // The lid logo, on the outside of the lid: a diamond of four strokes. A
  // single-lamp logo lights all four as one; OMEN Max's lights each its own.
  const logoMats: THREE.MeshBasicMaterial[] = [];
  const logoHalo: THREE.MeshBasicMaterial[] = [];
  if (caps.logo !== 'none') {
    const R = 0.026;
    const strokes = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ];
    const logo = new THREE.Group();
    logo.position.set(0, LID_H * 0.56, -LID_T - 0.0016);
    hinge.add(logo);
    strokes.forEach(([sx, sy], i) => {
      const mat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, side: THREE.DoubleSide }));
      const len = Math.SQRT2 * R * 0.92;
      const bar = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, 0.0034)), mat);
      bar.position.set((sx * R) / 2, (sy * R) / 2, 0);
      bar.rotation.z = (sx * sy > 0 ? -1 : 1) * (Math.PI / 4);
      logo.add(bar);
      logoMats.push(mat);
      if (i === 0) {
        const hm = keep(new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
        const hp = new THREE.Mesh(keep(new THREE.PlaneGeometry(R * 4.2, R * 4.2)), hm);
        hp.position.z = -0.0005;
        logo.add(hp);
        logoHalo.push(hm);
      }
    });
  }

  // A soft shadow under the machine, so it sits on something.
  const shadowTex = canvasTexture(256, 256);
  {
    const g = shadowTex.ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    shadowTex.ctx.fillStyle = g;
    shadowTex.ctx.fillRect(0, 0, 256, 256);
    shadowTex.tex.needsUpdate = true;
  }
  keep(shadowTex.tex);
  const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(BASE_W * 1.5, BASE_D * 1.7)), keep(new THREE.MeshBasicMaterial({ map: shadowTex.tex, transparent: true, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.0002, -0.01);
  shadow.renderOrder = -1;
  group.add(shadow);

  // ── Painting ──────────────────────────────────────────────────────────────
  // A macro key is outside every lighting zone: it wears the colour of the
  // key beside it (Tab, the left zone's edge), so the column lights with its
  // neighbours instead of staying dark.
  const colourOf = (keys: Map<string, string>, code: string): string | undefined => keys.get(code) ?? (macroCodes.has(code) ? keys.get('tab') : undefined);
  const drawKeys = (keys: Map<string, string>, selected?: ReadonlySet<string>) => {
    const { ctx, canvas } = back;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'blur(5px)';
    geo.keys.forEach((k) => {
      const c = colourOf(keys, k.code);
      if (!c) return;
      ctx.fillStyle = c;
      const g = 0.07;
      ctx.fillRect((k.x - g) * PX, (k.y - g) * PX, (k.w + g * 2) * PX, (k.h + g * 2) * PX);
    });
    ctx.restore();
    back.tex.needsUpdate = true;

    const l = legend.ctx;
    l.clearRect(0, 0, legend.canvas.width, legend.canvas.height);
    l.textAlign = 'center';
    l.textBaseline = 'middle';
    geo.keys.forEach((k) => {
      if (k.media) return;
      const c = colourOf(keys, k.code);
      const text = k.label.length > 6 ? k.label.slice(0, 5) : k.label;
      const size = text.length > 2 ? 0.22 : 0.3;
      l.font = `600 ${Math.round(size * PX)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      l.fillStyle = c ?? 'rgba(160,166,178,0.55)';
      l.fillText(text, (k.x + k.w / 2) * PX, (k.y + k.h / 2) * PX);
    });
    // The selection: a white rim round each selected key, over the legend.
    if (selected?.size) {
      l.save();
      l.strokeStyle = 'rgba(255,255,255,0.95)';
      l.lineWidth = Math.max(2, 0.06 * PX);
      l.shadowColor = 'rgba(255,255,255,0.9)';
      l.shadowBlur = 0.12 * PX;
      const inset = 0.03 * PX;
      geo.keys.forEach((k) => {
        if (!selected.has(k.code)) return;
        l.beginPath();
        l.roundRect(k.x * PX + inset, k.y * PX + inset, k.w * PX - inset * 2, k.h * PX - inset * 2, 0.12 * PX);
        l.stroke();
      });
      l.restore();
    }
    legend.tex.needsUpdate = true;
  };

  const lit = (mat: THREE.MeshBasicMaterial, c: string | null) => mat.color.copy(css(c));

  // The macro column's box: its keys, with a little of the board round them.
  const macroKeysRect = geo.keys.filter((k) => macroCodes.has(k.code));
  const macroBox = macroKeysRect.length
    ? new THREE.Box3(
        new THREE.Vector3(bx(Math.min(...macroKeysRect.map((k) => k.x)) - 0.3), capTop - 0.004, bz(Math.min(...macroKeysRect.map((k) => k.y)) - 0.3)),
        new THREE.Vector3(bx(Math.max(...macroKeysRect.map((k) => k.x + k.w)) + 0.3), capTop + 0.004, bz(Math.max(...macroKeysRect.map((k) => k.y + k.h)) + 0.3)),
      )
    : null;
  const keyboardBox = new THREE.Box3(new THREE.Vector3(-BOARD_W / 2, capTop - 0.004, boardZ - boardD / 2), new THREE.Vector3(BOARD_W / 2, capTop + 0.004, boardZ + boardD / 2));

  const rig: LaptopRig = {
    group,
    board: { center: new THREE.Vector3(0, capTop, boardZ), width: BOARD_W, depth: boardD },
    boxes: {
      all: new THREE.Box3(),
      base: new THREE.Box3(new THREE.Vector3(-BASE_W / 2, 0, -BASE_D / 2), new THREE.Vector3(BASE_W / 2, BASE_H, BASE_D / 2)),
      lid: new THREE.Box3(),
      front: new THREE.Box3(new THREE.Vector3(-BASE_W / 2, 0, BASE_D * 0.1), new THREE.Vector3(BASE_W / 2, BASE_H, BASE_D / 2)),
      keyboard: keyboardBox,
      macro: macroBox ?? keyboardBox,
    },
    lid: hinge,
    paint(p) {
      drawKeys(p.keys, p.selected);
      barMats.forEach((m, i) => lit(m, p.bar[i] ?? p.bar[0] ?? null));
      barHalos.forEach((m, i) => m.color.copy(css(p.bar[i] ?? p.bar[0] ?? null)).multiplyScalar(0.55));
      logoMats.forEach((m, i) => lit(m, p.logo[i] ?? p.logo[0] ?? null));
      logoHalo.forEach((m) => m.color.copy(css(p.logo.find(Boolean) ?? null)).multiplyScalar(0.4));
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      base.geometry.dispose();
    },
  };
  group.updateMatrixWorld(true);
  rig.boxes.lid.setFromObject(lid);
  rig.boxes.all.setFromObject(base).union(rig.boxes.lid);
  rig.paint({ keys: new Map(), bar: [], logo: [] });
  return rig;
}
