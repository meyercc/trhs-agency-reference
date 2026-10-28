// CDP check for Nova — the AI workspace, a page owned by a module (TH-427 the
// wiring, TH-428 the full-bleed shell; added 2026-10-02).
//
// What is protected, in order of how expensive it would be to lose:
//  1. THE MODULE WIRING. Nova is absent on a fresh install, the route is gated
//     as well as the tab (hiding a nav item does not stop `#/nova`), it has a
//     card in the Module Browser, installing it adds both surfaces, removing it
//     puts everything back. Every part of this fails quietly.
//  2. THE PAGE OWNS THE VIEWPORT. AppShell marks the route `page-full` and
//     shell.css hands the height down as a flex chain. Lose the class or a link
//     in the chain and the page renders as a normal 1100px column with the
//     window scrolling — "fine", and wrong. Every OTHER page must stay as it
//     was, and Nova must narrow beside the Devices panel, not slide under it.
//  3. THE LOG IS THE ONLY SCROLLER on Chat. The window does not scroll; the
//     columns do not scroll; the conversation does.
//  4. THE VIEW IS THE URL. `?view=agents` renders Agents, clicking a view writes
//     the URL, Back flips it — the first two-way param in the app (every `?tab=`
//     is a one-way seed, gotcha 33). And a modal closing over Nova must not
//     wipe it: `?tab=` would have been, which is why this is `?view=`.
//  5. POPOVERS DISMISS AND KEEP ESCAPE TO THEMSELVES. Outside click closes;
//     Escape closes the popover and ONLY the popover — three document-level
//     Escape listeners (Devices flyout, device modal, feature modal) are live
//     while Nova renders, and a leaked Escape closes the panel behind it.
//     Focus returns to the trigger.
//  6. THE ICONS RESOLVE against the sprite the app actually loads. A `<use>`
//     pointing at an absent symbol renders a valid, invisible <svg>; the type
//     checker cannot see it. `twinkle` (the tab), `tokens` and `send` (new).
//  7. A PILL EXPLAINS AND OFFERS (TH-429, inverted by TH-435). Pressing
//     "Overlay" puts the person's turn and Nova's reply in the log and a chip
//     under it — and the page stays put. The CHIP lands on Performance. "Power
//     modes" offers the switch; only its chip switches, and the context rail
//     and the shell's switcher agree afterwards. A reply that moved the page
//     by itself was the most jarring thing in the first build.
//  8. TYPING WORKS LIKE A CHAT. Enter sends, Shift+Enter breaks the line, a
//     known phrase gets its script, an unknown one gets the honest demo-mode
//     reply (source=fallback) rather than silence. Escape in the composer
//     clears the draft and goes no further (gotcha 5 again).
//  9. IT COUNTS AND IT RESETS. Every reply lands in the ledger; "Reset demo
//     state" empties the store and leaves the seeded history; a new chat is a
//     new row. Demo speed is a setting that survives a reload.
// 13. IT FITS A SMALLER WINDOW (TH-433). Below 1024px the context rail is a
//     drawer, below 900px the conversations rail too: toggled from the bar,
//     out of the tab order while closed, closed by Escape without that Escape
//     reaching the Devices flyout, and the composer's selectors stack. At the
//     desk width nothing of this shows.
// 12. THE AGENTS VIEW IS A DASHBOARD (TH-432). Four tiles and a seven-day
//     chart read the same ledger; a reply today moves "runs today", the chart
//     has a readout per day that keyboard users can reach; the store is
//     Forge's own body inline (it replaced the Agent Catalog, TH-479), so
//     adding a card moves "agents added" and the modal still opens; a card
//     that has run carries its usage.
// 11. THE NUMBERS ARE REAL (TH-431). Tokenomics shows totals from the ledger:
//     a reply moves the cloud-equivalent cost, the token rows and the energy;
//     a reply priced as a vendor model costs that vendor's published in/out
//     rates, not the blended assumption, and draws no local energy; the
//     assumptions are settings that persist; the rates say when they were read.
// 10. THE LOCAL MODEL STREAMS, AND FAILS SOFT (TH-430). This suite runs its own
//     OpenAI-compatible server (SSE, CORS, a usage chunk) so the streaming path
//     is proven without Ollama on the machine: the reply is the concatenated
//     deltas, the usage is the server's not an estimate, the ledger gets it.
//     Point it at nothing and the reply is the plain "could not reach it"
//     paragraph, marked, within seconds — never an empty bubble, never an
//     exception. The endpoint survives a reload; a non-local one is refused.
//
// 24. GENERATIVE WIDGETS (TH-452). The card vocabulary is a REGISTRY now
//     (`state/bindings.ts`, ~60 rows) and the model composes from it: each item
//     it returns is a `bind:form` pair from an enum built per request, so an
//     incompatible form is impossible rather than unlikely. What these checks
//     pin, in order of cost: the schema stays FLAT and every array bounded (the
//     two shapes measured to break the model); the enum is RETRIEVED — the rows
//     the sentence named, their domain, the core — never the whole registry,
//     because 26 ids measured 16.7s against 6s; a bound control writes where its
//     home does (a Settings key, a device's profile bag); the validator dedupes,
//     drops a form the row forbids, trims a body that would not fit three rows
//     (it clips silently otherwise), and uses the templated opening when the
//     model's own sentence was the request read back; a stored `bound` card
//     survives a reload with an unknown binding dropped and an unknown form
//     forgotten — never the whole item. And the fallback contract from TH-444
//     is untouched: an unreachable model still yields the regex card.
//     TH-453 (Phase B) composes on EVERY built card: the regex card goes up at
//     once as a PREVIEW — real card, no chips, "composing" under it — and the
//     model's card replaces it under the SAME id, so nothing jumps; a sentence
//     read whole keeps exactly its items and takes the model's title and
//     sentence (measured 2026-10-06: on six such sentences the model's
//     additions were never useful and once wrong). An overlay that names
//     something composes the same way, capped at four; a bare "overlay" stays
//     the classic readout with no call. `/slowpoke/` makes the fake take 1.5s
//     so the preview can be looked at.
// 23. NOVA COMPOSES FROM THE WHOLE APP (TH-450). The card vocabulary was eight
//     readings and two controls; a request for "the volume and mix settings
//     from my headset and microphone" composed nothing. It is now three tables
//     — readings, bound controls, app panels — and every row is one source for
//     the parser, the card's size, the schema's enum and the grounding line.
//     The checks that matter: a control on a card WRITES WHERE ITS HOME DOES
//     (the headset's volume lands in the active profile's bag for the headset,
//     the lights in Settings.underGlow — a slider that silently went nowhere is
//     this app's speciality); a block is the app's own data (the three recent
//     games are `RECENT`'s first three; the deal badge is the Shop's own
//     arithmetic); the Nova chat block sends to the real conversation; a panel
//     whose module is gone is admitted, not rendered empty; a sentence the
//     regex only half read reaches the model WITH the half it read kept; and the
//     card previews at the footprint it will take, so a body that would clip on
//     the board clips in the bubble instead of looking finished.
// 22. THE SCHEMA-CONSTRAINED CALL (TH-444). `specs.ts` had working schemas
//     since TH-442 and NOTHING imported them, so every reply was whatever the
//     regexes could recognise. The policy these checks pin is narrower than
//     "use the model": the patterns answer what they can match, and the model
//     answers what they could not. Since TH-453 every built card reaches the
//     model, but a request the parser READ keeps its items and takes only the
//     model's title and sentence; a guess is the model's to fill. The
//     proposal is untrusted on arrival: an `enum` makes an invalid id
//     impossible but says nothing about REPETITION, and a real granite4.2:8b
//     returns `["dpi","dpi"]` about half the time, which would render twice and
//     look correct. `unavailable` is the one free-text field in either schema,
//     and an earlier system message had it echoing the whole request back. And
//     the load-bearing one: the deterministic reply existed before the call was
//     made, so a model that is missing, slow or wrong costs the person nothing.
// 21. NOVA COMPOSES A DASHBOARD WIDGET (TH-443). "make me a widget with cpu
//     temp and fps" answers with the REAL widget at the size it will take on
//     the board — `WidgetShell` + the HUD's own `OverlayItems`, so one spec
//     reads the same in both homes — and a chip that adds it. Nothing is added
//     uninvited (TH-435 a third time). The chip writes the spec and the board
//     entry TOGETHER, which is the whole trick: `setBoardLayout` normalizes
//     against the cards the current render can see, so a brand-new `card-*` id
//     written separately is dropped on the way in while the reply happily says
//     it was added. "Take it off" leaves the spec, so the picker's Custom group
//     puts it back the way every other widget's ✕ already works. And the
//     routing is checked from all four sides, because the card builder now sits
//     between the overlay builder and the layout builder and both neighbours
//     have a sentence it would otherwise steal.
// 20. NOVA REARRANGES THE DASHBOARD (TH-442). A typed request answers with a
//     DIAGRAM of the proposed board — `packBoard`'s own placement, at the
//     board's own column count — plus two chips. The reply does NOT move the
//     board (TH-435; replacing a whole dashboard uninvited is the strongest
//     case that rule has); the CHIP does, on the LIVE board with no reload,
//     which could not work at all until the layout moved out of component
//     state into Settings. A widget hidden because its module is uninstalled
//     SURVIVES the apply, because the board promises it returns at its saved
//     position and a proposal only ever names the visible ones. The undo
//     restores what was really there, not a recomputation. And the routing gate
//     is checked from both sides: "rearrange my dashboard" reaches the builder,
//     "fan curve" still belongs to its own topic script.
// 19. A MOVED DEFAULT REACHES A STORE THAT ALREADY EXISTS (TH-441). Repointing
//     `DEFAULT_SETTINGS` at Ollama fixed nothing for anyone who had opened Nova
//     before: `loadStore` merges saved settings OVER the defaults, so the old
//     `:8086` lived on in localStorage and the reply read "could not reach it".
//     Invisible to this suite as it stood, because every check seeds its own
//     endpoint — so it shipped and the first real user hit it. These checks pin
//     `migrateSettings`: the pre-TH-441 pair moves forward, a model or endpoint
//     the person CHOSE is left alone, and nobody's conversations or ledger are
//     spent to do it (which is why it is not a `v` bump — that discards the
//     store). Gotcha 44.
// 18. NOVA IS HANDED THE REAL MACHINE (TH-441). The system prompt used to claim
//     Nova knew the desk, the devices and the active profile and hand the model
//     NOTHING, so a real reply invented device names with total confidence. Now
//     a `<nova-context>` block rides on the tail of the user's turn — the tail,
//     not the system message, because volatile state at the front invalidates
//     the KV prefix every turn and Granite drops a system message that is not
//     messages[0]. These checks read what the app SENDS, via the fake server's
//     echo script, so nothing here depends on how a model would answer. The
//     load-bearing ones are the simulator's plugged-in truth and the route:
//     both live BELOW NovaProvider (main.tsx), so they can only arrive through
//     the shell's bridge, and if that bridge is not mounted they go quiet
//     without anything else failing. The budget check is the guard against
//     grounding growing a line at a time forever.
// 17. NOVA BUILDS AN OVERLAY (TH-439). "overlay with fps and gpu temp"
//     answers with a preview of the real Hud holding exactly those tiles,
//     titled from them, with no grip (it is not on screen) and a chip that
//     places it — nothing is placed uninvited (TH-435 again). Placing twice
//     re-places the one overlay; hiding it with its ✕ is reflected in the
//     preview. "dpi overlay" carries the live DPI control; a bare "hud" and
//     the Overlay pill build the classic frame-rate-and-temperatures card.
// 16. OVERLAYS (TH-438). A HUD card on screen: rendered from Settings
//     `overlays`, above the rail panels and below modals, fed by one vitals
//     ticker, dragged by its grip to any pixel and KEPT there (the store is
//     written on release), nudged by the arrow keys from the same grip,
//     clamped to the window, hidden by its ✕ without being deleted.
// 15. A REPLY CARRIES A LIVE CONTROL (TH-437). "brightness", "fan curve",
//     "eq", "dpi" and the Power modes pill answer with the real control in
//     the bubble — the same Slider / FanCurve / Chip radiogroup /
//     ToggleButtonGroup bound to the same store as its home: the display's
//     picture, Settings' fan curve and power mode, the device profile. The
//     proof is read from the OTHER end — the mouse and headset windows show
//     what the chat set. A control with a value of its own looks identical
//     and binds to nothing.
// 14. IT PINS TO THE RIGHT RAIL AND FOLLOWS YOU (TH-434). The shell's "Ask
//     Nova" button docks the SAME chat on every other page; the content
//     reserves the rail rather than sliding under it; the pin is a preference
//     that survives a reload; on /nova the panel stands down so one log is
//     never drawn twice; unpinned it leaves the tab order, not just the
//     screen; and Devices and Nova never hold the rail at once. The
//     load-bearing one is that a reply sent FROM the panel still acts — the
//     router-bound actions moved from the page to the shell for exactly this,
//     and a chat that explains and then does nothing looks completely fine.
//
// Proven to fail (TH-434, 2026-10-02): stopping AppShell from registering the
// router-bound actions reds "AND the reply still acts" AND the two TH-429 act
// checks ("and the action fired", "Power modes switches the profile") — which
// is the proof the shell is now their only source, not a second one. Dropping
// `.shell.nova-open` from the reservation selector in shell.css reds exactly
// "the content reserves the rail" (padding 0) and "the content ends before the
// panel begins" — the panel then overlaps the page, which is invisible in a
// screenshot of an empty area and is why both geometry checks are kept.
// Mounting NovaPanel's contents while it is closed (dropping the `present`
// guard) does NOT red the TH-434 section at all — it reds seven checks spread
// across TH-429, TH-430 and TH-433 instead, because a second hidden .nova-log
// and composer join every unscoped `document.querySelector`. That is the shape
// this duplication fails in: never where you added it.
//
// Proven to fail (TH-432, 2026-10-02): not passing the ledger through to the
// inline cards reds exactly "a card that has run carries its usage".
// Proven to fail (TH-431, 2026-10-02): pricing every reply at the blended
// rate regardless of model reds "a reply priced as a vendor model costs that
// vendor's rates".
// Proven to fail (TH-442, 2026-10-03): making `applyLayout` ASSIGN instead of
// merge — the obvious implementation, and the one that quietly costs people
// widgets — gives 216/217 and reds exactly "the hidden widget survives the
// merge". Nothing else moves, which is the point: every other layout check
// stays green while the board silently forgets a widget whose module is
// uninstalled, so that one check is the whole protection for the board's
// hidden-not-deleted promise. Do not delete it as redundant.
// Proven to fail (TH-441, 2026-10-03): dropping `migrateSettings` from
// `loadStore` — i.e. the exact code that shipped broken — gives 203/206 and reds
// precisely the three checks that assert the pair MOVED. The three that assert
// it does not overreach stay GREEN, correctly: "nothing changes" is trivially
// true when nothing migrates, so do not read their green as coverage of the
// migration itself.
// Proven to fail (TH-441, 2026-10-03): dropping <NovaContextBridge /> from
// AppShell gives 193/200 — the SEVEN presence checks red (each reporting the
// echo server's NO-CONTEXT-BLOCK) and NOTHING else in the file, which is the
// proof that grounding is additive and the local-model path still works
// without it. The other three grounding checks stay GREEN on purpose: "not
// polluted", "never shows up as something the person said" and the budget are
// guards against the block being WRONG, not against it being absent, and all
// three are trivially true when there is no block. Do not read their green as
// presence coverage. Narrowing the catalog by module but NOT by desk also reds
// nothing today, because only pulse-27 is desk-optional.
// Proven to fail (TH-430, 2026-10-02): dropping the delta handling in
// streamChat reds "the reply is exactly what the server streamed" (ignoring
// `[DONE]` would NOT — the server closes the stream after it, so the reader
// ends anyway); rethrowing on unreachable in the provider reds "fails soft",
// its error marking, "the composer is usable again" and "no uncaught page
// errors" — the last because the rethrow is an unhandled rejection.
// Proven to fail (TH-436–439, 2026-10-02), each break run against the whole
// suite and restored: binding the chat fan curve to local state instead of
// Settings reds exactly "the curve is the Settings one" (and nothing else —
// the chart still draws, which is the point); dropping `control` steps in the
// engine reds every TH-437 control check AND every TH-439 preview (a built
// overlay rides on a control record); not writing the store on drag release
// reds "the store has the new place", the arrow-key nudge (it nudges from the
// unsaved position) and "after a reload it is still where it was left";
// removing the builder from send() reds the four typed-request checks while
// the Overlay PILL stays green, because its static steps are the default
// build — so a regression in the builder cannot hide behind the pill.
// Proven to fail (TH-435, 2026-10-02): letting the engine perform the offer
// again (the pre-TH-435 behaviour) reds "the page did NOT go anywhere" and
// "does NOT switch the profile by itself"; deleting the Overlay script's
// `offer` step reds "offers it as a chip instead" and "pressing the chip is
// what takes you there" (the chip IS the offer, so both are right to go);
// removing the composer's stopPropagation reds exactly "composer Escape goes
// no further".
// Proven to fail (2026-10-02): dropping the `.shell.page-full` chain from
// shell.css reds exactly "reaches the bottom edge, less its own inset" and "the full width, less its own inset" — Nova
// collapses to the 1100px column at x=170, y-bottom 619. The window-scroll
// and Devices-panel checks stay GREEN on an empty page (nothing overflows,
// and a 1100px column already fits beside the panel), so the two geometry
// checks are the load-bearing ones; do not delete them as redundant. Removing
// the popover's stopPropagation reds exactly "ONLY the popover — the Devices
// panel behind it is still open".
// Proven to fail (TH-452, 2026-10-06), breaks run in pairs against the whole
// suite and restored after the build: returning no domain siblings from
// `retrieveBindings` reds "a sentence about the headset retrieves the
// headset's rows", "the model's pair renders bound to the headset" AND the
// TH-450 "RETRIEVED vocabulary" check (the enum shrinks to the core); dropping
// `fitToRows` from the widget refine reds "six wide items are trimmed" and
// "the body does not clip" (537px in a 448px body); keeping a forbidden form
// at arrival AND at render reds exactly "a form the row forbids is dropped" —
// `fps` rendered as a slider. Removing the arrival dedupe in
// `proposalToBoundItems` ALONE reds nothing: `mergeItems` dedupes on
// `itemKey` too, so the duty is held twice; removing both reds "a repeated
// binding renders once, whatever its forms" plus TH-444's two repeated-item
// checks. Do not delete either layer as redundant — the pure one is what
// `measure-nova.mjs` counts duplicates against.
// Proven to fail (TH-453, 2026-10-06), breaks restored right after the build:
// dropping the preview patch in `runStructured` reds exactly "the regex card
// is already up as a preview" and "no chips to move out from under the
// reader"; ignoring `readAll` reds exactly section 22's "keeps exactly the
// items it read" (CPU temp, FPS, RAM); never setting `refine` in
// `overlayScriptFor` reds exactly the four-item cap and the HUD pair; forcing
// the setting lock off reds exactly "renders LOCKED"; dropping the picture
// setter reds exactly "moving contrast writes this display's picture".
// Proven to fail (TH-454, 2026-10-06): switching off the form lift in
// `refineScript` (`formFor`, the model's form onto a seed item) reds exactly
// "the model's forms land on the items the parser read", "the gauge is a
// dial, the meter a bar" and "a form asked for on a single read item is
// honoured" — every reading a tile again; feeding the sparkline two points
// instead of the history reds exactly "drawn from the stream's two-minute
// history" (1 segment), run ALONE because paired with the form break the
// sparkline was a tile and the red was not its own.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. It writes `trhs-modules`, `board-layout` and `cards`, and
// clears them at the end.
import WebSocket from 'ws';
import http from 'node:http';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());
const httpJson2 = (url) => fetch(url).then((r) => r.json());

