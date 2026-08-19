# Treehouse — Modal Registry (draft)

> The modal-side analog of `card-schema.jsonc` instances: **every modal surface in the running prototype, classified.**
> Status: **DRAFT** — code-grounded inventory (2026-07-17, full sweep of `web/src`). The industry-rules layer
> (internal navigation, commit ergonomics, sizing, stacking) lands when the modal-internals research completes.
> Typology per P5 + report §7: subject decides the type — a *thing* → Device Modal · a *capability* → Detail Modal.
> Templates per Chris's six: base shell / simple / feature (left rail) / device / content-browser / in-app browser.

## The registry

| # | Modal | File | Subject → Type | Template | Doors (today) | Owner page | Header today | Commit | Esc / backdrop | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **DeviceModal** (non-mouse) | `web/src/devices/DeviceModal.tsx` | device → **Device** | device | `?sku=` (+`?tab=`) from device cards on Home board, Perform V1–V4, Metro | *(opens over any page — see Open #1)* | breadcrumb: dead `‹` + SKU name + `×` | immediate / local | Esc ✓ + backdrop ✓ (host) | large centered (inset 108px) |
| 2 | **DeviceCanvas** (mouse) | `web/src/devices/DeviceCanvas.tsx` | device → **Device** | device — **fullscreen editor state** | same `?sku=` pipeline; host branches on `type === 'mouse'`; also mislabeled doors (see Violation #2) | *(same as #1)* | **no breadcrumb** — status chips + lone `×` | presentational (stubs) | Esc ✓ + backdrop ✓ (host) | fullscreen takeover |
| 3 | **UnleashModal** | `web/src/widgets/perform4/UnleashModal.tsx` | capability → **Detail** | feature (left rail) | "Advanced Tuning" button on EnvelopeCard (unleashed mode only) | **PerformV4** ✓ (the one clean ownerPage) | breadcrumb: dead `‹` + "Unleashed — Advanced Tuning" + `×` | **explicit Apply + Reset** | Esc ✓ + backdrop ✓ | large centered two-column |
| 4 | **WidgetPicker** | `web/src/widgets/WidgetPicker.tsx` | picker → — | simple | "+ Add a widget" on Home board | Home | title + `×` (Icon) | immediate (Add fires at once) | Esc ✓ + backdrop ✓ | centered 440px |
| 5 | **Metro add-section gallery** | inline `web/src/metro/MetroDashboard.tsx:812` | picker → — | simple | "+ Add section" (Metro edit mode) | Metro | title + literal `✕` | immediate | **no Esc**; backdrop ✓ | centered 560px |
| 6 | **Metro add-widget gallery** | inline `web/src/metro/MetroDashboard.tsx:832` | picker → — | simple | per-section "+" (Metro edit mode) | Metro | title + literal `✕` | immediate | **no Esc**; backdrop ✓ | centered 560px |

**Modal-adjacent (popovers, not modals):** ProfileMenu (`app/ProfileMenu.tsx` — Settings/Admin/Sign-out items are no-ops), PlayLibrary LibOptions (no Esc), Metro ResizePop, native `window.prompt/confirm` in PlayLibrary, WallpaperPicker (inline widget, not a modal).

**Stacking today:** no modal opens another modal. Closest: PlayLibrary popover → native `confirm`; DeviceModal(monitor) embeds DisplayArrange as an in-body sub-surface.

## Violations & debts (mapped to canon)

1. **The dead back button** — `ModalShell.tsx:26` + `DeviceModal.tsx:30`: `‹` with `aria-label="Back"` and **no onClick**, shipped in every shell-based modal. The code already voted: back is fake. Replace the breadcrumb row with the **identity header** ("lives in X" label + optional L2 controls, report §8.3) instead of wiring the corpse.
2. **Door label ≠ destination** — OmenAiWidget "Configure" and LightingWidget "Light Studio" both open the **mouse Keys-Buttons canvas** (`setParams({device:'mouse'})` → `haste-3-pro`). Two features' doors lead to an unrelated room — scaffolding to unwire before anyone demos it.
3. **Three picker implementations, zero shared shell** (#4/#5/#6; #5–#6 are near-duplicate inline blocks in one file). One `simple` template should serve all three — the modal-side Law 1.
4. **Dismissal contract is per-modal folklore** — Esc works in 1/2/3/4, missing in 5/6 and LibOptions. Esc + backdrop + `×` belong on the base shell, defined once.
5. **Two door grammars** — legacy `?device=` (param-clobbering `setParams`) vs canonical `?sku=`+`?tab=` (param-preserving). Pick `?sku=`; migrate the two legacy doors.
6. **Close glyph drift** — `<Icon name="close">` vs literal `✕`. Shell-level fix.
7. **Scrim ownership drift** — Backdrop variants (`heavy/plain/top`) defined but unused; Metro galleries bypass `Backdrop` with their own scrim. The shell owns the scrim.
8. **Two promised surfaces don't exist** — Settings ("Settings"/"Admin Panel" menu items close the menu and do nothing) and onboarding (no welcome/tour surface anywhere). Both appear in Chris's IA; both need template assignments (settings → feature? onboarding → simple wizard) before anyone improvises them.

## Rules — verified so far (research pass 1: standards layer, 3-0 adversarial votes)

**Stacking (gap 5):**
- **R-M1** · Dialog-over-dialog is sanctioned (ARIA APG: "a window overlaid on either the primary window or another dialog window"), with **no half-modal overlays**: each layer must fully inert the layer beneath — interaction blocked AND visually obscured — or it must not claim `aria-modal`.
- **R-M2** · Depth candidate (Material M2: only full-screen dialogs may host other dialogs; floating dialogs never nest): **an editor-scale modal is the elevation floor and may host exactly one gate layer; small/floating dialogs (pickers) terminate the stack.** Treehouse: UnleashModal may carry an L4 gate; WidgetPicker carries nothing.
- **R-M3** · The confirmation/risk gate is a **named standard subtype** — `role=alertdialog` with `aria-labelledby` (visible title) + `aria-describedby` (the message body, which is what screen readers announce on open). The L4 warning gate is an alertdialog, not a second modal.

**Dismissal & announcement (gap 10):**
- **R-M4** · Esc closes **exactly one layer per press** — the APG keyboard contract is per-dialog, not per-stack. Validates the Esc chain (pit #36: popover → maximized → modal, one level at a time).
- **R-M5** · Apply/failure results announce via the alertdialog `describedby` when blocking, or a status live-region when non-blocking — WCAG 4.1.3 claims still in verification (pass 2).

> Research pass 1 was cut by a usage limit mid-verification: gaps 1–4 and 6–9 have extracted claims (Apple HIG one-layer + drill-in warnings, Fluent nesting prohibition, iCUE commit-model history, M2 dirty-state) awaiting votes. Pass 2 resumes from the run cache.

## Open

1. **ownerPage for device modals** — they open over whatever page you're on; the cold-start / deep-link background (report §8: synthesize the owner page first) is undefined for devices. Candidate: the device's directory surface.
2. **DeviceCanvas is our live "maximized editor"** — fold it into the surface ladder as a *state* of the Device Modal (same identity, expanded), not a second surface (pit #36); its chip-header vs the shell breadcrumb is exactly the header-model decision in miniature.
3. **Native `prompt`/`confirm`** in PlayLibrary → replace with the DS dialog when the base shell lands.
4. Industry-rules column (internal nav grammar, per-template commit ergonomics, sizing, stacking depth, a11y announcements) — pending the modal-internals research.
