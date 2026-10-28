// A device window that sends the person to a page asks the shell to put the My
// Devices panel away. The shell owns the panel's open state, so this is the one
// way in. (The matching "open the panel on one device" request went with the
// card-opens-panel door, JY 2026-10-22.)

const CLOSE_EVENT = 'th:close-device-panel';

/** Put the My Devices panel away. A window opened from the panel uses it when
 *  it sends the person to a page, as the directory's own page rows do. */
export function closeDevicePanel(): void {
  window.dispatchEvent(new Event(CLOSE_EVENT));
}

/** The shell's side: run `fn` on every request to close. Returns the unsubscribe. */
export function onCloseDevicePanel(fn: () => void): () => void {
  window.addEventListener(CLOSE_EVENT, fn);
  return () => window.removeEventListener(CLOSE_EVENT, fn);
}