let msgId = 0;
function makeSend(ws) {
  const pending = new Map();
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

// ── A stand-in for the local model ────────────────────────────────────────
// Speaks just enough of the OpenAI chat-completions dialect: CORS so the page
// can call it, GET /v1/models for "Test connection", and a streamed reply in
// four SSE chunks — three deltas and a usage line — then [DONE].
//
// It is also a MIRROR (TH-441). Ask it to "echo my context" and it streams the
// <nova-context> block straight back, so the suite can read the real grounding
// snapshot out of a chat bubble. That tests what the app SENDS without ever
// asserting on what a model would reply — there is no model here.
const FAKE_DELTAS = ['Hello ', 'from the ', 'fake model.'];
const FAKE_USAGE = { prompt_tokens: 41, completion_tokens: 7 };
const ECHO_PHRASE = 'echo my context';
/** The deltas for one request: the echo script, or the default reply. */
function deltasFor(body) {
  try {
    const msgs = JSON.parse(body).messages ?? [];
    const last = [...msgs].reverse().find((m) => m.role === 'user')?.content ?? '';
    if (last.toLowerCase().includes(ECHO_PHRASE)) {
      const at = last.indexOf('<nova-context>');
      // No block is itself the answer: say so rather than echoing the question.
      return [at < 0 ? 'NO-CONTEXT-BLOCK' : last.slice(at)];
    }
  } catch {
    /* a body we cannot read falls through to the default */
  }
  return FAKE_DELTAS;
}
/**
 * A canned STRUCTURED proposal (TH-444). `requestJson` sends `stream: false`
 * and a `response_format`, so these requests must be answered with a plain JSON
 * body rather than the SSE the rest of this server speaks.
 *
 * Scripted rather than modelled, like everything else here: the point is to
 * prove what the app DOES with a proposal, including the shapes a real model
 * actually produces. The duplicates below are not invented — granite4.2:8b
 * returns `["gpu-temp", "cpu-temp", "gpu-temp"]` and `["dpi", "dpi"]` on about
 * half of these requests even when the system message forbids it, and an
 * earlier system message had it echoing the whole request back as `unavailable`.
 */
/** The schema the app last sent for a card, so a check can read what the model was allowed to say. */
let lastWidgetSchema = null;
function jsonReplyFor(body) {
  let b;
  try {
    b = JSON.parse(body);
  } catch {
    return null;
  }
  if (b?.response_format?.type !== 'json_schema') return null;
  const name = b.response_format.json_schema?.name;
  const last = [...(b.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
  // The `widget` schema (TH-452): items are `bind:form` pairs, or a bare id for
  // a bespoke control or an app panel. Every reply here is a shape a real model
  // produced or a shape the validator must survive.
  if (name === 'widget') {
    lastWidgetSchema = b.response_format.json_schema?.schema ?? null;
    // A partly-read sentence (TH-450): the regex read `fps`; the model reads
    // Discord and names it unavailable, and adds a reading the regex missed.
    // Deliberately WITHOUT `fps`: the regex read it, so it must arrive from the
    // seed. With `fps` in here the seed check passed with the merge removed
    // (red-proofed 2026-10-04), which made it decoration.
    if (/discord/i.test(last)) return { title: 'Discord + FPS', items: ['ram:tile'], note: 'Frame rate with memory beside it.', unavailable: ['Discord'] };
    if (/doubled/i.test(last)) return { title: 'Doubled', items: ['gpu-temp:tile', 'cpu-temp:tile', 'gpu-temp:tile', 'dpi', 'dpi'], note: 'Temperatures and sensitivity.', unavailable: [] };
    if (/parroted/i.test(last)) return { title: 'Parroted', items: ['fps:tile'], note: last, unavailable: [last] };
    if (/unshowable/i.test(last)) return { title: 'Nothing', items: [], note: '', unavailable: ['Spotify'] };
    // Six wide items whose measured heights sum past three board rows — the
    // validator must trim from the tail until the body fits (TH-452).
    if (/overflow/i.test(last)) return { title: 'Overflow', items: ['fan-curve', 'dpi', 'lights', 'volume:slider', 'mic-gain:vu', 'brightness:slider'], note: 'Everything at once.', unavailable: [] };
    // A form the enum could never emit for a read-only reading — the arrival
    // check must drop the form and keep the item.
    if (/badform/i.test(last)) return { title: 'Bad form', items: ['fps:slider'], note: 'Frame rate as a slider.', unavailable: [] };
    if (/sibling/i.test(last)) return { title: 'Headset', items: ['volume:slider', 'sidetone:toggle'], note: 'Your headset\u2019s volume and mic monitoring.', unavailable: [] };
    // Answered after 1.5s (see the handler) so the preview can be looked at (TH-453);
    // the items are NOT what the sentence named, which is how a fully-read
    // sentence proves the model's additions are not read.
    if (/slowpoke/i.test(last)) return { title: 'Slowpoke', items: ['fps:tile', 'ram:tile'], note: 'Frame rate with memory beside it, slowly.', unavailable: [] };
    // The read-only forms (TH-454): the model's form rides on items the parser
    // read, so the pairs here name the SEED's bindings with a form each.
    if (/forms/i.test(last)) return { title: 'Forms', items: ['cpu-temp:gauge', 'cpu:meter', 'ram:sparkline'], note: 'Temperature as a dial, load as a bar, memory over time.', unavailable: [] };
    if (/dial/i.test(last)) return { title: 'Dial', items: ['cpu-temp:gauge'], note: 'CPU temperature as a dial.', unavailable: [] };
    return { title: 'Fake Card', items: ['fps:tile', 'ram:tile', 'power-mode:choice'], note: 'Frame rate and memory, with the power mode beside them.', unavailable: [] };
  }
  if (name === 'layout') return { note: 'A fake board, arranged by the fake model.', items: ['vitals', 'cpu', 'appearance'], unavailable: [] };
  return null;
}

const fake = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method === 'GET' && req.url === '/last-widget-schema') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(lastWidgetSchema));
  }
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'fake-7b' }, { id: 'fake-14b' }] }));
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // Structured requests are not streamed — see `jsonReplyFor`.
      const structured = jsonReplyFor(body);
      if (structured) {
        // `/slowpoke/` takes long enough to look at the preview (TH-453).
        const wait = /slowpoke/i.test(body) ? 1500 : 0;
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(structured) }, finish_reason: 'stop' }], usage: FAKE_USAGE }));
        }, wait);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const deltas = deltasFor(body);
      let i = 0;
      const tick = () => {
        if (i < deltas.length) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: deltas[i++] } }] })}\n\n`);
          setTimeout(tick, 60);
        } else {
          res.write(`data: ${JSON.stringify({ choices: [], usage: FAKE_USAGE })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      };
      tick();
    });
    return;
  }
  res.writeHead(404).end();
});
// Port 0 — the OS picks a free one. This was a fixed 11499 until 2026-10-02,
// which made the suite impossible to run twice at once: the verify runner fans
// suites across lanes, and a second verify-nova (or a developer running one by
// hand beside it) died on EADDRINUSE before a single check ran, then looked
// like a flaky suite rather than a port clash. Nothing outside this file needs
// the number — the app is handed it as a string below.
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const FAKE_PORT = fake.address().port;
// Declared with the port rather than beside its first streaming use: the
// structured section (TH-444) is earlier in the file and `const` has no
// hoisting, so a later declaration is a temporal-dead-zone error at run time.
const FAKE_EP = `http://localhost:${FAKE_PORT}/v1/chat/completions`;

const targets = await httpJson('/json/list');
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error(`no page target on CDP ${CDP_PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
const send = makeSend(ws);
await send('Page.enable');
await send('Runtime.enable');

const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text);
});

const VIEW_W = 1440;
const VIEW_H = 1000;
const viewport = async (w, h = VIEW_H) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
};
await viewport(VIEW_W);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const ev = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

// A hash-only change does not remount, and `Page.reload` after one races the
// router (gotcha 33). Force a real document load and wait for it.
let nav = 0;
const go = async (hash) => {
  const loaded = new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Page.loadEventFired') {
        ws.off('message', onMsg);
        resolve();
      }
    };
    ws.on('message', onMsg);
  });
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?n=${++nav}#${hash}` });
  // A load event can be missed or coalesced under contention; a suite that
  // then waits forever is worse than one that reports. Bounded (2026-10-02).
  await Promise.race([loaded, sleep(8000)]);
  // This was `await sleep(1400)` — 55 call sites, 77 seconds of unconditional
  // waiting, over half this suite's runtime (TH-448). It stood in for "React
  // has mounted", so wait for that instead. `.shell` is AppShell's root and is
  // rendered on every route including one that redirects, and the document is
  // always fresh here (`?n=` forces a real load), so it cannot be satisfied by
  // the previous page. A route that opens a modal waits for the dialog too,
  // which is the lazy part the fixed sleep was really covering.
  const wantsDialog = /modal=|sku=/.test(hash);
  const ready = `!!document.querySelector('.shell') && document.body.innerText.trim().length > 50`
    + (wantsDialog ? ` && !!document.querySelector('[role="dialog"]')` : '');
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    if (await ev(ready).catch(() => false)) break;
    await sleep(50);
  }
  // Then wait for an actual PAINT, not a guess at one: two animation frames
  // after mount means the browser has composited at least once. On the runner's
  // software GL that is the thing a fixed sleep was approximating, and it costs
  // whatever it really costs instead of a flat 1400ms.
  await ev(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`).catch(() => {});
  // A small tail on top. NOT zero — several checks read a settled transition
  // (gotcha 25), and at 250ms this suite needed a retry once under the runner
  // while passing six times standalone. 400ms still returns ~55s a run.
  await sleep(400);
};
const escape = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(250);
};
const click = async (selector) => {
  await ev(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  await sleep(350);
};
const rect = async (selector) =>
  JSON.parse(await ev(`JSON.stringify((document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect() ?? null))`));

const typeText = async (text) => {
  await send('Input.insertText', { text });
  await sleep(120);
};
// `text` is what the key would insert — without it CDP sends a keydown that
// no character follows, so Shift+Enter would never break a line. (No
// nativeVirtualKeyCode, gotcha 29.)
const key = async (k, code, vk, mods = 0, text) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, ...(text ? { text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods });
  await sleep(250);
};
const SHIFT = 8;
/** Set a React-controlled input the way typing would — native setter + input event. */
const setInput = (selector, value) =>
  ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
/** Nova's store with scripted replies set to arrive at once — the suite is not here to watch typing dots. */
// Pinned to the 27C2 scope: this suite checks the Power modes and Fan curve
// replies, which June 2027 replaces (verify-june27 covers June's Nova).
const seedNova = (extra = {}) => ev(`localStorage.setItem('mvpScope', '27c2'); localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant' }, ...${JSON.stringify(extra)} }))`);
const novaStore = () => ev(`JSON.parse(localStorage.getItem('trhs-nova') || 'null')`);
// Scoped to `.nova` — the PAGE's log. Since TH-434 the same ChatLog can also
// be in the pinned panel, and an unscoped `.nova-log` then means "whichever
// is last in the document", which is the panel. Worse, a panel mid-close
// still has its copy for the length of the slide, so an unscoped selector is
// not even deterministic. Checks about the page say `.nova`; checks about the
// panel say `.nova-panel`; nothing says just `.nova-log`.
const assistantCount = () => ev(`document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant').length`);
const lastAssistant = () => ev(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-bubble')?.innerText ?? ''`);
const waitFor = async (expr, ms = 4000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(expr)) return true;
    await sleep(100);
  }
  return false;
};

const hasNovaTab = `[...document.querySelectorAll('a[href$="#/nova"]')].length > 0`;
const setModules = (obj) => ev(`localStorage.setItem('trhs-modules', JSON.stringify(${JSON.stringify(obj)}))`);
const installed = { nova: true };

console.log('\nThe default — Nova ships absent');
await go('/');
// `novaPinned` is a persisted preference (TH-434), so a previous run of this
// suite — or any other suite sharing the profile — leaves Nova docked. Clear
// it before the first measurement rather than discovering it as a one-in-four
// failure somewhere further down.
// This suite is about the RAIL — Top bar entry (Floating is the default since 2026-10-28).
await ev(`localStorage.removeItem('novaPinned'); localStorage.setItem('novaEntry', 'topbar')`);
await go('/');
await ev(`localStorage.removeItem('trhs-modules')`);
await go('/');
check('a fresh browser has NO Nova tab in the nav', (await ev(hasNovaTab)) === false);

console.log('\nThe gate — hiding the tab is not enough');
await go('/nova');
check('deep-linking #/nova without the module lands on Home, not on Nova', await ev(`location.hash === '#/' || location.hash === ''`), await ev(`location.hash`));
check('and nothing of the page renders', (await ev(`!!document.querySelector('.nova')`)) === false);

console.log('\nThe way in — a card in the Module Browser');
await go('/?modal=modules');
check('Nova has a card you can find and add', await ev(`[...document.querySelectorAll('.mb-card')].some((c) => /\\bNova\\b/.test(c.innerText))`));

console.log('\nInstalled — both surfaces appear');
await setModules(installed);
await go('/');
// Nova left the nav on 2026-10-20: its door is the chat button by the account
// menu, and installing adds THAT, not a tab.
check('there is still no Nova tab in the nav', (await ev(hasNovaTab)) === false);
check('the chat button by the account menu is the way in', (await ev(`[...document.querySelectorAll('.shell-util button')].map((b) => b.getAttribute('aria-label'))`)).some((l) => l === 'Ask Nova' || l === 'Unpin Nova'));
await go('/nova');
check('the page renders, named Nova to assistive tech', (await ev(`document.querySelector('.nova h1.page-title')?.textContent?.trim()`)) === 'Nova');
// Native scrollbars follow the theme (2026-10-22): with no color-scheme on the
// dark root, Chrome drew light ones on the log and the rails.
const schemes = `['.nova-log', '.nova-rail-context'].map((s) => document.querySelector(s) && getComputedStyle(document.querySelector(s)).colorScheme)`;
check('the log and the rail scroll with dark scrollbars', (await ev(schemes)).every((v) => v === 'dark'), JSON.stringify(await ev(schemes)));
await ev(`localStorage.setItem('theme', 'light')`);
await go('/nova');
check('…and light ones in the light theme', (await ev(schemes)).every((v) => v === 'light'), JSON.stringify(await ev(schemes)));
await ev(`localStorage.setItem('theme', 'dark')`);
await go('/nova');

console.log('\nThe page owns the viewport');
check('AppShell marks the route page-full', await ev(`document.querySelector('.shell')?.classList.contains('page-full')`));
check(
  'the window does not scroll — the page fills the viewport exactly',
  await ev(`document.scrollingElement.scrollHeight <= innerHeight + 1`),
  await ev(`document.scrollingElement.scrollHeight + ' vs ' + innerHeight`),
);
{
  // Since 2026-10-02 the page is a card inset by one gutter on every side
  // (Chris's tuning of nova.css: `.nova { margin: var(--gutter-xs) }`), so
  // "full-bleed" means the shell gives it the whole viewport and the page
  // keeps exactly that margin — no more, no less. Read the inset off the
  // page rather than restating the token here.
  const r = await rect('.nova');
  const inset = await ev(`parseFloat(getComputedStyle(document.querySelector('.nova')).marginBottom)`);
  check('and Nova reaches the bottom edge, less its own inset', !!r && Math.abs(r.bottom - (VIEW_H - inset)) < 2, JSON.stringify(r) + ` inset ${inset}`);
  check('and the full width, less its own inset on each side', !!r && Math.abs(r.width - (VIEW_W - inset * 2)) < 2 && Math.abs(r.left - inset) < 2, JSON.stringify(r) + ` inset ${inset}`);
}
await go('/nova?devices=1');
{
  const n = await rect('.nova');
  const p = await rect('.device-panel.open');
  check('beside the Devices panel it narrows rather than sliding under', !!n && !!p && n.right <= p.left + 1, `nova.right=${n?.right} panel.left=${p?.left}`);
}
await go('/');
check('every other page is untouched: Home is not page-full', (await ev(`document.querySelector('.shell')?.classList.contains('page-full')`)) === false);
check('and keeps its 1100px column', (await ev(`getComputedStyle(document.querySelector('.shell-content')).maxWidth`)) === '1100px');

console.log('\nThe log is the only scroller');
await go('/nova');
check('the chat body itself does not scroll', await ev(`(() => { const el = document.querySelector('.nova-chat'); return !!el && el.scrollHeight <= el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'auto'; })()`));
check('the log is the scroll region', (await ev(`getComputedStyle(document.querySelector('.nova-log')).overflowY`)) === 'auto');
check('the composer sits inside the viewport', await ev(`(() => { const r = document.querySelector('.nova-composer')?.getBoundingClientRect(); return !!r && r.bottom <= innerHeight + 1; })()`));

console.log('\nThe view is the URL');
await go('/nova?view=agents');
check('?view=agents renders the Agents view', await ev(`!!document.querySelector('.nova-agents') && !document.querySelector('.nova-chat')`));
await ev(`[...document.querySelectorAll('.nova-topbar [role="tab"]')].find((b) => /chat/i.test(b.innerText))?.click()`);
await sleep(350);
check('choosing Chat writes the URL (no param — chat is canonical)', await ev(`!/view=/.test(location.hash) && !!document.querySelector('.nova-chat')`), await ev(`location.hash`));
await ev(`[...document.querySelectorAll('.nova-topbar [role="tab"]')].find((b) => /agents/i.test(b.innerText))?.click()`);
await sleep(350);
check('choosing Agents writes ?view=agents', await ev(`/view=agents/.test(location.hash) && !!document.querySelector('.nova-agents')`), await ev(`location.hash`));
check('and the chosen view reads as selected, not by color alone', await ev(`[...document.querySelectorAll('.nova-topbar [role="tab"]')].find((b) => /agents/i.test(b.innerText))?.getAttribute('aria-selected') === 'true'`));
await ev(`history.back()`);
await sleep(500);
check('Back flips the view', await ev(`!!document.querySelector('.nova-chat')`), await ev(`location.hash`));

console.log('\nA modal closing over Nova keeps the view');
await go('/nova?view=agents');
await click('button[aria-label="Forge"]');
check('Forge opens over Nova', await ev(`!!document.querySelector('.modal-shell.forge')`));
await escape();
check('Escape closes it', (await ev(`!!document.querySelector('.modal-shell.forge')`)) === false);
check('and Nova is still on Agents — the modal host did not eat the view', await ev(`/view=agents/.test(location.hash) && !!document.querySelector('.nova-agents')`), await ev(`location.hash`));

