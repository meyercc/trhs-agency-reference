// User images (avatar, wallpaper) — kept in IndexedDB, not localStorage: a
// photo is megabytes and localStorage tops out around 5 MB for the whole app.
// Images are downscaled before they are stored and never leave the browser
// (the prototype is a static site; there is no server to upload to).
import { useEffect, useState } from 'react';

/** `mode:<id>` is the wallpaper a mode carries; applying that mode copies it
 *  into the app's own `wallpaper` slot, which is what the background renders. */
export type ImageKey = 'avatar' | 'wallpaper' | `mode:${string}`;

const DB_NAME = 'treehouse-images';
const STORE = 'images';
const CHANGED = 'treehouse-image-changed';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putImage(key: ImageKey, blob: Blob) {
  await tx('readwrite', (s) => s.put(blob, key));
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: key }));
}

export async function deleteImage(key: ImageKey) {
  await tx('readwrite', (s) => s.delete(key));
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: key }));
}

/** Hand a mode's image to the app's wallpaper slot. Returns false when the
 *  mode has no image stored (its upload was cleared, or this is a new browser). */
export async function copyImage(from: ImageKey, to: ImageKey): Promise<boolean> {
  const blob = await getImage(from);
  if (!blob) return false;
  await putImage(to, blob);
  return true;
}

export async function getImage(key: ImageKey): Promise<Blob | undefined> {
  try {
    return (await tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** An object URL for a stored image, kept current across every view that shows it. */
export function useStoredImage(key: ImageKey): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let current: string | undefined;
    let alive = true;
    const load = async () => {
      const blob = await getImage(key);
      if (!alive) return;
      if (current) URL.revokeObjectURL(current);
      current = blob ? URL.createObjectURL(blob) : undefined;
      setUrl(current);
    };
    const onChange = (e: Event) => (e as CustomEvent).detail === key && load();
    load();
    window.addEventListener(CHANGED, onChange);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, onChange);
      if (current) URL.revokeObjectURL(current);
    };
  }, [key]);
  return url;
}

/** Fit an image inside `max` px (longest side) and re-encode it as WebP. */
export async function downscale(file: Blob, max: number, square = false): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  let sx = 0;
  let sy = 0;
  let sw = bmp.width;
  let sh = bmp.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/webp', 0.86),
  );
}