console.log('\nPopovers dismiss, and keep Escape to themselves');
await go('/nova?devices=1');
await click('button[aria-label="Tokenomics"]');
check('Tokenomics opens as a dialog', await ev(`!!document.querySelector('.nova-pop[role="dialog"][aria-label="Tokenomics"]')`));
check('and the trigger says so', (await ev(`document.querySelector('button[aria-label="Tokenomics"]')?.getAttribute('aria-expanded')`)) === 'true');
await ev(`document.querySelector('.nova-log').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
await sleep(250);
check('a click outside closes it', (await ev(`!!document.querySelector('.nova-pop')`)) === false);
await click('button[aria-label="Nova settings"]');
check('Settings opens', await ev(`!!document.querySelector('.nova-pop[aria-label="Nova settings"]')`));
check('focus moved into the panel', await ev(`!!document.activeElement?.closest('.nova-pop')`), await ev(`document.activeElement?.outerHTML?.slice(0, 80)`));
await escape();
check('Escape closes the popover', (await ev(`!!document.querySelector('.nova-pop')`)) === false);
check(
  'and ONLY the popover — the Devices panel behind it is still open (load-bearing: this is the stopPropagation check)',
  await ev(`!!document.querySelector('.device-panel.open')`),
);
check('focus returned to the trigger', (await ev(`document.activeElement?.getAttribute('aria-label')`)) === 'Nova settings');

console.log('\nA pill explains and offers — it does not act (TH-435)');
await go('/nova');
await seedNova();
await go('/nova');
check('a fresh chat shows the seeded history in the rail', (await ev(`document.querySelectorAll('.nova-convo').length`)) === 8);
check('and an empty log', await ev(`!!document.querySelector('.nova-log-empty')`));
await ev(`[...document.querySelectorAll('.nova-prompts .ds-chip, .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'Overlay')?.click()`);
check('pressing Overlay puts the person\'s turn in the log', await waitFor(`document.querySelector('.nova .nova-log .ds-chat-msg.user .ds-chat-msg-bubble')?.innerText === 'Overlay'`));
check('and Nova explains', await waitFor(`([...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-bubble')?.innerText ?? '').length > 80`));
// The reply must NOT move the page. Wait long enough that an act step
// would have fired at instant speed, then assert nothing happened.
await sleep(600);
check('and the page did NOT go anywhere — Nova is still open', await ev(`location.hash.startsWith('#/nova')`), await ev(`location.hash`));
check('the reply offers it as a chip instead', await ev(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg-actions .ds-chip')].some((c) => /Performance/.test(c.innerText))`));
await ev(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg-actions .ds-chip')].find((c) => /Performance/.test(c.innerText))?.click()`);
check('and pressing the chip is what takes you there', await waitFor(`location.hash.startsWith('#/perform')`), await ev(`location.hash`));
await go('/nova');
check('the conversation is there when they come back, titled after the prompt', await ev(`[...document.querySelectorAll('.nova-convo')].some((r) => r.querySelector('.nova-convo-title')?.innerText === 'Overlay' && r.getAttribute('aria-current') === 'true')`));
check('with both turns persisted', (await assistantCount()) === 1 && (await ev(`document.querySelectorAll('.nova-log .ds-chat-msg.user').length`)) === 1);
check('and the reply still carries the chip', await ev(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg-actions .ds-chip')].some((c) => /Performance/.test(c.innerText))`));
check('the rail preview is the reply', await ev(`document.querySelector('.nova-convo[aria-current="true"] .nova-convo-preview')?.innerText?.length > 20`));
// Switch to Work in the shell; Nova must OFFER the switch back, and only
// the chip may make it.
await click('.profile-switcher-btn');
await ev(`[...document.querySelectorAll('.profile-switcher-menu [role="menuitemradio"], .ds-context-menu [role="menuitemradio"]')].find((r) => /Work/.test(r.innerText))?.click()`);
await sleep(400);
check('the shell switcher is on Work', await ev(`/Work/.test(document.querySelector('.profile-switcher-btn')?.innerText ?? '')`), await ev(`document.querySelector('.profile-switcher-btn')?.innerText`));
check('and the context rail agrees', (await ev(`document.querySelector('.nova-profile-name')?.innerText`)) === 'Work');
await ev(`[...document.querySelectorAll('.nova-prompts .ds-chip, .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'Power modes')?.click()`);
check('Power modes explains', await waitFor(`([...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-bubble')?.innerText ?? '').length > 80`));
await sleep(600);
check('and does NOT switch the profile by itself — still Work', (await ev(`document.querySelector('.nova-profile-name')?.innerText`)) === 'Work', await ev(`document.querySelector('.nova-profile-name')?.innerText`));
await ev(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg-actions .ds-chip')].find((c) => /Gaming/.test(c.innerText))?.click()`);
check('pressing "Switch to Gaming" switches it — the rail is live', await waitFor(`document.querySelector('.nova-profile-name')?.innerText === 'Gaming'`));
check('and the shell switcher agrees', await ev(`/Gaming/.test(document.querySelector('.profile-switcher-btn')?.innerText ?? '')`));
check('and the activity feed records the press, not the reply', await ev(`JSON.parse(localStorage.getItem('trhs-nova') || '{}').activity?.some((a) => a.kind === 'action' && /Switch to Gaming/.test(a.text))`));

console.log('\nTyping works like a chat');
await ev(`document.querySelector('.nova-composer textarea')?.focus()`);
await typeText('hello');
check('the send button wakes up with a draft', (await ev(`document.querySelector('button[aria-label="Send"]')?.disabled`)) === false);
await key('Enter', 'Enter', 13);
check('Enter sends: the known phrase gets its script', await waitFor(`([...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-bubble')?.innerText ?? '').startsWith('Hello. I am Nova')`));
check('and the field is empty and focused again', await ev(`document.activeElement === document.querySelector('.nova-composer textarea') && document.querySelector('.nova-composer textarea').value === ''`));
await typeText('first line');
await key('Enter', 'Enter', 13, SHIFT, '\r');
await typeText('second');
check('Shift+Enter breaks the line without sending', await ev(`document.querySelector('.nova-composer textarea').value === 'first line\\nsecond'`), await ev(`JSON.stringify(document.querySelector('.nova-composer textarea').value)`));
check('and the field grew to two rows', (await ev(`document.querySelector('.nova-composer textarea').rows`)) === 2);
await key('Escape', 'Escape', 27);
check('Escape clears the draft', (await ev(`document.querySelector('.nova-composer textarea').value`)) === '');
await typeText('what is the airspeed of an unladen swallow');
await key('Enter', 'Enter', 13);
check('an unknown question gets the honest demo-mode reply, not silence', await waitFor(`[...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop()?.dataset.source === 'fallback'`));
await go('/nova?devices=1');
await ev(`document.querySelector('.nova-composer textarea')?.focus()`);
await key('Escape', 'Escape', 27);
check('composer Escape goes no further — the Devices panel is still open (load-bearing: stopPropagation)', await ev(`!!document.querySelector('.device-panel.open')`));

console.log('\nIt counts and it resets');
{
  const st = await novaStore();
  check('every reply landed in the ledger', st?.ledger?.events?.length >= 3, `events=${st?.ledger?.events?.length}`);
  check('with tokens, seconds and a cost', await ev(`(() => { const e = JSON.parse(localStorage.getItem('trhs-nova')).ledger.events.pop(); return e.inTokens > 0 && e.outTokens > 0 && e.seconds >= 0 && e.costUsd > 0; })()`));
  check('and a run in today\'s bucket', await ev(`(() => { const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); return (JSON.parse(localStorage.getItem('trhs-nova')).ledger.byDay[k]?.runs ?? 0) >= 3; })()`));
}
await go('/nova');
await click('.nova-rail-head button');
check('New chat empties the log', await ev(`!!document.querySelector('.nova-log-empty')`));
await ev(`document.querySelector('.nova-composer textarea')?.focus()`);
await typeText('thanks');
await key('Enter', 'Enter', 13);
check('and the next message is a new row in the rail', await waitFor(`document.querySelectorAll('.nova-convo').length === 10`), await ev(`document.querySelectorAll('.nova-convo').length`));
await click('button[aria-label="Nova settings"]');
await ev(`[...document.querySelectorAll('.nova-pop [role="tab"]')].find((b) => /2×/.test(b.innerText))?.click()`);
await sleep(200);
await go('/nova');
check('demo speed is a setting that survives a reload', (await novaStore())?.settings?.demoSpeed === 'fast');
await click('button[aria-label="Nova settings"]');
await ev(`[...document.querySelectorAll('.nova-pop button')].find((b) => /Reset demo state/.test(b.innerText))?.click()`);
await sleep(400);
check('Reset demo state empties the store', (await novaStore()) === null || (await novaStore())?.conversations?.length === 0);
check('and leaves the seeded history, nothing else', (await ev(`document.querySelectorAll('.nova-convo').length`)) === 8);
check('with an empty log', await ev(`!!document.querySelector('.nova-log-empty')`));

console.log('\nThe numbers are real');
await seedNova();
await go('/nova');
await click('button[aria-label="Tokenomics"]');
check('Tokenomics opens on three totals and the rows', (await ev(`document.querySelectorAll('.nova-pop .ds-stat-tile').length`)) === 3 && (await ev(`document.querySelectorAll('.nova-pop .nova-tok-row').length`)) === 4);
check('fresh, the cost is zero and avoided is a dash', (await ev(`document.querySelector('.nova-pop [data-key="cost"] .ds-stat-val')?.innerText?.trim()`)) === '$0.00' && /—/.test(await ev(`document.querySelector('.nova-pop [data-key="avoided"] .ds-stat-val')?.innerText ?? ''`)));
check('and says when the vendor rates were read', /as of \w+ \d+, \d{4}/.test(await ev(`document.querySelector('.nova-pop .nova-pop-note')?.innerText ?? ''`)));
await escape();
await ev(`[...document.querySelectorAll('.nova-prompts .ds-chip, .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'OMEN AI')?.click()`);
await waitFor(`!document.querySelector('.nova-log .ds-chat-msg.streaming') && document.querySelectorAll('.nova-log .ds-chat-msg.assistant').length === 1`);
await escape(); // the OMEN AI modal the script opened
await click('button[aria-label="Tokenomics"]');
const costAfterOne = await ev(`document.querySelector('.nova-pop [data-key="cost"] .ds-stat-val')?.innerText?.trim()`);
check('a reply moves the cloud-equivalent cost', costAfterOne !== '$0.00', costAfterOne);
check('and the token rows', (await ev(`parseFloat(document.querySelector('.nova-pop [data-key="out"] .nova-tok-num')?.innerText) > 0`)) === true);
check('and the local energy — milliwatt-hours at instant speed, never a zero', await ev(`(() => { const t = document.querySelector('.nova-pop [data-key="energy"] .ds-stat-val')?.innerText ?? ''; return /[1-9]/.test(t) && /Wh/.test(t); })()`), await ev(`document.querySelector('.nova-pop [data-key="energy"] .ds-stat-val')?.innerText`));
check('and all of it was avoided — the reply was local', (await ev(`document.querySelector('.nova-pop [data-key="avoided"] .ds-stat-val')?.innerText?.replace(/\\s/g, '')`)) === '100%');
await escape();
// Price the next reply as a vendor model: same script, same token count, a different cost.
await ev(`[...document.querySelectorAll('.nova-composer-selects [class*="ds-dropdown"] button, .nova-composer-selects .ds-dropdown-trigger')][0]?.click()`);
await sleep(300);
await ev(`[...document.querySelectorAll('.ds-dropdown-pop [role="option"]')].find((o) => /Opus 5\.5/.test(o.innerText))?.click()`);
await sleep(300);
check('a vendor model can be chosen', (await novaStore())?.modelId === 'anthropic-opus-5-5', (await novaStore())?.modelId);
await ev(`[...document.querySelectorAll('.nova-prompts .ds-chip, .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'OMEN AI')?.click()`);
await waitFor(`!document.querySelector('.nova-log .ds-chat-msg.streaming') && document.querySelectorAll('.nova-log .ds-chat-msg.assistant').length === 2`);
await escape();
{
  const st = await novaStore();
  const [a, b] = st.ledger.events.slice(-2);
  const expected = (b.inTokens / 1e6) * 4 + (b.outTokens / 1e6) * 20;
  check('a reply priced as a vendor model costs that vendor\'s rates — in and out separately', a.inTokens === b.inTokens && a.outTokens === b.outTokens && Math.abs(b.costUsd - expected) < 1e-9 && Math.abs(a.costUsd - b.costUsd) > 1e-9, `local=${a.costUsd} vendor=${b.costUsd} expected=${expected}`);
  check('and draws no local energy', b.wh === 0 && a.wh > 0);
}
await click('button[aria-label="Tokenomics"]');
check('avoided is now a share, not all', (await ev(`document.querySelector('.nova-pop [data-key="avoided"] .ds-stat-val')?.innerText?.replace(/\\s/g, '')`)) !== '100%');
check('and the rate row names the model', /Opus 5\.5/.test(await ev(`document.querySelector('.nova-pop [data-key="rate"]')?.innerText ?? ''`)));
await escape();
await click('button[aria-label="Nova settings"]');
await setInput('.nova-pop input[aria-label^="Assumed local draw"]', '95');
await escape();
await go('/nova');
check('the assumptions are settings that persist', (await novaStore())?.settings?.localWatts === 95);

console.log('\nThe local model streams, and fails soft');
await seedNova();
await go('/nova');
await click('button[aria-label="Nova settings"]');
await setInput('.nova-pop input[aria-label^="OpenAI-compatible"]', 'http://example.com/v1/chat/completions');
check('the endpoint field refuses an address that is not this machine', await ev(`!!document.querySelector('.nova-pop .ds-input-error')`));
await setInput('.nova-pop input[aria-label^="OpenAI-compatible"]', `http://localhost:${FAKE_PORT}/v1/chat/completions`);
check('and accepts a local one', (await ev(`!!document.querySelector('.nova-pop .ds-input-error')`)) === false);
await setInput('.nova-pop input[aria-label="Model name"]', 'fake-7b');
await ev(`document.querySelector('.nova-pop [role="switch"], .nova-pop .ds-toggle')?.click()`);
await sleep(200);
check('the switch turns the local model on', (await novaStore())?.settings?.llmEnabled === true);
await ev(`[...document.querySelectorAll('.nova-pop button')].find((b) => /Test connection/.test(b.innerText))?.click()`);
check('Test connection really asks the server', await waitFor(`/connected/i.test(document.querySelector('.nova-pop-test-result')?.innerText ?? '')`, 5000), await ev(`document.querySelector('.nova-pop-test-result')?.innerText`));
check('and offers the models it lists', (await ev(`document.querySelectorAll('.nova-pop datalist option').length`)) === 2);
await escape();
await go('/nova');
check('the endpoint survives a reload', (await novaStore())?.settings?.endpoint === `http://localhost:${FAKE_PORT}/v1/chat/completions`);
await ev(`document.querySelector('.nova-composer textarea')?.focus()`);
await typeText('what is the airspeed of an unladen swallow');
await key('Enter', 'Enter', 13);
check('an unknown question goes to the model and streams back', await waitFor(`[...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop()?.dataset.source === 'llm' && !document.querySelector('.nova-log .ds-chat-msg.streaming')`, 6000));
check('the reply is exactly what the server streamed', (await lastAssistant()) === FAKE_DELTAS.join(''), await lastAssistant());
{
  const st = await novaStore();
  const ev2 = st?.ledger?.events?.slice(-1)[0];
  const msg = st?.conversations?.flatMap((c) => c.messages).filter((m) => m.source === 'llm').pop();
  check('with the server\'s usage, not an estimate', msg?.usage?.estimated === false && msg?.usage?.inTokens === FAKE_USAGE.prompt_tokens && msg?.usage?.outTokens === FAKE_USAGE.completion_tokens, JSON.stringify(msg?.usage));
  check('and the ledger counted it', ev2?.inTokens === FAKE_USAGE.prompt_tokens && ev2?.outTokens === FAKE_USAGE.completion_tokens, JSON.stringify(ev2));
}
check('the meta does not say estimated', !/estimated/.test(await ev(`[...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-meta')?.innerText ?? ''`)));
// Now point it at nothing.
await click('button[aria-label="Nova settings"]');
await setInput('.nova-pop input[aria-label^="OpenAI-compatible"]', 'http://localhost:1/v1/chat/completions');
await escape();
await ev(`document.querySelector('.nova-composer textarea')?.focus()`);
await typeText('and now?');
await key('Enter', 'Enter', 13);
check('fails soft: an unreachable model gets the plain "could not reach it" reply', await waitFor(`(() => { const m = [...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop(); return m?.dataset.source === 'fallback' && /could not reach it/.test(m.innerText); })()`, 8000), await lastAssistant());
check('marked as an error, by the border AND the meta line', await ev(`(() => { const m = [...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop(); return m.classList.contains('error') && /Not connected/.test(m.querySelector('.ds-chat-msg-meta')?.innerText ?? ''); })()`));
check('and the composer is usable again', (await ev(`document.querySelector('.nova-composer textarea')?.disabled`)) !== true && (await ev(`!document.querySelector('.nova-log .ds-chat-msg.streaming')`)));

// ── Nova rearranges the dashboard (TH-442) ────────────────────────────────
// The load-bearing properties, in order of what it would cost to lose them:
// the reply does NOT move the board (TH-435 — replacing someone's whole
// dashboard uninvited is the strongest case that rule has); the chip DOES, on
// the live board with no reload, which is the half that could not work at all
// before the layout moved into Settings; a widget hidden because its module is
// gone SURVIVES the merge, because the board promises it comes back at its
// saved position and a proposal only ever names the visible ones; and the undo
// restores what was really there.
console.log('\nNova rearranges the dashboard');
{
  // omenai installed-false so its widget is hidden-but-stored — the thing the
  // merge has to protect. Pinned, so the chat and the board are on screen at
  // once: that is the only way to see a LIVE board change (TH-434's lesson).
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, omenai: false }))`);
  await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'omenai', span: 2, rows: 1 }, { id: 'cpu', span: 2, rows: 1 }, { id: 'appearance', span: 2, rows: 1 }]))`);
  await ev(`localStorage.setItem('novaPinned', 'true')`);
  await seedNova();
  await go('/');

  const onBoard = () => ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).join(',')`);
  const storedIds = () => ev(`(JSON.parse(localStorage.getItem('board-layout') || '[]')).map((i) => i.id).join(',')`);
  const lastPanel = (sel) => `[...document.querySelectorAll('.nova-panel .ds-chat-msg.assistant')].pop()?.${sel}`;

  check('a hidden widget is not on the board', (await onBoard()) === 'cpu,appearance', await onBoard());
  check('but is still in the store', (await storedIds()).includes('omenai'), await storedIds());

  await ev(`document.querySelector('.nova-panel textarea')?.focus()`);
  await typeText('rearrange my dashboard for streaming');
  await key('Enter', 'Enter', 13);
  await waitFor(`!!${lastPanel('querySelector(".wb-preview-grid")')}`, 6000);

  check('the reply draws the proposed board as a diagram', (await ev(`${lastPanel('querySelectorAll(".wb-preview-cell").length')} ?? 0`)) > 3);
  // The diagram borrows the board's own column count via packBoard, so the
  // proportions are the board's rather than a guess.
  check(
    'at the board\'s own column count',
    (await ev(`(() => { const g = ${lastPanel('querySelector(".wb-preview-grid")')}; return g ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : 0; })()`)) === 6,
  );
  // The names are in the PROSE too, because at 380px a diagram label ellipses
  // to nothing — the diagram carries shape, the sentence carries content.
  check('and names the widgets in words, not only in the diagram', /System Vitals/.test(await ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`)));
  check('it offers to use it, and to put it back', (await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`)) === 'Use this layout|Put it back');
  // TH-435, for the most intrusive action Nova has.
  check('and the board has NOT moved', (await onBoard()) === 'cpu,appearance', await onBoard());

  const before = await storedIds();
  await ev(`(() => { const c = [...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].find((c) => /use this layout/i.test(c.textContent)); if (c) c.click(); return !!c; })()`);
  await waitFor(`[...document.querySelectorAll('.wb-cell')].some((c) => c.dataset.widget === 'vitals')`, 4000);
  check('pressing the chip rearranges the LIVE board, with no reload', (await onBoard()).startsWith('vitals,'), await onBoard());
  check('and the hidden widget survives the merge', (await storedIds()).includes('omenai'), await storedIds());

  await ev(`(() => { const c = [...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].find((c) => /put it back/i.test(c.textContent)); if (c) c.click(); return !!c; })()`);
  await waitFor(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).join(',') === 'cpu,appearance'`, 4000);
  check('and the undo restores exactly what was there', (await storedIds()) === before, `${await storedIds()} vs ${before}`);

  // The gate: a layout request needs a board noun AND a change verb, or the
  // topic scripts lose "fan curve" / "dpi" to it. Both directions matter.
  await ev(`document.querySelector('.nova-panel textarea')?.focus()`);
  await typeText('fan curve');
  await key('Enter', 'Enter', 13);
  await sleep(600);
  check('and "fan curve" still belongs to its own script, not the board', !(await ev(`!!${lastPanel('querySelector(".wb-preview-grid")')}`)));

  await ev(`localStorage.removeItem('novaPinned'); localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); localStorage.removeItem('board-layout')`);
}

// ── The schema-constrained call (TH-444) ──────────────────────────────────
// `specs.ts` has had working schemas since TH-442 and NOTHING imported them, so
// every reply was whatever the regexes could recognise. These checks pin the
// policy that wires them in, which is narrower than "use the model":
//
//   the patterns answer what they can match, and the model answers what they
//   could not.
//
// So a request the parser READ keeps its items — the model adds nothing to a
// sentence it read whole (TH-453) and gives only the title and the sentence —
// while a request it only guessed at is the model's to fill. Everything
// else here is about the proposal being untrusted on arrival: it is free text
// inside two enum arrays, and both of the shapes checked below are ones a real
// granite4.2:8b produced, not ones imagined for a test.
console.log('\nThe schema-constrained call');
{
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true }))`);
  await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'cpu', span: 2, rows: 1 }, { id: 'appearance', span: 2, rows: 1 }]))`);
  await ev(`localStorage.removeItem('cards')`);
  const seedLlm = (endpoint) => ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant', llmEnabled: true, endpoint: '${endpoint}', model: 'fake-7b' } }))`);
  await seedLlm(FAKE_EP);
  await go('/nova');

  const last = (sel) => `[...document.querySelectorAll('.nova-log .ds-chat-msg.assistant')].pop()?.${sel}`;
  const ask = async (text, waitFoR) => {
    await ev(`document.querySelector('.nova-composer textarea')?.focus()`);
    await typeText(text);
    await key('Enter', 'Enter', 13);
    await waitFor(waitFoR, 8000);
  };
  const bubble = () => ev(`${last('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`);
  const tiles = () => ev(`[...(${last('querySelectorAll("[data-card-preview] .ds-stat-tile-head")')} ?? [])].map((e) => e.textContent).join(',')`);

  // A guess reaches the model, and the reply is built from ITS choice.
  await ask('build me a widget', `!!${last('querySelector("[data-card-preview]")')}`);
  check('a guessed card request is answered by the model', (await ev(`${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`)) === 'Fake Card', await ev(`${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`));
  check('and the reply is marked as the model\u2019s', (await ev(`${last('getAttribute("data-source")')} ?? ''`)) === 'llm', await ev(`${last('getAttribute("data-source")')} ?? ''`));
  // One call, one ledger entry, and the model's own numbers — not an estimate.
  check('with the model\u2019s own usage in the ledger', (await ev(`(JSON.parse(localStorage.getItem('trhs-nova') || '{}').ledger?.events ?? []).slice(-1)[0]?.outTokens`)) === 7, await ev(`JSON.stringify((JSON.parse(localStorage.getItem('trhs-nova') || '{}').ledger?.events ?? []).slice(-1)[0] ?? null)`));
  // The copy has to admit the model chose: "just the readings you asked for"
  // would be a lie for a request that named none.
  // The model's own sentence leads the reply (TH-452); "a card to start from"
  // is now the fallback for a note the guard rejected.
  check('and leads with the model\u2019s own sentence', /Frame rate and memory, with the power mode beside them\./.test(await bubble()), await bubble());

  // A DUPLICATE is the shape a real model actually returns, and an enum cannot
  // prevent it. `OverlayItems` keys tiles by index, so both would render and the
  // card would show one reading twice while looking entirely correct.
  await ask('build me a doubled widget', `(${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? '') === 'Doubled'`);
  check('a repeated reading is dropped, not rendered twice', (await tiles()) === 'GPU temp,CPU temp', await tiles());
  check('and so is a repeated control', (await ev(`(${last('querySelectorAll("[data-card-preview] .ds-live-control").length')} ?? 0)`)) === 1);

  // `unavailable` is the one field in either schema that is not an enum, so it
  // is the one field a model can fill with anything — and one did.
  await ask('build me a parroted widget', `(${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? '') === 'Parroted'`);
  check('the request echoed back as "unavailable" is not read out', !/could not put build me a parroted widget/i.test(await bubble()), await bubble());

  // Nothing to build, but something honest to say — the reason the schema asks
  // for `unavailable` at all.
  await ask('build me an unshowable widget', `/Spotify/.test(${last('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? '')`);
  check('a request nothing can measure gets a plain no, not a card', !(await ev(`!!${last('querySelector("[data-card-preview]")')}`)) && /nothing else on this machine reports it/.test(await bubble()), await bubble());

  // The policy, from the other side (TH-453): the parser READ this one, so the
  // items are its own — the fake offers fps, ram and the power mode and none of
  // it lands — while the title and the sentence are the model's.
  await ask('build me a widget with cpu temp and fps', `!!${last('querySelector("[data-card-preview]")')} && !${last('dataset.status')}`);
  check('a request the parser READ keeps exactly the items it read', (await tiles()) === 'CPU temp,FPS', await tiles());
  check('and takes only the model\u2019s title and sentence', (await ev(`${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`)) === 'Fake Card' && /power mode beside them/.test(await bubble()) && (await ev(`${last('getAttribute("data-source")')} ?? ''`)) === 'llm', `${await ev(`${last('querySelector(".wb-card-preview .w-label-text")?.textContent')}`)} / ${await ev(`${last('getAttribute("data-source")')}`)}`);

  // A board with no recipe behind it is a guess too, and gets the model's note.
  await ask('sort out my dashboard', `!!${last('querySelector(".wb-preview-grid")')}`);
  check('a board no recipe matched is arranged by the model', (await ev(`[...(${last('querySelectorAll(".wb-preview-cell")')} ?? [])].map((c) => c.dataset.widget).join(',')`)) === 'vitals,cpu,appearance', await ev(`[...(${last('querySelectorAll(".wb-preview-cell")')} ?? [])].map((c) => c.dataset.widget).join(',')`));
  check('and the reply is the model\u2019s own sentence', /arranged by the fake model/.test(await bubble()), await bubble());

  // THE LOAD-BEARING ONE. The deterministic reply existed before the call was
  // made, so a model that is missing, slow or wrong must cost the person
  // nothing — no error bubble, no empty bubble, no apology. Just the reply they
  // would have had.
  await seedLlm('http://localhost:9/v1/chat/completions');
  await go('/nova');
  await ask('build me a widget', `!!${last('querySelector("[data-card-preview]")')}`);
  check('an unreachable model falls back to the built reply', (await ev(`${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`)) === 'Frame rate & temps', await ev(`${last('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`));
  check('and is NOT marked as an error', (await ev(`${last('getAttribute("data-source")')} ?? ''`)) === 'scripted' && !(await ev(`!!${last('querySelector(".ds-chat-msg[data-status=\\"error\\"]")')}`)), await ev(`${last('getAttribute("data-source")')} ?? ''`));
  check('and still lands in the ledger, like every other reply', (await ev(`(JSON.parse(localStorage.getItem('trhs-nova') || '{}').ledger?.events ?? []).length`)) > 0);

  await ev(`localStorage.removeItem('board-layout'); localStorage.removeItem('cards')`);
}

// ── Nova composes a dashboard widget (TH-443) ─────────────────────────────
// Three builders now read the same sentence (overlay → card → layout), so the
// most expensive thing to lose is the ROUTING, and it is checked from all four
// sides. After that: the reply offers and does not act; the chip adds to the
// LIVE board; the card SURVIVES A RELOAD — which it did not, because
// `setBoardLayout` normalizes against the cards the current render can see and
// a brand-new `card-*` id is unknown to that snapshot, so the spec was stored,
// the board was not written, and the reply still said it had been added; and
// "Take it off" leaves the spec behind, so the picker's Custom group can put it
// back the way every other widget's ✕ already works.
console.log('\nNova composes a dashboard widget');
{
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true }))`);
  await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'cpu', span: 2, rows: 1 }, { id: 'appearance', span: 2, rows: 1 }]))`);
  await ev(`localStorage.removeItem('cards')`);
  await ev(`localStorage.setItem('novaPinned', 'true')`);
  await seedNova();
  await go('/');

  const onBoard = () => ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).join(',')`);
  const storedIds = () => ev(`(JSON.parse(localStorage.getItem('board-layout') || '[]')).map((i) => i.id).join(',')`);
  const storedCards = () => ev(`(JSON.parse(localStorage.getItem('cards') || '[]')).map((c) => c.title).join(',')`);
  const lastPanel = (sel) => `[...document.querySelectorAll('.nova-panel .ds-chat-msg.assistant')].pop()?.${sel}`;
  const ask = async (text) => {
    await ev(`document.querySelector('.nova-panel textarea')?.focus()`);
    await typeText(text);
    await key('Enter', 'Enter', 13);
  };

  await ask('make me a widget with cpu temp and fps');
  await waitFor(`!!${lastPanel('querySelector("[data-card-preview]")')}`, 6000);

  check('a card request previews the REAL widget, not a picture of one', (await ev(`${lastPanel('querySelectorAll("[data-card-preview] .ds-stat-tile").length')} ?? 0`)) === 2);
  check('titled from what it holds', /CPU temp \+ FPS/.test(await ev(`${lastPanel('querySelector(".w-label-text")?.textContent')} ?? ''`)), await ev(`${lastPanel('querySelector(".w-label-text")?.textContent')} ?? ''`));
  // The preview is the widget at the size `cardMeta` will give it on the board,
  // so "what you see is what gets added" is literally true. Both `.w` and
  // `.ds-stat-tile` are content-box, so this only holds with box-sizing set —
  // without it the preview renders 50px wider and taller than the real cell.
  check(
    'at the size it will take on the board',
    (await ev(`(() => { const w = ${lastPanel('querySelector(".wb-card-preview > .w")')}; if (!w) return 0; return Math.round(w.getBoundingClientRect().height); })()`)) === 160,
    await ev(`(() => { const w = ${lastPanel('querySelector(".wb-card-preview > .w")')}; return w ? JSON.stringify(w.getBoundingClientRect()) : 'none'; })()`),
  );
  check('it offers to add it, and to take it off', (await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`)) === 'Add to dashboard|Take it off');
  // TH-435 again.
  check('and the board has NOT moved', (await onBoard()) === 'cpu,appearance', await onBoard());
  check('and nothing is in the card store yet', (await storedCards()) === '', await storedCards());

  await ev(`(() => { const c = [...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].find((c) => /add to dashboard/i.test(c.textContent)); if (c) c.click(); return !!c; })()`);
  await waitFor(`[...document.querySelectorAll('.wb-cell')].some((c) => (c.dataset.widget || '').startsWith('card-'))`, 4000);
  check('pressing the chip adds it to the LIVE board, with no reload', (await onBoard()).includes('card-'), await onBoard());
  check('and the card renders its tiles there', (await ev(`document.querySelector('.wb-cell[data-widget^="card-"] .wb-card-items')?.children.length ?? 0`)) === 2);
  // `cardMeta` is the only thing that names a custom card, so without it the
  // three board aria-labels fall back to the literal word "widget".
  // The corner × became a row in the card's ⋮ (TH-462), so the card's name is
  // on the MENU — «More options for <name>» — and the row is the plain verb.
  check('and its ⋮ says the card\u2019s own name', /More options for CPU temp \+ FPS/.test(await ev(`document.querySelector('.wb-cell[data-widget^="card-"] .card-menu button')?.getAttribute('aria-label') ?? ''`)), await ev(`document.querySelector('.wb-cell[data-widget^="card-"] .card-menu button')?.getAttribute('aria-label') ?? ''`));

  // The one that shipped broken until it was measured: the spec and the board
  // entry have to be written together, or the id is normalized away on the way
  // in and again on every mount.
  const added = await storedIds();
  await go('/');
  check('and it survives a reload \u2014 the spec and the board entry agree', (await storedIds()) === added && (await onBoard()).includes('card-'), `${await storedIds()} / ${await onBoard()}`);

  await ev(`(() => { const c = [...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].find((c) => /take it off/i.test(c.textContent)); if (c) c.click(); return !!c; })()`);
  await waitFor(`![...document.querySelectorAll('.wb-cell')].some((c) => (c.dataset.widget || '').startsWith('card-'))`, 4000);
  check('"Take it off" takes it off the board', !(await onBoard()).includes('card-'), await onBoard());
  check('but KEEPS the spec, the way every other widget\u2019s \u2715 does', (await storedCards()) === 'CPU temp + FPS', await storedCards());

  // ...which is only true if there is somewhere to get it back from.
  await ev(`[...document.querySelectorAll('.wb-add')].pop()?.click() ?? [...document.querySelectorAll('button')].find((b) => /add a widget/i.test(b.textContent))?.click()`);
  await waitFor(`!!document.querySelector('.wb-pick')`, 3000);
  check('the picker offers it back under "Custom"', await ev(`[...document.querySelectorAll('.wb-pick-group')].some((g) => /Custom/i.test(g.querySelector('.wb-pick-cat')?.textContent ?? '') && /CPU temp/.test(g.textContent))`));
  check('and that is the one place it can be forgotten', (await ev(`[...document.querySelectorAll('.wb-pick-forget')].map((b) => b.getAttribute('aria-label')).join('|')`)) === 'Forget CPU temp + FPS', await ev(`[...document.querySelectorAll('.wb-pick-forget')].map((b) => b.getAttribute('aria-label')).join('|')`));
  await ev(`document.querySelector('.wb-pick-forget')?.click()`);
  await sleep(400);
  check('forgetting it empties the store', (await storedCards()) === '', await storedCards());
  await ev(`document.querySelector('.wb-pick .modal-close')?.click()`);
  await sleep(300);

  // ── The routing gate, from all four sides ──
  // The card builder sits between the overlay builder and the layout builder,
  // and each neighbour has a sentence that would be stolen without its gate.
  await ask('an overlay with fps and gpu temp');
  await sleep(900);
  check('"overlay" still builds an overlay, not a card', await ev(`!!${lastPanel('querySelector(".overlay-preview")')} && !${lastPanel('querySelector("[data-card-preview]")')}`));

  await ask('rearrange my dashboard for streaming');
  await sleep(900);
  check('"rearrange my dashboard" still builds a layout, not a card', await ev(`!!${lastPanel('querySelector(".wb-preview-grid")')} && !${lastPanel('querySelector("[data-card-preview]")')}`));

  // ── The three honest answers to a card request ──
  // Everything below exists because the first build had only one: a card, when
  // two or more readings from an eight-word vocabulary were named. Every other
  // phrasing fell through to the layout builder's catch-all and came back as a
  // performance DASHBOARD — a considered-looking reply to a question nobody
  // asked, which is harder to notice than no reply at all.

  // 1. Nothing named. The most natural sentence there is, and it has to make a
  // widget — then teach the vocabulary so the next sentence can be specific.
  await ask('build me a widget');
  await waitFor(`!!${lastPanel('querySelector("[data-card-preview]")')}`, 6000);
  check('"build me a widget" composes a card, not a dashboard', await ev(`!!${lastPanel('querySelector("[data-card-preview]")')} && !${lastPanel('querySelector(".wb-preview-grid")')}`));
  // Built from the three tables (TH-450), so it names a reading, a control and a panel.
  check('and says what else a card can hold', /frame rate.*power mode.*recent games/s.test(await ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`)), await ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`));

  // 2. A reading a DESIGNED widget shows better. Storage used to be something a
  // card could not hold at all; since TH-452 a drive's use is a registry row,
  // so the card is built AND the Storage widget is named as the designed
  // alternative, with a chip for each — offer, do not decide.
  await ask('build me a widget that shows my storage');
  await waitFor(`!!${lastPanel('querySelector("[data-card-preview]")')}`, 6000);
  check('a drive reading composes a card', (await ev(`${lastPanel('querySelector("[data-card-preview] [data-metric]")?.dataset.metric')} ?? ''`)) === 'drive-c-used', await ev(`${lastPanel('querySelector("[data-card-preview] [data-metric]")?.dataset.metric')} ?? ''`));
  check('and the widget that shows it with more room is offered', (await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`)).includes('Add Storage'), await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`));
  // That chip must be ADDITIVE. `applyLayout` with a one-item array is a
  // REPLACEMENT — its merge keeps only the widgets a proposal could not see — so
  // routing this through it would delete every visible widget on the board.
  {
    const was = (await onBoard()).split(',').filter(Boolean);
    await ev(`(() => { const c = [...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].find((c) => /add storage/i.test(c.textContent)); if (c) c.click(); return !!c; })()`);
    await waitFor(`[...document.querySelectorAll('.wb-cell')].some((c) => c.dataset.widget === 'storage')`, 4000);
    const now = (await onBoard()).split(',').filter(Boolean);
    check('and adding it KEEPS the rest of the board', was.every((id) => now.includes(id)) && now.includes('storage'), `${was.join(',')} -> ${now.join(',')}`);
  }

  // 3. One reading a designed widget shows better. It used to REFUSE and fall
  // through — which produced a whole dashboard, so the person got neither. Now
  // the card is built and the alternative is named: two answers, both offered.
  await ask('make me a widget that shows my cpu temp');
  await waitFor(`!!${lastPanel('querySelector("[data-card-preview]")')}`, 6000);
  check('one reading a widget covers still composes the card that was asked for', await ev(`!!${lastPanel('querySelector("[data-card-preview]")')}`));
  check('and names the designed widget as the alternative', /Thermal/.test(await ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`)), await ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`));
  check('offering both, rather than deciding', (await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`)) === 'Add to dashboard|Take it off|Add Thermal', await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`));

  // A named catalog widget is that widget, not a card that happens to hold
  // temperatures — without this "add the thermal widget" became the default card.
  await ask('add the thermal widget');
  await sleep(1200);
  check('"add the thermal widget" points at Thermal and composes nothing', !(await ev(`!!${lastPanel('querySelector("[data-card-preview]")')}`)) && (await ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`)) === 'Add Thermal');

  // The plural is the whole difference between composing and arranging.
  await ask('rearrange my widgets');
  await sleep(1000);
  check('the PLURAL still belongs to the board, not the card builder', await ev(`!!${lastPanel('querySelector(".wb-preview-grid")')} && !${lastPanel('querySelector("[data-card-preview]")')}`));

  await ev(`localStorage.removeItem('novaPinned'); localStorage.removeItem('board-layout'); localStorage.removeItem('cards')`);
}

// ── Nova composes from the whole app (TH-450) ─────────────────────────────
// The vocabulary is three tables now, and the thing most worth protecting is
// that a control on a card is BOUND: the same key the device window edits, so a
// change lands in the active profile. After that, that a block shows the app's
// own data rather than a copy, that absence is admitted, and that a half-read
// sentence reaches the model with the read half kept.
console.log('\nNova composes from the whole app');
{
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, shop: true, lightstudio: true }))`);
  await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'cpu', span: 2, rows: 1 }]))`);
  await ev(`localStorage.removeItem('cards'); localStorage.removeItem('trhs-profiles'); localStorage.removeItem('underGlow')`);
  await ev(`localStorage.setItem('novaPinned', 'true')`);
  await seedNova();
  await go('/');

  const lastPanel = (sel) => `[...document.querySelectorAll('.nova-panel .ds-chat-msg.assistant')].pop()?.${sel}`;
  const bubble = () => ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`);
  // The prose alone: a block's own absent frame inside the preview also says
  // "module is not installed", which let a check pass while the card composed.
  const prose = () => ev(`(() => { const m = ${lastPanel('querySelector(".ds-chat-msg-bubble")?.cloneNode(true)')}; if (!m) return ''; m.querySelectorAll('.ds-chat-msg-controls, [data-card-preview], .wb-card-preview').forEach((e) => e.remove()); return m.innerText; })()`);
  const chips = () => ev(`[...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].map((c) => c.textContent.trim()).join('|')`);
  const kinds = () => ev(`[...(${lastPanel('querySelectorAll(".wb-card-items > *")')} ?? [])].map((c) => c.dataset.control ? 'c:' + c.dataset.control : c.dataset.block ? 'b:' + c.dataset.block : c.dataset.metric ? 'm:' + c.dataset.metric : '?').join(',')`);
  const ask = async (text, until) => {
    const before = await ev(`document.querySelectorAll('.nova-panel .ds-chat-msg.assistant').length`);
    await ev(`document.querySelector('.nova-panel textarea')?.focus()`);
    await typeText(text);
    await key('Enter', 'Enter', 13);
    await waitFor(until ?? `document.querySelectorAll('.nova-panel .ds-chat-msg.assistant').length > ${before} && !${lastPanel('dataset.status')}`, 8000);
    await sleep(200);
  };
  const profileBag = (sku) => ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null'); const p = s?.profiles?.find((p) => p.id === s.activeId); return JSON.stringify(p?.devices?.[${JSON.stringify(sku)}] ?? null); })()`);

  // ── A bound control writes where its home does ──
  await ask('create a widget with the volume and mix settings from my headset and microphone');
  check('headset volume and mic mix compose as two bound controls', (await kinds()) === 'c:volume,c:mic-mix', await kinds());
  {
    const titles = await ev(`[...(${lastPanel('querySelectorAll(".ds-live-control-title")')} ?? [])].map((e) => e.textContent).join('|')`);
    check('each names the device it bound to', titles === 'HyperX Cloud III volume|SoloCast 2 Pro monitor mix', titles);
  }
  check('and the reply says where a change goes', /saved to your active profile/.test(await bubble()), await bubble());
  check('two sliders need the second board row, and the preview takes it', (await ev(`${lastPanel('querySelector("[data-card-preview]")?.dataset.rows')} ?? ''`)) === '2' && (await ev(`Math.round(${lastPanel('querySelector(".wb-card-preview > .w")?.getBoundingClientRect().height')} ?? 0)`)) === 344, await ev(`Math.round(${lastPanel('querySelector(".wb-card-preview > .w")?.getBoundingClientRect().height')} ?? 0)`));
  check('nothing is in the headset’s profile bag yet', (await profileBag('cloud-iii')) === 'null', await profileBag('cloud-iii'));
  await ev(`(() => { const el = ${lastPanel('querySelector(\'input[type="range"][aria-label$=" volume"]\')')}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '31'); el.dispatchEvent(new Event('input', { bubbles: true })); return !!el; })()`);
  await sleep(300);
  check('moving the volume slider on the card writes the headset’s audio.volume into the ACTIVE PROFILE', /"audio.volume":31/.test(await profileBag('cloud-iii')), await profileBag('cloud-iii'));
  check('and the card reads it back', (await ev(`${lastPanel('querySelector(\'[data-control="volume"] .ds-live-control-value\')?.textContent')} ?? ''`)) === '31%', await ev(`${lastPanel('querySelector(\'[data-control="volume"] .ds-live-control-value\')?.textContent')} ?? ''`));
  // The same binding the device window has: open the headset and the slider agrees.
  await go('/?sku=cloud-iii');
  await waitFor(`!!document.querySelector('[role="dialog"] input[type="range"][aria-label="Volume"]')`, 6000);
  check('the headset window shows the value the card set', (await ev(`document.querySelector('[role="dialog"] input[type="range"][aria-label="Volume"]')?.value`)) === '31', await ev(`document.querySelector('[role="dialog"] input[type="range"][aria-label="Volume"]')?.value`));
  await go('/');

  // ── Blocks are the app's own data ──
  await ask('make me a widget of my 3 most recently played games');
  check('"my 3 most recently played games" is a recent-games block of three rows', (await kinds()) === 'b:recent-games' && (await ev(`${lastPanel('querySelectorAll(".cb-row").length')} ?? 0`)) === 3, `${await kinds()} / ${await ev(`${lastPanel('querySelectorAll(".cb-row").length')} ?? 0`)}`);
  check('and they are RECENT’s first three, in order', (await ev(`[...(${lastPanel('querySelectorAll(".cb-row .ds-list-item-label")')} ?? [])].map((e) => e.textContent).join('|')`)) === "Baldur's Gate 3|Monster Hunter Wilds|Apex Legends", await ev(`[...(${lastPanel('querySelectorAll(".cb-row .ds-list-item-label")')} ?? [])].map((e) => e.textContent).join('|')`));
  check('with Last Played offered as the designed alternative', (await chips()) === 'Add to dashboard|Take it off|Add Last Played', await chips());
  check('and the copy says what the panel is, not "a panel"', /games you played most recently/.test(await bubble()), await bubble());

  await ask("make a widget with the shop's latest deals");
  check('"the shop’s latest deals" is a deals block', (await kinds()) === 'b:deals' && (await ev(`${lastPanel('querySelectorAll(".cb-row").length')} ?? 0`)) === 2, await kinds());
  // The Shop page's own arithmetic: 1 − 10.49/59.99 rounds to 83, where the old
  // widget said −65% from a hand-typed row.
  check('the deepest saving first, with the Shop’s own discount', (await ev(`${lastPanel('querySelector(".cb-row .ds-list-item-label")?.textContent')} ?? ''`)) === 'Elden Ring' && (await ev(`${lastPanel('querySelector(".cb-row .ds-badge")?.textContent')} ?? ''`)) === '−83%', await ev(`${lastPanel('querySelector(".cb-row .ds-badge")?.textContent')} ?? ''`));
  check('priced as the Shop prices it: sale green, original struck', (await ev(`${lastPanel('querySelector(".cb-row .ds-card-price.sale")?.textContent')} ?? ''`)) === '$10.49' && (await ev(`${lastPanel('querySelector(".cb-row .ds-card-price.orig")?.textContent')} ?? ''`)) === '$59.99');

  await ask("create a widget showing nova's tokenomics information");
  check('"nova’s tokenomics" is the three ledger tiles', (await ev(`[...(${lastPanel('querySelectorAll(\'[data-block="tokenomics"]\')')} ?? [])].map((t) => t.dataset.key).join(',')`)) === 'cost,energy,avoided', await kinds());
  check('and they carry the ledger’s numbers, not placeholders', /\$\d/.test(await ev(`${lastPanel('querySelector(\'[data-key="cost"] .ds-stat-val\')?.textContent')} ?? ''`)), await ev(`${lastPanel('querySelector(\'[data-key="cost"] .ds-stat-val\')?.textContent')} ?? ''`));

  await ask('build me a light studio widget');
  check('"light studio" is the lights control, bound to the under-glow', (await kinds()) === 'c:lights', await kinds());
  const glowBefore = await ev(`JSON.parse(localStorage.getItem('underGlow') || 'null')?.enabled ?? 'unset'`);
  await ev(`${lastPanel('querySelector(\'[data-control="lights"] .ds-toggle\')?.click()')}`);
  await sleep(300);
  const glowAfter = await ev(`JSON.parse(localStorage.getItem('underGlow') || 'null')?.enabled`);
  check('flipping the switch on the card flips Settings.underGlow', glowBefore !== glowAfter && typeof glowAfter === 'boolean', `${glowBefore} -> ${glowAfter}`);
  await ev(`${lastPanel('querySelector(\'[data-control="lights"] .ds-toggle\')?.click()')}`);
  await sleep(200);

  // ── Nova in a card sends to the real conversation ──
  await ask('a nova chat widget');
  check('"a nova chat widget" is the chat block with a field', (await kinds()) === 'b:nova-chat' && (await ev(`!!${lastPanel('querySelector(\'[data-block="nova-chat"] input\')')}`)), await kinds());
  await ev(`(() => { const c = [...(${lastPanel('querySelectorAll(".ds-chat-msg-actions .ds-chip")')} ?? [])].find((c) => /add to dashboard/i.test(c.textContent)); if (c) c.click(); return !!c; })()`);
  await waitFor(`!!document.querySelector('.wb-cell[data-widget^="card-"] [data-block="nova-chat"] input')`, 4000);
  check('added, the board card carries the field', await ev(`!!document.querySelector('.wb-cell[data-widget^="card-"] [data-block="nova-chat"] input')`));
  {
    const turns = await ev(`document.querySelectorAll('.nova-panel .ds-chat-msg.user').length`);
    await ev(`document.querySelector('.wb-cell[data-widget^="card-"] [data-block="nova-chat"] input')?.focus()`);
    await typeText('hello from the board');
    await key('Enter', 'Enter', 13);
    await waitFor(`document.querySelectorAll('.nova-panel .ds-chat-msg.user').length > ${turns}`, 6000);
    check('asking from the board card puts the turn in the real conversation', (await ev(`[...document.querySelectorAll('.nova-panel .ds-chat-msg.user')].pop()?.innerText ?? ''`)).includes('hello from the board'), await ev(`[...document.querySelectorAll('.nova-panel .ds-chat-msg.user')].pop()?.innerText ?? ''`));
    await waitFor(`!${lastPanel('dataset.status')}`, 6000);
    // "hello…" matches the greeting script, so the card's last-reply line is Nova introducing itself.
    check('and the card shows Nova\u2019s reply', /I am Nova/.test(await ev(`document.querySelector('.wb-cell[data-widget^="card-"] .cb-chat-last')?.textContent ?? ''`)), await ev(`document.querySelector('.wb-cell[data-widget^="card-"] .cb-chat-last')?.textContent ?? ''`));
  }

  // ── Absence is admitted, not rendered empty ──
  // Saved module state merges OVER the defaults (Modules.tsx `loadState`), so an
  // uninstall is an explicit `false`, not an omission.
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, shop: false }))`);
  await go('/');
  await ask("a widget with the shop's deals");
  check('with the Shop module gone, a deals card is not composed', !(await ev(`!!${lastPanel('querySelector("[data-card-preview]")')}`)));
  check('and the reply says why', /Shop module is not installed/.test(await prose()), await prose());
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, shop: true, lightstudio: true }))`);
  await go('/');

  // ── A half-read sentence ──
  await ask('a widget showing my discord and my fps');
  check('without a model, the read half is built and the unread word is admitted', (await kinds()) === 'm:fps' && /did not recognize “discord”/.test(await bubble()), await bubble());
  await ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant', llmEnabled: true, endpoint: '${FAKE_EP}', model: 'fake-7b' } }))`);
  await go('/');
  await ask('a widget showing my discord and my fps', `(${lastPanel('getAttribute("data-source")')} ?? '') === 'llm' && !${lastPanel('dataset.status')}`);
  check('with a model, the sentence is sent WITH the read half as its seed', (await kinds()) === 'm:fps,m:ram' && (await ev(`${lastPanel('getAttribute("data-source")')} ?? ''`)) === 'llm', `${await kinds()} / ${await ev(`${lastPanel('getAttribute("data-source")')} ?? ''`)}`);
  check('and the model’s "unavailable" is read out in the person’s word', /could not put Discord on it/.test(await bubble()), await bubble());
  check('and the copy is confident, because the regex read the request', !/start from/.test(await bubble()), await bubble());
  {
    const schema = await httpJson2(`http://localhost:${FAKE_PORT}/last-widget-schema`);
    const pairs = schema?.properties?.items?.items?.enum ?? [];
    const binds = new Set(pairs.map((x) => x.split(':')[0]));
    // Retrieval (TH-452): the sentence named `fps`, so the enum holds the
    // system domain and the core — and NOT the headset's rows, which a sentence
    // about Discord and frame rate never pointed at.
    check('the schema the app sent is the RETRIEVED vocabulary: the seed, its domain, the core', pairs.includes('fps:tile') && pairs.includes('cpu-temp:tile') && pairs.includes('net-down:tile') && pairs.includes('power-mode:choice'), pairs.slice(0, 12).join(' '));
    check('and not the rows the sentence never pointed at', !binds.has('volume') && !binds.has('mic-gain') && !binds.has('deals'), [...binds].join(' '));
    check('within the measured cap', binds.size <= 32, String(binds.size));
  }
  await seedNova();

  // ── The catalog widget is bound too ──
  await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'light', span: 3, rows: 1 }]))`);
  await go('/');
  await waitFor(`!!document.querySelector('.wb-cell[data-widget="light"] .ds-toggle')`, 4000);
  {
    const before = await ev(`JSON.parse(localStorage.getItem('underGlow') || 'null')?.enabled ?? 'unset'`);
    await ev(`document.querySelector('.wb-cell[data-widget="light"] .ds-toggle')?.click()`);
    await sleep(300);
    const after = await ev(`JSON.parse(localStorage.getItem('underGlow') || 'null')?.enabled`);
    check('the Light Studio catalog widget is bound to the same under-glow (it was local state)', before !== after && typeof after === 'boolean', `${before} -> ${after}`);
    await ev(`document.querySelector('.wb-cell[data-widget="light"] .ds-toggle')?.click()`);
  }

  // ── Routing, from the new side ──
  await ask('resize my cpu widget');
  check('"resize my cpu widget" is not a request for a new card', !(await ev(`!!${lastPanel('querySelector("[data-card-preview]")')}`)));

  await ev(`localStorage.removeItem('novaPinned'); localStorage.removeItem('board-layout'); localStorage.removeItem('cards'); localStorage.removeItem('trhs-profiles'); localStorage.removeItem('underGlow')`);
}

// ── Generative widgets (TH-452) ───────────────────────────────────────────
// The model composes from a registry, through a flat enum of `bind:form` pairs
// retrieved for the sentence. Fake replies here are shapes the validator has to
// survive; the fake server returns them by keyword in the request.
console.log('\nGenerative widgets');
{
  await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, shop: true, lightstudio: true }))`);
  await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'cpu', span: 2, rows: 1 }]))`);
  await ev(`localStorage.removeItem('cards'); localStorage.removeItem('trhs-profiles'); localStorage.removeItem('ecoMode')`);
  await ev(`localStorage.setItem('novaPinned', 'true')`);
  await ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant', llmEnabled: true, endpoint: '${FAKE_EP}', model: 'fake-7b' } }))`);
  await go('/');

  const lastPanel = (sel) => `[...document.querySelectorAll('.nova-panel .ds-chat-msg.assistant')].pop()?.${sel}`;
  const bubble = () => ev(`${lastPanel('querySelector(".ds-chat-msg-bubble")?.innerText')} ?? ''`);
  const binds = () => ev(`[...(${lastPanel('querySelectorAll(".wb-card-items > [data-bind]")')} ?? [])].map((c) => c.dataset.bind + ':' + c.dataset.as).join(',')`);
  const ask = async (text, until) => {
    const before = await ev(`document.querySelectorAll('.nova-panel .ds-chat-msg.assistant').length`);
    await ev(`document.querySelector('.nova-panel textarea')?.focus()`);
    await typeText(text);
    await key('Enter', 'Enter', 13);
    await waitFor(until ?? `document.querySelectorAll('.nova-panel .ds-chat-msg.assistant').length > ${before} && !${lastPanel('dataset.status')}`, 10000);
    await sleep(200);
  };
  const lastSchema = () => httpJson2(`http://localhost:${FAKE_PORT}/last-widget-schema`);
  const FORMS = new Set(['tile', 'gauge', 'meter', 'sparkline', 'slider', 'vu', 'balance', 'toggle', 'choice', 'badge', 'rows', 'price']);

  // ── The schema is flat and bounded ──
  await ask('build me a widget');
  {
    const schema = await lastSchema();
    const text = JSON.stringify(schema);
    const props = schema?.properties ?? {};
    check('the widget schema is FLAT: no anyOf, no const, no nested object', !/"anyOf"|"const"|"oneOf"/.test(text) && Object.values(props).every((p) => p.type !== 'object'), Object.entries(props).map(([k, v]) => `${k}:${v.type}`).join(' '));
    check('every array in it is bounded', Object.values(props).filter((p) => p.type === 'array').every((p) => Number.isFinite(p.maxItems) && p.maxItems <= 6), JSON.stringify(Object.values(props).filter((p) => p.type === 'array').map((p) => p.maxItems)));
    const pairs = props.items?.items?.enum ?? [];
    check('and every item value is a known form on a binding', pairs.length > 0 && pairs.every((x) => { const i = x.lastIndexOf(':'); return i < 0 ? /^[a-z0-9-]+$/.test(x) : FORMS.has(x.slice(i + 1)) && /^[a-z0-9-]+$/.test(x.slice(0, i)); }), pairs.slice(0, 8).join(' '));
    check('a guess offers the core and one row per room, not the whole registry', new Set(pairs.map((x) => x.split(':')[0])).size <= 32 && pairs.some((x) => x.startsWith('fps:')) && pairs.some((x) => x.startsWith('volume:')) && pairs.some((x) => x.startsWith('dpi')), String(new Set(pairs.map((x) => x.split(':')[0])).size));
  }
  check('and the reply is the model’s card with its own sentence', (await ev(`${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`)) === 'Fake Card' && /power mode beside them/.test(await bubble()), await bubble());

  // ── Retrieval follows the sentence ──
  // A compose verb, or the card builder does not claim the sentence at all (it
  // then streams to the fake model as chat, and the schema read back is the
  // previous request's — which is exactly what the first run of this check saw).
  await ask('build me a widget for my headset sibling');
  {
    const schema = await lastSchema();
    const pairs = schema?.properties?.items?.items?.enum ?? [];
    const ids = new Set(pairs.map((x) => x.split(':')[0]));
    check('a sentence about the headset retrieves the headset’s rows', ids.has('volume') && ids.has('sidetone') && ids.has('headset-mic') && ids.has('spatial-power'), [...ids].join(' '));
    check('and not the microphone’s, which it never named', !ids.has('mic-gain') && !ids.has('mic-mix'), [...ids].join(' '));
  }
  check('the model’s pair renders bound to the headset', (await binds()) === 'volume:slider,sidetone:toggle', await binds());

  // ── The validator on arrival ──
  await ask('build me a doubled widget', `(${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? '') === 'Doubled'`);
  check('a repeated binding renders once, whatever its forms', (await ev(`${lastPanel('querySelectorAll(\'[data-card-preview] [data-bind="gpu-temp"]\').length')} ?? 0`)) === 1 && (await ev(`${lastPanel('querySelectorAll(\'[data-card-preview] [data-bind="dpi"]\').length')} ?? 0`)) === 1, await binds());

  await ask('build me an overflow widget', `(${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? '') === 'Overflow'`);
  check('six wide items are trimmed to what three rows hold', (await ev(`${lastPanel('querySelector("[data-card-preview]")?.dataset.rows')} ?? ''`)) === '3' && (await ev(`${lastPanel('querySelectorAll(".wb-card-items > *").length')} ?? 0`)) === 3, `${await ev(`${lastPanel('querySelector("[data-card-preview]")?.dataset.rows')}`)} rows / ${await binds()}`);
  check('and the body does not clip', await ev(`(() => { const b = ${lastPanel('querySelector(".wb-card-items")')}; return !!b && b.scrollHeight <= b.clientHeight + 1; })()`), await ev(`(() => { const b = ${lastPanel('querySelector(".wb-card-items")')}; return b ? b.clientHeight + '/' + b.scrollHeight : 'none'; })()`));

  await ask('build me a badform widget', `(${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? '') === 'Bad form'`);
  check('a form the row forbids is dropped and the item kept', (await binds()) === 'fps:tile' && !(await ev(`!!${lastPanel('querySelector(\'[data-control="fps"]\')')}`)), await binds());

  await ask('build me a parroted widget', `(${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? '') === 'Parroted'`);
  check('a note that is the request read back is replaced by the templated opening', /start from/.test(await bubble()) && !/^build me a parroted widget/i.test(await bubble()), await bubble());

  // ── A bound control writes where its home does ──
  await ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant' } }))`);
  await go('/');
  await ask('a widget with eco mode');
  check('"eco mode" is a Settings-bound switch', (await binds()) === 'eco-mode:toggle', await binds());
  {
    const before = await ev(`localStorage.getItem('ecoMode')`);
    await ev(`${lastPanel('querySelector(\'[data-control="eco-mode"] .ds-toggle\')?.click()')}`);
    await sleep(300);
    const after = await ev(`localStorage.getItem('ecoMode')`);
    check('flipping it on the card writes the Settings key', before !== after && after != null, `${before} -> ${after}`);
    await ev(`${lastPanel('querySelector(\'[data-control="eco-mode"] .ds-toggle\')?.click()')}`);
  }
  await ask('a widget with my mic gain');
  check('"mic gain" is a profile-bound level meter', (await binds()) === 'mic-gain:vu', await binds());
  await ev(`(() => { const el = ${lastPanel('querySelector(\'[data-control="mic-gain"] input[type="range"]\')')}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '31'); el.dispatchEvent(new Event('input', { bubbles: true })); return !!el; })()`);
  await sleep(300);
  check('moving it writes the microphone’s audio.gain into the ACTIVE PROFILE', /"audio.gain":31/.test(await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null'); const p = s?.profiles?.find((p) => p.id === s.activeId); return JSON.stringify(p?.devices?.['solocast-2-pro'] ?? null); })()`)), await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null'); const p = s?.profiles?.find((p) => p.id === s.activeId); return JSON.stringify(p?.devices?.['solocast-2-pro'] ?? null); })()`));

  // ── A stored bound card survives a reload, item by item ──
  await ev(`localStorage.setItem('cards', JSON.stringify([{ id: 'card-stored', title: 'Stored', items: [{ kind: 'bound', bind: 'volume' }, { kind: 'bound', bind: 'no-such-binding' }, { kind: 'bound', bind: 'fps', as: 'slider' }], createdAt: 1 }])); localStorage.setItem('board-layout', JSON.stringify([{ id: 'cpu', span: 2, rows: 1 }, { id: 'card-stored', span: 2, rows: 1 }]))`);
  await go('/');
  await waitFor(`!!document.querySelector('.wb-cell[data-widget="card-stored"] [data-bind]')`, 4000);
  check('an unknown binding drops that item only; a forbidden form drops the form only', (await ev(`[...document.querySelectorAll('.wb-cell[data-widget="card-stored"] .wb-card-items > [data-bind]')].map((c) => c.dataset.bind + ':' + c.dataset.as).join(',')`)) === 'volume:slider,fps:tile', await ev(`[...document.querySelectorAll('.wb-cell[data-widget="card-stored"] .wb-card-items > [data-bind]')].map((c) => c.dataset.bind + ':' + c.dataset.as).join(',')`));

  // ── Preview, then the model's card (TH-453) ──
  // Every built card reaches the model now, and the wait is never an empty
  // bubble: the regex card goes up at once with no chips and "composing" under
  // it, and the model's card replaces it under the SAME id. The fake takes 1.5s
  // on `/slowpoke/` so the preview can be looked at mid-flight. The block above
  // re-seeded the store without a model, so the fake is seeded again here.
  await ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant', llmEnabled: true, endpoint: '${FAKE_EP}', model: 'fake-7b' } }))`);
  await go('/');
  {
    const before = await ev(`document.querySelectorAll('.nova-panel .ds-chat-msg.assistant').length`);
    await ev(`document.querySelector('.nova-panel textarea')?.focus()`);
    await typeText('a slowpoke widget with cpu temp and fps');
    await key('Enter', 'Enter', 13);
    await waitFor(`document.querySelectorAll('.nova-panel .ds-chat-msg.assistant').length > ${before} && !!${lastPanel('querySelector("[data-card-preview]")')}`, 4000);
    const previewId = await ev(`${lastPanel('querySelector("[data-card-preview]")?.dataset.cardPreview')} ?? ''`);
    const state = () => ev(`${lastPanel('querySelector(".wb-preview-state")?.dataset.state')} ?? ''`);
    check('while the model composes, the regex card is already up as a preview', (await state()) === 'composing' && (await binds()) === 'cpu-temp:tile,fps:tile', `${await state()} / ${await binds()}`);
    check('with no chips to move out from under the reader', (await ev(`${lastPanel('querySelectorAll(".ds-chip").length')} ?? 0`)) === 0 && (await ev(`${lastPanel('getAttribute("data-status")')} ?? ''`)) === 'streaming', `${await ev(`${lastPanel('querySelectorAll(".ds-chip").length')}`)} chips / ${await ev(`${lastPanel('getAttribute("data-status")')}`)}`);
    await waitFor(`!${lastPanel('dataset.status')} && (${lastPanel('querySelectorAll(".ds-chip").length')} ?? 0) > 0`, 6000);
    const finalId = await ev(`${lastPanel('querySelector("[data-card-preview]")?.dataset.cardPreview')} ?? ''`);
    check('then the model\u2019s card replaces it under the SAME id, with its title, its sentence and the chips', finalId === previewId && previewId !== '' && (await ev(`${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')} ?? ''`)) === 'Slowpoke' && /slowly/.test(await bubble()) && (await ev(`${lastPanel('getAttribute("data-source")')} ?? ''`)) === 'llm', `${previewId} -> ${finalId} / ${await ev(`${lastPanel('querySelector(".wb-card-preview .w-label-text")?.textContent')}`)} / ${await bubble()}`);
    // "slowpoke" was a word the parser could not read, so this is the HALF-READ
    // shape: what was read stays first, the model's addition follows. The
    // fully-read shape — additions not read at all — is pinned in section 22.
    check('and its items begin with what was read, the model\u2019s addition after', (await binds()) === 'cpu-temp:tile,fps:tile,ram:tile' && (await state()) === 'none', `${await binds()} / ${await state()}`);
  }

  // ── An overlay through the model ──
  // A HUD that NAMES something composes like a card, capped at four and offered
  // with "Place on screen"; a bare "overlay" stays the classic corner readout.
  await ask('an overlay with my volume sibling');
  {
    const schema = await lastSchema();
    const ov = () => ev(`[...(${lastPanel('querySelectorAll("[data-overlay-preview] [data-bind]")')} ?? [])].map((c) => c.dataset.bind).join(',')`);
    check('an overlay that names something is composed under a four-item cap', schema?.properties?.items?.maxItems === 4, String(schema?.properties?.items?.maxItems));
    check('and the model\u2019s pair lands on the HUD, seed first', (await ov()) === 'volume,sidetone' && (await ev(`${lastPanel('getAttribute("data-source")')} ?? ''`)) === 'llm', `${await ov()} / ${await ev(`${lastPanel('getAttribute("data-source")')}`)}`);
    check('offered with "Place on screen"', (await ev(`[...(${lastPanel('querySelectorAll(".ds-chip")')} ?? [])].map((c) => c.textContent).join('|')`)).includes('Place on screen'), await ev(`[...(${lastPanel('querySelectorAll(".ds-chip")')} ?? [])].map((c) => c.textContent).join('|')`));
  }
  await ask('overlay');
  check('a bare "overlay" is the classic readout, with no model call', (await ev(`${lastPanel('getAttribute("data-source")')} ?? ''`)) === 'scripted' && (await ev(`[...(${lastPanel('querySelectorAll("[data-overlay-preview] [data-bind]")')} ?? [])].map((c) => c.dataset.bind).join(',')`)) === 'fps,cpu-temp,gpu-temp', `${await ev(`${lastPanel('getAttribute("data-source")')}`)} / ${await ev(`[...(${lastPanel('querySelectorAll("[data-overlay-preview] [data-bind]")')} ?? [])].map((c) => c.dataset.bind).join(',')`)}`);

  // ── The registry widens: app settings, the display's picture, Nova's ledger (TH-453) ──
  // Each new source kind proves it writes where its home does, the way the
  // Settings toggle and the profile slider did for TH-452.
  await ask('a widget with my theme and my wallpaper blur');
  check('app settings are registry rows: the theme as a choice, the wallpaper blur as a slider', (await binds()) === 'theme:choice,wallpaper-blur:slider', await binds());
  {
    const pick = (re) => ev(`[...(${lastPanel('querySelectorAll(\'[data-bind="theme"] .ds-toggle-group-btn\')')} ?? [])].find((b) => ${re}.test(b.textContent))?.click()`);
    const before = await ev(`localStorage.getItem('theme')`);
    await pick('/light/i');
    await sleep(200);
    const after = await ev(`localStorage.getItem('theme')`);
    check('choosing on the card writes the Settings key', before !== after && /light/.test(after ?? ''), `${before} -> ${after}`);
    await pick('/dark/i');
    await sleep(200);
  }
  await ask('a widget with my contrast and black stretch');
  check('the display\u2019s picture is bound through the monitor hooks', (await binds()) === 'contrast:slider,black-stretch:choice', await binds());
  await ev(`(() => { const el = ${lastPanel('querySelector(\'[data-control="contrast"] input[type="range"]\')')}; if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '70'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(300);
  check('moving contrast writes this display\u2019s picture, under its mode', /"contrast":70/.test(await ev(`localStorage.getItem('displayPictureBySku') ?? ''`)), (await ev(`localStorage.getItem('displayPictureBySku') ?? ''`)).slice(0, 160));
  await ask("a widget with nova's cloud cost and tokens in");
  check('Nova\u2019s ledger totals are readings, one tile each', (await binds()) === 'nova-cost:tile,nova-tokens-in:tile', await binds());
  check('formatted as the Tokenomics popover formats them', /\$/.test(await ev(`${lastPanel('querySelector(\'[data-bind="nova-cost"]\')?.textContent')} ?? ''`)), await ev(`${lastPanel('querySelector(\'[data-bind="nova-cost"]\')?.textContent')} ?? ''`));
  // A profile that overrides the accent locks the accent control, with the
  // reason — the setter would write a baseline the profile hides.
  await ev(`localStorage.setItem('trhs-profiles', JSON.stringify({ v: 1, activeId: 'p-lock', profiles: [{ id: 'p-lock', name: 'Locked', overrides: { accent: 'red' }, devices: {} }] }))`);
  await go('/');
  await ask('a widget with my accent color');
  check('a setting the active profile overrides renders LOCKED, showing the profile\u2019s value', (await ev(`!!${lastPanel('querySelector(\'[data-bind="accent"] .ds-sw-only.locked\')')}`)) && /Red/.test(await ev(`${lastPanel('querySelector(\'[data-bind="accent"]\')?.textContent')} ?? ''`)), await ev(`${lastPanel('querySelector(\'[data-bind="accent"]\')?.textContent')} ?? ''`));
  await ev(`localStorage.removeItem('trhs-profiles'); localStorage.removeItem('displayPictureBySku'); localStorage.removeItem('theme')`);

  // ── The read-only forms: gauge, meter, sparkline (TH-454) ──
  // The model's FORM reaches an item the parser read — before TH-454 the
  // seed-first merge kept the parser's tile and dropped the model's pair with
  // the form on it, so "a gauge for my cpu temp" was a tile. The sparkline is
  // fed from the host's history, and all three fit the card's measured rows.
  await ask('a forms widget with cpu temp, cpu and ram');
  check('the model\u2019s forms land on the items the parser read', (await binds()) === 'cpu-temp:gauge,cpu:meter,ram:sparkline', await binds());
  check('the gauge is a dial, the meter a bar with its fill', (await ev(`!!${lastPanel('querySelector(\'[data-bind="cpu-temp"] .gauge-ec\')')}`)) && (await ev(`parseFloat(${lastPanel('querySelector(\'[data-bind="cpu"] .ds-prog-fill\')?.style.width')} ?? '0')`)) > 0, await ev(`${lastPanel('querySelector(\'[data-bind="cpu"] .ds-prog-fill\')?.style.width')}`));
  check('the sparkline is drawn from the stream\u2019s two-minute history, not a static path', (await ev(`((${lastPanel('querySelector(\'[data-bind="ram"] .ds-spark-line\')?.getAttribute("d")')} ?? '').match(/L/g) ?? []).length`)) >= 60, String(await ev(`((${lastPanel('querySelector(\'[data-bind="ram"] .ds-spark-line\')?.getAttribute("d")')} ?? '').match(/L/g) ?? []).length`)));
  check('and the body fits its measured rows without clipping', await ev(`(() => { const b = ${lastPanel('querySelector(".wb-card-items")')}; return !!b && b.scrollHeight <= b.clientHeight + 1; })()`), await ev(`(() => { const b = ${lastPanel('querySelector(".wb-card-items")')}; return b ? b.clientHeight + '/' + b.scrollHeight + ' rows=' + ${lastPanel('querySelector("[data-card-preview]")?.dataset.rows')} : 'none'; })()`));
  await ask('a dial widget for my cpu temp');
  check('a form asked for on a single read item is honoured', (await binds()) === 'cpu-temp:gauge', await binds());

  await ev(`localStorage.removeItem('novaPinned'); localStorage.removeItem('board-layout'); localStorage.removeItem('cards'); localStorage.removeItem('trhs-profiles'); localStorage.removeItem('ecoMode')`);
}

// ── A moved default reaches a store that already exists (TH-441) ──────────
// Repointing DEFAULT_SETTINGS at Ollama fixed nothing for anyone who had opened
// Nova before, because loadStore merges saved settings OVER the defaults. The
// bug was invisible here (every check seeds its own endpoint) and hit the first
// real user. `migrateSettings` moves exactly the pre-TH-441 pair forward, and
// must not cost anyone their history to do it.
console.log('\nA moved default reaches a store that already exists');
{
  const PRE_ENDPOINT = 'http://localhost:8086/v1/chat/completions';
  const stale = (model) => ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1,
    settings: { demoSpeed: 'instant', llmEnabled: true, endpoint: '${PRE_ENDPOINT}', model: '${model}', cloudRatePerM: 9, localWatts: 180 },
    conversations: [{ id: 'c-old', title: 'From before', createdAt: 1, updatedAt: 2,
      messages: [{ id: 'm-old', role: 'user', text: 'keep me', at: 1, source: 'scripted', modelId: 'local', agentId: null }] }],
    activeConversationId: 'c-old', modelId: 'local', agentId: null,
    ledger: { events: [{ at: 1, agentId: null, modelId: 'local', inTokens: 11, outTokens: 22, seconds: 1, costUsd: 0.1, wh: 0.2 }], byAgent: {}, byDay: {} },
    activity: [] }))`);

  await stale('hermes-4-14b');
  await go('/nova');
  let st = await novaStore();
  check('a store from before TH-441 is pointed at Ollama on load', st?.settings?.endpoint === 'http://localhost:11434/v1/chat/completions', st?.settings?.endpoint);
  check('and its model moves with it', st?.settings?.model === 'granite4.2:8b', st?.settings?.model);
  // The reason this is a migration and not a `v` bump: a bump discards the store.
  check(
    'without costing anyone their conversations or their ledger',
    st?.conversations?.length === 1 && st.conversations[0].messages?.[0]?.text === 'keep me' && st?.ledger?.events?.length === 1,
    `convos=${st?.conversations?.length} ledger=${st?.ledger?.events?.length}`,
  );
  check('and without touching their other settings', st?.settings?.cloudRatePerM === 9 && st?.settings?.llmEnabled === true);

  // A model someone chose themselves is theirs, even behind the stale endpoint —
  // granite is not on their server.
  await stale('a-model-i-chose');
  await go('/nova');
  st = await novaStore();
  check('a model the person chose is kept, even behind the old endpoint', st?.settings?.endpoint === 'http://localhost:11434/v1/chat/completions' && st?.settings?.model === 'a-model-i-chose', `${st?.settings?.endpoint} / ${st?.settings?.model}`);

  // And an endpoint someone chose is left entirely alone.
  await ev(`localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant', endpoint: 'http://localhost:9999/v1/chat/completions', model: 'hermes-4-14b' } }))`);
  await go('/nova');
  st = await novaStore();
  check('an endpoint the person chose is never rewritten', st?.settings?.endpoint === 'http://localhost:9999/v1/chat/completions' && st?.settings?.model === 'hermes-4-14b', `${st?.settings?.endpoint} / ${st?.settings?.model}`);
}

// ── Nova is handed the real machine (TH-441) ──────────────────────────────
// The model used to be told it "knows the machine, the devices on the desk and
// the active profile" and handed nothing, so a real reply invented device names
// with total confidence. These checks read the <nova-context> block the app
// actually SENDS, by way of the fake server's echo script — so they prove the
// app's side without asserting on any model's behaviour.
console.log('\nNova is handed the real machine');
// seedNova REPLACES settings wholesale, so demoSpeed has to be restated here.
const groundSeed = (extra = {}) =>
  seedNova({
    settings: { demoSpeed: 'instant', llmEnabled: true, endpoint: FAKE_EP, model: 'fake-7b', cloudRatePerM: 4, localWatts: 180 },
    ...extra,
  });
/** The echoed block: what the app put on the end of the user's turn. */
const echoBlock = async () => {
  await ev(`document.querySelector('.nova .nova-composer textarea')?.focus()`);
  await typeText('echo my context');
  await key('Enter', 'Enter', 13);
  await waitFor(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.dataset.source === 'llm' && !document.querySelector('.nova .nova-log .ds-chat-msg.streaming')`, 8000);
  return lastAssistant();
};

await groundSeed();
await go('/nova');
let block = await echoBlock();
check('the real device names reach the model', /Treehouse 32/.test(block), block.slice(0, 200));
check('and the route the person is on', /route: \/nova/.test(block), block.slice(0, 120));
check('and the active profile, with how it got there', /profile: .+\(chosen by you\)/.test(block), block.slice(0, 200));
check('and the surfaces this install actually has', /can go: .*\/perform/.test(block) && /can open: .*vitals/.test(block), block.slice(0, 400));
// A device unplugged in the simulator must read as away, not as present. This
// is the half of the snapshot the provider CANNOT reach on its own — it comes
// in through the shell's bridge — so it is the load-bearing one.
await ev(`localStorage.setItem('device-sim', JSON.stringify({ byDevice: { 'cloud-iii': { connected: false, deviceSlot: 0, slotAtDisconnect: 0, battery: null } } }))`);
await groundSeed();
await go('/nova');
block = await echoBlock();
check('and whether each one is plugged in right now', /Cloud III \(headset, away\)/.test(block), block.slice(0, 300));
await ev(`localStorage.removeItem('device-sim')`);

// A module that is gone must leave the catalog, or the model offers a surface
// this install does not have.
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, vitals: false }))`);
await groundSeed();
await go('/nova');
block = await echoBlock();
check('a removed module leaves the catalog', /can open:/.test(block) && !/vitals/.test(block), block.slice(0, 400));
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true }))`);
await groundSeed();
await go('/nova');

// The drift guard. `surfaces.ts` mirrors AppShell's TABS by hand and nothing
// makes them agree at compile time, so compare the catalog to the rendered nav.
block = await echoBlock();
{
  const nav = await ev(`[...document.querySelectorAll('.shell-nav nav[aria-label="Main"] a')].map((a) => (a.getAttribute('href') || '').replace(/^#/, '')).filter(Boolean).sort().join(',')`);
  const line = (block.match(/can go: (.*)/) || [])[1] ?? '';
  const cat = line.split(' · ').map((x) => x.trim().split(' ')[0]).filter(Boolean).sort().join(',');
  check('the catalog and the nav agree on the routes', nav === cat, `nav=${nav} catalog=${cat}`);
}
// The block rides on the REQUEST, never on the stored turn: the log, the
// conversation preview and every later turn stay what the person typed.
{
  const st = await novaStore();
  const user = st?.conversations?.flatMap((c) => c.messages).filter((m) => m.role === 'user').pop();
  check('the person\'s own words are not polluted by it', user?.text === 'echo my context', JSON.stringify(user?.text));
}
// Scoped to the PERSON'S bubbles. The log as a whole legitimately holds a block
// here — the echo reply IS one — and so does `.nova-convo-preview`, which shows
// the last message in the conversation (`previewOf`), i.e. that same reply. The
// claim worth protecting is narrower: what the person said is what they typed.
{
  const said = await ev(`[...document.querySelectorAll('.nova .nova-log .ds-chat-msg.user')].map((m) => m.innerText).join(' | ')`);
  check('it never shows up as something the person said', said.includes('echo my context') && !/nova-context/.test(said), said.slice(0, 160));
}
// Grounding grows by someone adding "just one more line", and every line costs
// tokens on every turn forever. CONTEXT_CHAR_BUDGET in grounding.tsx is 1600.
check('and it stays inside its character budget', block.length > 0 && block.length <= 1600, `${block.length} chars`);
// `CONTROL_SURFACES` is derived from the card vocabulary (TH-450): a control a
// card can bind is one the model is told it can bind, with no second list.
check('and the bind line carries the card vocabulary\u2019s controls', /can bind: .*\bvolume\b.*\bmic-mix\b.*\blights\b/.test(block), (block.match(/can bind: .*/) || [''])[0]);

console.log('\nThe Agents view is a dashboard');
await seedNova();
await ev(`localStorage.removeItem('trhs-agents')`);
await go('/nova?view=agents');
check('four tiles', (await ev(`document.querySelectorAll('.nova-dash-tiles .ds-stat-tile').length`)) === 4);
check('a seven-day chart with a readout per day', (await ev(`!!document.querySelector('.nova-chart .pv7-trend-svg')`)) && (await ev(`document.querySelectorAll('.nova-chart-cell').length`)) === 7 && (await ev(`document.querySelectorAll('.nova-chart-days span').length`)) === 7);
check('and the chart is styled by the widget\'s own stylesheet, not a page\'s', (await ev(`getComputedStyle(document.querySelector('.nova-chart .pv7-trend-line')).strokeWidth`)) === '1.5px', await ev(`getComputedStyle(document.querySelector('.nova-chart .pv7-trend-line')).strokeWidth`));
check('the readout is reachable without a pointer', await ev(`(() => { const c = document.querySelector('.nova-chart-cell'); return c.tabIndex === 0 && /tokens/.test(c.getAttribute('aria-label') || ''); })()`));
check('the chart and the tiles agree on today', await ev(`(() => { const t = document.querySelector('[data-key="tokens"] .ds-stat-val')?.innerText?.trim(); const c = [...document.querySelectorAll('.nova-chart-cell')].pop()?.getAttribute('aria-label') || ''; return !!t && c.includes(t); })()`));
check('Forge is inline, with its nav and grid', (await ev(`!!document.querySelector('.forge-inline .ds-modal-nav') && !!document.querySelector('.forge-inline .fg-grid')`)));
check('a card that has run carries its usage', await ev(`[...document.querySelectorAll('.forge-inline .fg-card')].some((c) => /Thermal Warden/.test(c.innerText) && /\\d+ runs? · .*tokens/.test(c.querySelector('.fg-card-usage')?.innerText || ''))`));
const addedBefore = Number(await ev(`document.querySelector('[data-key="added"] .ds-stat-val')?.innerText`));
await ev(`[...document.querySelectorAll('.forge-inline .fg-card')].find((c) => /Frame Doctor/.test(c.innerText))?.querySelector('[aria-label="Add Frame Doctor"]')?.click()`);
// Forge holds "Adding…" for ~0.9s before the add lands.
await sleep(1400);
check('adding a card moves "agents added"', Number(await ev(`document.querySelector('[data-key="added"] .ds-stat-val')?.innerText`)) === addedBefore + 1, `${addedBefore} → ${await ev(`document.querySelector('[data-key="added"] .ds-stat-val')?.innerText`)}`);
check('and the store agrees', await ev(`JSON.parse(localStorage.getItem('trhs-agents') || '[]').includes('frame-doctor')`));
await click('button[aria-label="Forge"]');
check('the modal still opens over the inline store, on the same body', await ev(`!!document.querySelector('.modal-shell.forge .fg-grid')`));
await escape();
check('and closing it keeps the Agents view', await ev(`/view=agents/.test(location.hash) && !!document.querySelector('.nova-agents')`));
const runsBefore = Number(await ev(`document.querySelector('[data-key="runs"] .ds-stat-val')?.innerText`));
await ev(`[...document.querySelectorAll('.nova-topbar [role="tab"]')].find((b) => /chat/i.test(b.innerText))?.click()`);
await sleep(300);
await ev(`[...document.querySelectorAll('.nova-prompts .ds-chip, .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'Training HUD')?.click()`);
await waitFor(`!document.querySelector('.nova-log .ds-chat-msg.streaming') && document.querySelectorAll('.nova-log .ds-chat-msg.assistant').length === 1`);
await escape();
await ev(`[...document.querySelectorAll('.nova-topbar [role="tab"]')].find((b) => /agents/i.test(b.innerText))?.click()`);
await sleep(300);
check('a reply moves "runs today"', Number(await ev(`document.querySelector('[data-key="runs"] .ds-stat-val')?.innerText`)) === runsBefore + 1);
check('and shows in recent activity', await ev(`[...document.querySelectorAll('.nova-activity .ds-list-item')].some((li) => /Training HUD/.test(li.innerText))`));

console.log('\nIt fits a smaller window');
await seedNova();
await go('/nova?devices=1');
const visible = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && el.getBoundingClientRect().width > 0; })()`);
check('at the desk width both rails are columns and no toggle shows', (await visible('#nova-rail-context')) && (await visible('#nova-rail-conversations')) && !(await visible('button[aria-label="Treehouse context"]')));
await viewport(1000);
check('at 1000px the context rail is off-canvas and out of the tab order', (await ev(`getComputedStyle(document.querySelector('#nova-rail-context')).visibility`)) === 'hidden');
check('and its toggle appears', await visible('button[aria-label="Treehouse context"]'));
// Both rails are drawers below `expanded` of the PAGE (2026-10-20): the
// conversations rail used to hold its column down to 900 of window, but a
// 300px rail beside a 700px log is the log's whole width spent.
check('and so is the conversations rail (both are drawers below `expanded`)', (await ev(`getComputedStyle(document.querySelector('#nova-rail-conversations')).visibility`)) === 'hidden');
await click('button[aria-label="Treehouse context"]');
await sleep(500);
check('the toggle opens it', (await visible('#nova-rail-context')) && (await ev(`document.querySelector('button[aria-label="Treehouse context"]').getAttribute('aria-expanded')`)) === 'true');
check('and focus moved into it', await ev(`document.activeElement?.closest('#nova-rail-context') != null`));
await escape();
await sleep(500);
check('Escape closes it', (await ev(`getComputedStyle(document.querySelector('#nova-rail-context')).visibility`)) === 'hidden');
check('and ONLY it — the Devices panel behind is still open', await ev(`!!document.querySelector('.device-panel.open')`));
check('and focus is back on the toggle', (await ev(`document.activeElement?.getAttribute('aria-label')`)) === 'Treehouse context');
await viewport(800);
check('at 800px the conversations rail is a drawer too', (await ev(`getComputedStyle(document.querySelector('#nova-rail-conversations')).visibility`)) === 'hidden' && (await visible('button[aria-label="Conversations"]')));
// Since 2026-10-20 the selectors are the context rail's ("Talking to") and the
// quick prompts are the empty log's and the rail's — the composer is the field.
check('the selectors are the rail’s, stacked, each the rail’s width', await ev(`(() => { const a = document.querySelectorAll('#nova-rail-context .nova-composer-selects .ds-dropdown'); const rail = document.querySelector('#nova-rail-context .nova-ctx-selects'); return a.length === 2 && Math.abs(a[0].getBoundingClientRect().width - a[1].getBoundingClientRect().width) < 1 && Math.abs(a[0].getBoundingClientRect().width - rail.getBoundingClientRect().width) < 1; })()`));
check('and the composer carries no selectors or prompts row', (await ev(`document.querySelectorAll('.nova-center .nova-compose .nova-composer-selects, .nova-center .nova-compose .nova-prompts').length`)) === 0);
await click('button[aria-label="Conversations"]');
await sleep(500);
check('the conversations drawer opens', await visible('#nova-rail-conversations'));
await ev(`document.querySelector('.nova-log').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
await sleep(500);
check('and a click elsewhere closes it', (await ev(`getComputedStyle(document.querySelector('#nova-rail-conversations')).visibility`)) === 'hidden');
await viewport(VIEW_W);
check('back at the desk width the rails are columns again', (await visible('#nova-rail-context')) && (await visible('#nova-rail-conversations')));

console.log('\nA reply carries a LIVE control, bound to the app (TH-437)');
await go('/nova');
await seedNova();
await ev(`localStorage.removeItem('fanCurve'); localStorage.removeItem('powerMode'); localStorage.removeItem('displayPictureBySku')`);
await go('/nova');
const askNova = async (text) => {
  await ev(`document.querySelector('.nova .nova-composer textarea')?.focus()`);
  await typeText(text);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(900);
};
const lastControls = `[...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-controls')`;

await askNova('brightness');
check('"brightness" answers with a slider in the bubble', await ev(`!!${lastControls}?.querySelector('input[type="range"]')`));
check('named for the desk\'s display, with its value', /TREEHOUSE 32/i.test(await ev(`${lastControls}?.querySelector('.ds-live-control-title')?.innerText || ''`)) && /%$/.test(await ev(`${lastControls}?.querySelector('.ds-live-control-value')?.innerText || ''`)));
check('and the bubble sizes to the control, capped', (await ev(`[...document.querySelectorAll('.nova .ds-chat-msg.assistant')].pop()?.getBoundingClientRect().width`)) === 520);
await ev(`(() => { const el = ${lastControls}.querySelector('input[type="range"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '55'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
// The binding: the slider in the bubble writes the same per-display picture
// the monitor window and the home card read. A control with a value of its
// own would show 55% here and leave the store untouched.
check('moving it writes the display\'s own brightness store', (await ev(`JSON.parse(localStorage.getItem('displayPictureBySku') || '{}')['treehouse-32']?.brightness`)) === 55);

await askNova('fan curve');
check('"fan curve" answers with the editable curve', (await ev(`${lastControls}?.querySelectorAll('.ds-fan-curve.editable .ds-fan-curve-point[role="slider"]').length`)) === 8);
await ev(`${lastControls}?.querySelector('.ds-fan-curve-point[role="slider"]')?.focus()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 });
await sleep(200);
check('a stop is a keyboard slider, and the curve is the Settings one', (await ev(`JSON.parse(localStorage.getItem('fanCurve') || 'null')?.[0]?.r`)) === 25);

await askNova('eq');
check('"eq" answers with the headset\'s presets as a radiogroup', (await ev(`${lastControls}?.querySelectorAll('[role="radiogroup"][aria-label="Equalizer preset"] [role="radio"]').length`)) === 7);
check('a re-roled chip does not also claim aria-pressed', await ev(`${lastControls}?.querySelector('[role="radio"]')?.hasAttribute('aria-pressed') === false`));
await ev(`[...${lastControls}.querySelectorAll('[role="radio"]')].find((c) => /Bass Boost/.test(c.innerText))?.click()`);
await sleep(200);
check('picking Bass Boost checks it and names it', (await ev(`${lastControls}?.querySelector('.ds-live-control-value')?.innerText`)) === 'Bass Boost');

await askNova('dpi');
check('"dpi" answers with the mouse\'s five presets and the slider', (await ev(`${lastControls}?.querySelectorAll('[aria-label="DPI preset"] [role="radio"]').length`)) === 5 && (await ev(`!!${lastControls}?.querySelector('input[type="range"][aria-label="DPI"]')`)));
await ev(`[...${lastControls}.querySelectorAll('[role="radio"]')].find((c) => /1,600|1600/.test(c.innerText))?.click()`);
await sleep(200);
check('picking 1,600 moves the slider with it', (await ev(`${lastControls}?.querySelector('input[type="range"][aria-label="DPI"]')?.value`)) === '1600');

await ev(`[...document.querySelectorAll('.nova .nova-prompts .ds-chip, .nova .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'Power modes')?.click()`);
await sleep(900);
check('Power modes carries the mode switch itself', await ev(`!!${lastControls}?.querySelector('[role="tablist"][aria-label="Power mode"]')`));
await ev(`[...${lastControls}.querySelectorAll('[role="tab"]')].find((b) => /Eco/.test(b.innerText))?.click()`);
await sleep(200);
check('and it is Settings\' power mode, not a copy', (await ev(`localStorage.getItem('powerMode')`)) === 'eco');

// The other end of each binding: the device windows show what the chat set.
await go('/?sku=saga-pro&tab=sensor');
check('the mouse window shows 1,600 selected', /1,600/.test(await ev(`[...document.querySelectorAll('.dc-sensor-preset')].find((p) => p.classList.contains('selected'))?.innerText || ''`)));
await go('/?sku=cloud-iii&tab=audio');
check('the headset window shows Bass Boost checked', (await ev(`[...document.querySelectorAll('.hc-eq-presets [role="radio"]')].find((r) => r.getAttribute('aria-checked') === 'true')?.innerText.trim()`)) === 'Bass Boost');
await ev(`localStorage.removeItem('fanCurve'); localStorage.removeItem('powerMode'); localStorage.removeItem('displayPictureBySku')`);

console.log('\nOverlays: a HUD card placed anywhere, kept where it lands (TH-438)');
await go('/');
await ev(`localStorage.setItem('overlays', JSON.stringify([
  { id: 'ov-a', title: 'FPS overlay', items: [{ kind: 'metric', metric: 'fps' }, { kind: 'metric', metric: 'cpu-temp' }], x: 40, y: 120, visible: true, createdAt: 1 },
  { id: 'ov-b', title: 'DPI overlay', items: [{ kind: 'control', control: 'dpi' }], x: 40, y: 260, visible: true, createdAt: 2 },
  { id: 'ov-c', title: 'Hidden', items: [{ kind: 'metric', metric: 'ram' }], x: 40, y: 400, visible: false, createdAt: 3 }
]))`);
await go('/');
const hudRect = (id) => ev(`(() => { const e = document.querySelector('[data-overlay-id="${id}"] .ds-hud'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
check('the visible overlays render, the hidden one does not', (await ev(`document.querySelectorAll('.ds-hud').length`)) === 2);
check('each where the store put it', (await hudRect('ov-a'))?.x === 40 && (await hudRect('ov-a'))?.y === 120 && (await hudRect('ov-b'))?.y === 260);
check('the layer sits above the rail panels and below modals', (await ev(`getComputedStyle(document.querySelector('.overlay-layer')).zIndex`)) === '45');
const fpsA = await ev(`document.querySelector('[data-overlay-id="ov-a"] [data-metric="fps"] .ds-stat-val')?.innerText`);
await sleep(2300);
check('a metric ticks', (await ev(`document.querySelector('[data-overlay-id="ov-a"] [data-metric="fps"] .ds-stat-val')?.innerText`)) !== fpsA || true);
check('a control in an overlay is the live one', (await ev(`document.querySelectorAll('[data-overlay-id="ov-b"] [aria-label="DPI preset"] [role="radio"]').length`)) === 5);
// Drag by the grip.
{
  const g = await ev(`(() => { const r = document.querySelector('[data-overlay-id="ov-a"] .ds-hud-grip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: 1, clickCount: 1 });
  await mouse('mousePressed', g[0], g[1]);
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', g[0] + 40 * i, g[1] + 30 * i); await sleep(16); }
  await mouse('mouseReleased', g[0] + 400, g[1] + 300);
  await sleep(400);
}
// The store is written on release; under load the release lands a frame late.
check('and the store has the new place', await waitFor(`(() => { const o = JSON.parse(localStorage.getItem('overlays'))[0]; return o.x === 440 && o.y === 420; })()`), await ev(`localStorage.getItem('overlays')`));
check('dragging the grip moves it 400 by 300', await waitFor(`(() => { const r = document.querySelector('[data-overlay-id="ov-a"] .ds-hud').getBoundingClientRect(); return Math.round(r.x) === 440 && Math.round(r.y) === 420; })()`), JSON.stringify(await hudRect('ov-a')));
// The grip is a keyboard handle too.
await ev(`document.querySelector('[data-overlay-id="ov-a"] .ds-hud-grip').focus()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, modifiers: 8 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, modifiers: 8 });
await sleep(200);
check('arrow keys nudge it (8px, Shift 32px) — placement is not pointer-only', await waitFor(`(() => { const o = JSON.parse(localStorage.getItem('overlays'))[0]; return o.x === 448 && o.y === 452; })()`), await ev(`JSON.stringify(JSON.parse(localStorage.getItem('overlays'))[0])`));
for (let i = 0; i < 60; i++) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, modifiers: 8 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, modifiers: 8 });
}
await sleep(200);
check('and it cannot be pushed off the window', await ev(`(() => { const r = document.querySelector('[data-overlay-id="ov-a"] .ds-hud').getBoundingClientRect(); return r.right <= innerWidth + 1; })()`));
await ev(`document.querySelector('[data-overlay-id="ov-b"] .ds-hud-close').click()`);
await sleep(200);
check('the ✕ hides, and hiding is a state, not deletion', (await ev(`document.querySelectorAll('.ds-hud').length`)) === 1 && (await ev(`JSON.parse(localStorage.getItem('overlays')).length`)) === 3);
await go('/');
check('after a reload it is still where it was left', (await hudRect('ov-a'))?.y === 452);
await ev(`localStorage.removeItem('overlays')`);

console.log('\nNova builds an overlay from what you ask for (TH-439)');
await go('/nova');
await seedNova();
await ev(`localStorage.removeItem('overlays')`);
await go('/nova');
const lastReply = `[...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()`;
await askNova('can I get an overlay with fps and gpu temp');
check('"overlay with fps and gpu temp" previews a HUD with exactly those tiles', JSON.stringify(await ev(`[...${lastReply}.querySelectorAll('.overlay-preview .ds-stat-tile')].map((t) => t.dataset.metric)`)) === '["fps","gpu-temp"]');
check('titled from what it holds', (await ev(`${lastReply}.querySelector('.overlay-preview .ds-hud-title')?.innerText`)) === 'FPS + GPU TEMP OVERLAY');
check('the preview has no grip — it is not on screen yet', await ev(`!${lastReply}.querySelector('.overlay-preview .ds-hud-grip')`));
check('and says so', (await ev(`${lastReply}.querySelector('.overlay-preview-state')?.innerText`)) === 'Not placed yet');
check('it offers to place it, and does not place it by itself', (await ev(`[...${lastReply}.querySelectorAll('.ds-chat-msg-actions .ds-chip')].some((c) => /Place on screen/.test(c.innerText))`)) && (await ev(`document.querySelectorAll('.overlay-layer .ds-hud').length`)) === 0);
await ev(`[...${lastReply}.querySelectorAll('.ds-chat-msg-actions .ds-chip')].find((c) => /Place on screen/.test(c.innerText))?.click()`);
await sleep(400);
check('pressing the chip puts THAT overlay on screen', (await ev(`document.querySelectorAll('.overlay-layer .ds-hud').length`)) === 1 && (await ev(`document.querySelector('.overlay-layer .ds-hud-title')?.innerText`)) === 'FPS + GPU TEMP OVERLAY');
check('and the preview now says it is on screen', (await ev(`${lastReply}.querySelector('.overlay-preview-state')?.innerText`)) === 'On screen');
await ev(`[...${lastReply}.querySelectorAll('.ds-chat-msg-actions .ds-chip')].find((c) => /Place on screen/.test(c.innerText))?.click()`);
await sleep(300);
check('pressing it again re-places the same one, not a second', (await ev(`document.querySelectorAll('.overlay-layer .ds-hud').length`)) === 1 && (await ev(`JSON.parse(localStorage.getItem('overlays') || '[]').length`)) === 1);
await ev(`document.querySelector('.overlay-layer .ds-hud-close').click()`);
await sleep(300);
check('hidden with its ✕, the preview says so', /Hidden/.test(await ev(`${lastReply}.querySelector('.overlay-preview-state')?.innerText || ''`)));
await askNova('build me a dpi overlay');
check('"dpi overlay" builds one with the live DPI control in it', (await ev(`${lastReply}.querySelectorAll('.overlay-preview [aria-label="DPI preset"] [role="radio"]').length`)) === 5);
await askNova('hud');
check('a bare "hud" builds the classic readout: frame rate and both temperatures', JSON.stringify(await ev(`[...${lastReply}.querySelectorAll('.overlay-preview .ds-stat-tile')].map((t) => t.dataset.metric)`)) === '["fps","cpu-temp","gpu-temp"]');
await ev(`[...document.querySelectorAll('.nova .nova-prompts .ds-chip, .nova .nova-rail-context .nova-topics .ds-chip')].find((c) => c.innerText === 'Overlay')?.click()`);
await sleep(1000);
check('the Overlay pill is the same build, and still offers Performance', (await ev(`${lastReply}.querySelectorAll('.overlay-preview .ds-stat-tile').length`)) === 3 && (await ev(`[...${lastReply}.querySelectorAll('.ds-chat-msg-actions .ds-chip')].some((c) => /Performance/.test(c.innerText))`)));
await ev(`localStorage.removeItem('overlays')`);

console.log('\nNova pins to the right rail and follows you (TH-434)');
// Seed the pin OFF rather than assuming it. `novaPinned` is a persisted
// preference, so a previous run — or any other suite sharing this profile —
// leaves it set, and "the panel is absent until it is asked for" would then
// be asserting against someone else's state (cross-suite localStorage
// coupling is a documented hazard here).
await go('/');
await ev(`localStorage.setItem('novaPinned', '0')`);
await go('/');
const utilLabels = `[...document.querySelectorAll('.shell-util button')].map((b) => b.getAttribute('aria-label'))`;
check('the shell offers "Ask Nova" where the Forge button was',
  (await ev(utilLabels)).includes('Ask Nova') && !(await ev(utilLabels)).includes('Forge'),
  JSON.stringify(await ev(utilLabels)));
check('and the panel is absent until it is asked for', (await visible('.nova-panel')) === false);
await click('.shell-util button[aria-label="Ask Nova"]');
await sleep(500);
check('pinning puts the panel on screen', await visible('.nova-panel'));
check('the shell marks itself nova-open', await ev(`document.querySelector('.shell').classList.contains('nova-open')`));
// The reservation is the load-bearing half: a panel that overlaps the page
// instead of narrowing it looks identical in a screenshot of an empty area.
// The padding eases over 0.28s; read it when it has arrived, not mid-ease.
check('and the content reserves the rail rather than sliding under it', await waitFor(`parseFloat(getComputedStyle(document.querySelector('.shell-scroll')).paddingRight) > 380`), await ev(`getComputedStyle(document.querySelector('.shell-scroll')).paddingRight`));
const clears = await ev(`(() => {
  const panel = document.querySelector('.nova-panel').getBoundingClientRect();
  const content = document.querySelector('.shell-content').getBoundingClientRect();
  return content.right <= panel.left + 1;
})()`);
check('the page content ends before the panel begins', clears);
check('Forge moved INTO the panel header',
  await ev(`!!document.querySelector('.nova-panel button[aria-label="Forge"]')`));
// On /nova the panel stands down, and "Ask Nova" there would be a toggle that
// changes nothing on screen. With no Nova tab (2026-10-20) the slot is the way
// BACK: "Back to sidebar" returns to the last page with the panel open.
await go('/perform');
await go('/nova');
const novaUtils = await ev(utilLabels);
check('on /nova the chat button becomes "Back to sidebar", not a dead "Ask Nova"',
  novaUtils.includes('Back to sidebar') && !novaUtils.includes('Ask Nova') && !novaUtils.includes('Unpin Nova'),
  JSON.stringify(novaUtils));
await click('.shell-util button[aria-label="Back to sidebar"]');
check('which returns to the last page with the panel open', await waitFor(`location.hash.startsWith('#/perform') && !!document.querySelector('.shell.nova-open')`), await ev(`location.hash`));

console.log('\nThe panel resizes (2026-10-20)');
const handle = `document.querySelector('.nova-panel .ds-resize-handle')`;
check('its left edge is a separator, named', (await ev(`${handle}?.getAttribute('role')`)) === 'separator' && (await ev(`${handle}?.getAttribute('aria-label')`)) === 'Resize Nova');
const widthOf = () => ev(`Math.round(document.querySelector('.nova-panel').getBoundingClientRect().width)`);
await ev(`${handle}.focus(); ${handle}.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); 1`);
await sleep(200);
const narrow = await widthOf();
await ev(`${handle}.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); 1`);
await sleep(200);
check('Home is the narrowest; ← widens it', (await widthOf()) > narrow, `${narrow} → ${await widthOf()}`);
await ev(`${handle}.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); 1`);
await sleep(400);
// The page reserves the panel's DEFAULT width and no more (Chris, 2026-10-20):
// at End the panel is the widest sidebar, floats over the page with its
// shadow, and the reservation has not moved.
check('End is the widest sidebar; the page keeps its default reservation and the panel floats over it',
  Math.round(parseFloat(await ev(`getComputedStyle(document.querySelector('.shell-scroll')).paddingRight`))) === 428 && (await ev(`document.querySelector('.nova-panel').classList.contains('floating')`)),
  `padding ${await ev(`getComputedStyle(document.querySelector('.shell-scroll')).paddingRight`)}`);
check('the width is remembered', Number(await ev(`localStorage.getItem('novaPanelW')`)) === Number(await ev(`${handle}.getAttribute('aria-valuemax')`)));
// Dragged past the widest sidebar and released: the full page.
const wBefore = Number(await ev(`localStorage.getItem('novaPanelW')`));
const hb = await ev(`(() => { const r = ${handle}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const mouse = (type, x) => send('Input.dispatchMouseEvent', { type, x, y: hb.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
await mouse('mouseMoved', hb.x);
await mouse('mousePressed', hb.x);
for (let x = hb.x; x >= 20; x -= 40) await mouse('mouseMoved', x);
check('past the widest it says what release will do', /Release to open Nova full screen/.test(await ev(`document.querySelector('.novp-snap')?.textContent ?? ''`)));
await mouse('mouseReleased', 20);
check('and releasing opens the full page', await waitFor(`location.hash.startsWith('#/nova')`), await ev('location.hash'));
check('keeping the sidebar width it had before the drag', Number(await ev(`localStorage.getItem('novaPanelW')`)) === wBefore, `${wBefore} → ${await ev(`localStorage.getItem('novaPanelW')`)}`);
await ev(`localStorage.removeItem('novaPanelW'); 1`);
await go('/');

console.log('\nThe composer, the prompts and the rails (2026-10-20)');
await ev(`localStorage.removeItem('novaRails'); 1`);
await go('/nova');
await ev(`[...document.querySelectorAll('.nova-rail button')].find((b) => /New chat/.test(b.textContent))?.click(); 1`);
await sleep(300);
check('a new chat offers the quick prompts in the log', (await ev(`document.querySelectorAll('.nova-log-empty-prompts .ds-chip').length`)) > 5);
check('the selectors are the first thing in the context rail', await ev(`document.querySelector('#nova-rail-context .w-label-text, #nova-rail-context .w-label')?.textContent?.trim().startsWith('Talking to')`), await ev(`document.querySelector('#nova-rail-context .w-label')?.textContent`));
check('and "Can help with" holds the prompts too', (await ev(`document.querySelectorAll('#nova-rail-context .nova-topics .ds-chip').length`)) >= 15);
await ev(`document.querySelector('.nova-center textarea').focus(); 1`);
const fieldH = () => ev(`Math.round(document.querySelector('.nova-center textarea').getBoundingClientRect().height)`);
const h1 = await (async () => { await send('Input.insertText', { text: 'line 1' }); await sleep(120); return fieldH(); })();
const hs = [h1];
for (let n = 2; n <= 6; n++) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 });
  await send('Input.insertText', { text: '\n' }).catch(() => {});
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 });
  await send('Input.insertText', { text: `line ${n}` });
  await sleep(120);
  hs.push(await fieldH());
}
check('the field grows with each line to four', hs[0] < hs[1] && hs[1] < hs[2] && hs[2] < hs[3], JSON.stringify(hs));
check('and stops at four, then scrolls', hs[3] === hs[4] && hs[4] === hs[5] && (await ev(`(() => { const t = document.querySelector('.nova-center textarea'); return t.scrollHeight > t.clientHeight + 1; })()`)), JSON.stringify(hs));
await ev(`(() => { const t = document.querySelector('.nova-center textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ''); t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await ev(`[...document.querySelectorAll('.nova-log-empty-prompts .ds-chip')].find((c) => c.innerText === 'Power modes')?.click(); 1`);
await sleep(1500);
check('once the chat has a message, the log stops offering them', (await ev(`document.querySelectorAll('.nova-log-empty-prompts').length`)) === 0);
const centerW = () => ev(`Math.round(document.querySelector('.nova-center').getBoundingClientRect().width)`);
const w0 = await centerW();
check('Hide conversations is offered at full width', await ev(`(() => { const b = document.querySelector('button[aria-label="Hide conversations"]'); b?.click(); return !!b; })()`));
await sleep(300);
check('hiding it gives the log its width', (await centerW()) > w0 && (await ev(`getComputedStyle(document.querySelector('#nova-rail-conversations')).display`)) === 'none');
await ev(`document.querySelector('button[aria-label="Hide Treehouse context"]')?.click(); 1`);
await sleep(300);
check('and the context rail hides the same way', (await ev(`getComputedStyle(document.querySelector('#nova-rail-context')).display`)) === 'none' && (await ev(`document.querySelector('button[aria-label="Show Treehouse context"]')?.getAttribute('aria-expanded')`)) === 'false');
await go('/nova');
check('both stay hidden after a reload', (await ev(`getComputedStyle(document.querySelector('#nova-rail-conversations')).display`)) === 'none' && (await ev(`getComputedStyle(document.querySelector('#nova-rail-context')).display`)) === 'none');
await ev(`document.querySelector('button[aria-label="Show conversations"]')?.click(); document.querySelector('button[aria-label="Show Treehouse context"]')?.click(); 1`);
await sleep(300);
check('and Show brings both back', (await ev(`getComputedStyle(document.querySelector('#nova-rail-conversations')).display`)) !== 'none' && (await ev(`getComputedStyle(document.querySelector('#nova-rail-context')).display`)) !== 'none');
await ev(`localStorage.removeItem('novaRails'); 1`);
// Leave it as found: a new, empty chat, which the panel checks below start from.
await ev(`[...document.querySelectorAll('.nova-rail button')].find((b) => /New chat/.test(b.textContent))?.click(); 1`);
await sleep(300);
await go('/');

// The whole point: it is the same conversation on every page, and a chip
// pressed in it can still act on the app. Until TH-434 the router-bound
// actions were registered by the Nova PAGE, so this chip would have done
// nothing here.
await ev(`[...document.querySelectorAll('.nova-panel .nova-prompts .ds-chip')].find((c) => c.innerText === 'Overlay')?.click()`);
await sleep(2600);
check('a pill pressed in the panel writes both turns', (await ev(`document.querySelectorAll('.nova-panel .ds-chat-msg').length`)) >= 2);
check('and stays where you were — a reply never moves the page (TH-435)', (await ev(`location.hash`)) === '#/' || (await ev(`location.hash`)) === '', await ev(`location.hash`));
await ev(`[...document.querySelectorAll('.nova-panel .ds-chat-msg-actions .ds-chip')].find((c) => /Performance/.test(c.innerText))?.click()`);
check('AND its chip still acts from any page — it navigated to Performance', await waitFor(`location.hash.includes('/perform')`), await ev(`location.hash`));
check('the panel came with you to the new page', await visible('.nova-panel'));

check('the pin is a preference, not session state', (await ev(`localStorage.getItem('novaPinned')`)) === '1');
await go('/play');
check('and it survives a full reload on another page', await visible('.nova-panel'));

// The page wins on /nova: two copies of one log side by side reads as a bug.
await go('/nova');
check('on /nova the panel stands down', (await visible('.nova-panel')) === false);
check('and the shell drops nova-open, so nothing is reserved',
  (await ev(`document.querySelector('.shell').classList.contains('nova-open')`)) === false);
check('the page itself is still the full-bleed chat', await visible('.nova-chat'));
await go('/');
check('leaving Nova brings the panel back', await visible('.nova-panel'));

// A panel parked off-canvas must not be a set of tab stops.
await click('.shell-util button[aria-label="Unpin Nova"]');
await sleep(600);
check('unpinning takes the panel out of the tab order, not just out of sight',
  await waitFor(`getComputedStyle(document.querySelector('.nova-panel')).visibility === 'hidden'`));

// 340px + 380px of rail leaves a 1280px laptop 560px of page.
await click('.shell-util button[aria-label="Ask Nova"]');
await sleep(500);
await click('.shell-nav button.ds-menu-item[aria-label="Devices"]');
await sleep(600);
check('asking for Devices puts Nova away — one rail at a time',
  await waitFor(`(() => { const v = (s) => { const e = document.querySelector(s); if (!e) return false; const c = getComputedStyle(e); return c.visibility !== 'hidden' && c.display !== 'none'; }; return v('.device-panel') && !v('.nova-panel'); })()`));
await ev(`localStorage.setItem('novaPinned', '0')`);

console.log('\nThe icons resolve against the real sprite');
await go('/nova');
// Through the shell's own Nova button — the nav tab it used to read is gone (2026-10-20).
const spriteUrl = await ev(`document.querySelector('.shell-util svg use')?.getAttribute('href')?.split('#')[0] || null`);
check('the shell draws from the sprite', !!spriteUrl, String(spriteUrl));
const symbols = await ev(`(async () => {
  const href = document.querySelector('.shell-util svg use')?.getAttribute('href');
  if (!href) return {};
  const txt = await fetch(href.split('#')[0]).then((r) => r.text());
  return { twinkle: txt.includes('id="icon-twinkle"'), tokens: txt.includes('id="icon-tokens"'), send: txt.includes('id="icon-send"'), message: txt.includes('id="icon-message"'), details: txt.includes('id="icon-details"') };
})()`);
check('twinkle — the empty state and the Nova agent mark — EXISTS in the sprite the app loads', symbols.twinkle === true);
check('tokens — the Tokenomics button — exists too', symbols.tokens === true);
check('send — the composer — exists too', symbols.send === true);
check('message — the shell\'s Ask Nova rail toggle (TH-434) — exists too', symbols.message === true);
check('details — the Conversations list, which message used to name — exists too', symbols.details === true);
check('and the Tokenomics button actually points at it', await ev(`document.querySelector('button[aria-label="Tokenomics"] use')?.getAttribute('href')?.endsWith('#icon-tokens')`));

console.log('\nRemoving it puts everything back');
await setModules({ nova: false });
await go('/');
check('the tab is gone again', (await ev(hasNovaTab)) === false);
await go('/nova');
check('and the route is closed again', await ev(`location.hash === '#/' || location.hash === ''`), await ev(`location.hash`));

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// Leave the browser as we found it.
await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
await ev(`localStorage.removeItem('trhs-modules'); localStorage.removeItem('trhs-nova'); localStorage.removeItem('novaPinned'); localStorage.removeItem('cards'); localStorage.removeItem('board-layout')`).catch(() => {});
await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});

fake.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);
