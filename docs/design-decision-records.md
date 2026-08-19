# Treehouse — Design Decision Records (architecture level)

> Source of truth for **UX/architecture decisions** — what's aligned, why, and what follows.
> Visual twin: Figma **"Treehouse — Card Typology"** → page *Architecture Principles* (P1–P8 with live evidence)
> https://www.figma.com/design/1KCk0SXophUektHzjWZBXX
>
> Anti-drift rule: reviews start and end at the register (bottom). Reopening a DECIDED item
> requires a written reason — nothing drifts by a remark in a meeting.
> Format per unit: **What is aligned / Why / Because of that.** Tags: (still open) / (pending X).

---

## P1 · One grid, two kinds of space
**What is aligned**
1. One shared 12-col grid across all main pages — a card means the same thing everywhere. (12 pending Jay; he leaned 6.)
2. Dashboard is the customizable space: add / remove / reorder / resize.
3. Play / Perform / Personalize are curated: unique design, fixed layouts. (Light reordering still open.)

**Why**
1. Too much customizability breaks the card layout: height variance opens gaps per row; width variance fails to fill rows.
2. Curated pages carry the product's opinion; the dashboard carries the user's.

**Because of that**
- Page owners decide which features become dashboard widgets; widgets may exceed page content (OMEN add-ons, image box, etc).

## P2 · Two directories, one destination
**What is aligned**
1. Single destination, multiple entry points — one canonical modal per feature; page, card and device menu all route to it.
2. Keep both the experience map (Play/Perform/Personalize) and a device directory.
3. The device list stays persistent at the default screen.
4. Peripheral controls live in the device modal, not on cards.

**Why**
1. Users retrieve device-bound features by the thing they own: keyboard lighting 100% via the device door, laptop details 79%, lighting 6/4 (n=15, directional — verify two suspected data errors with Jeff before quoting). Ownership is the one stable, self-labeling index that works for all 4 user types.
2. Stripping Performance/Personalize from devices makes room for software features — converts type b (peripherals-only), maybe type d. Software is also where differentiation and future revenue live.

**Because of that**
- Perform & Personalize = duplicates of hardware features (different entry, same destination) + software features + cross-device sync. Duplicate entries, never content.

## P3 · Card contract — type × size × depth
**What is aligned**
1. A card = content type × size × depth. Four types: Controls / Status / Device / Content — every card maps to exactly one type, no bespoke cards.
2. Size is a span on the shared grid; size drives a content LADDER, not a stretch. Status ladder: 1×1 value+label → 2×1 +sparkline → 2×2 cluster(≤4)+one action → 4×2 full cluster+history+actions. cpu/fan/thermal/storage/vitals are the same card at different sizes.
3. Each type has a minSize below which it can't carry meaning (Status: 1×1).
4. Rules are data, machine-checkable: size ≥ type.minSize; controls only at sizes the type permits; L3/L4 never render on the grid; one type per card.

**Why**
1. New content should cost nothing to design: a new stat = pick type + size. That's the stress test.
2. Misfits become schema gaps, not one-offs — Remote Play doesn't fit one type; the schema flags it (media type or composite, still open).

**Because of that**
- Feature teams request a card by declaring type/size/depth; design maintains the vocabulary instead of reviewing every screen. This is the Punchcut/dev handoff contract.

## P4 · Depth — progressive disclosure & the anchor
**What is aligned**
1. Four depth levels: L1 glance · L2 key setting · L3 advanced · L4 opt-in gate. The grid holds L1–L2 only; L3–L4 drill into a modal.
2. L4 is an opt-in GATE, not a risk level — triggers: automation handoff (auto→manual, e.g. custom fan curve), technical depth (per-core tuning), hardware risk (IccMax / PL4 / LLC).
3. The anchor exception: ONE card per page may follow state in height (e.g. Power Mode when Unleashed); it owns its row — never pairs — and alone carries inline L3.
4. Every other card keeps state-independent height.
5. Vitals stay visible inside the tuning modal (stakeholder hard constraint).

**Why**
1. Height variance breaks rows — depth in modals keeps the grid glanceable.
2. Usage splits the same way (HP segmentation, n>3200): L2 88–100% · L3 16–49% · L4 16–31%.
3. One anchor gives each page a deliberate focal point instead of uniform sameness.

**Because of that**
- Cards need only L1–L2 states; anything deeper routes to the modal.
- Every L4 entry shows the approved warning: "Improper configuration may pose risks to VRM, battery, or CPU longevity."

## P5 · Modal typology — things vs capabilities
**What is aligned**
1. Two modal patterns, derived not designed — which one a feature gets follows from what it IS.
2. Device Modal is for THINGS (mouse, keyboard, headset, monitor): hero object on top, console below.
3. Detail Modal is for CAPABILITIES (OMEN AI, Booster, Unleashed tuning): left identity panel + right working console.
4. The left panel is the trust surface — status, benefits AND considerations; honest warnings live here (OMEN AI: "May override manual tweaks"; Unleashed: the L4 electrical-risk note).
5. One canonical modal per feature — never duplicate content, only entries.

**Why**
1. One classification replaces many one-off layout decisions.

**Because of that**
- A new capability inherits the whole pattern for free; the trust slot is structural, so warnings can't be quietly dropped.

## P6 · OMEN AI × power mode — delegation above manual
**What is aligned**
1. One variable drives the performance page: the laptop (OMEN/HP · no HP). HyperX gear never changes it.
2. Three states across eras: separate features (V1) → AI leads (2.0) → AI manages fan/power within a user-set limit (3.0, scope/timing still open). Non-HP caps at the 2.0 experience.
3. Delegation never hides manual — tiles stay visible; AI's pick is labeled "Set by OMEN AI · for \<game>"; clicking another mode takes over.
4. Absent capability = the block doesn't exist. Nothing greys out.
5. Attribution recorded from day one: every mode change stores who wrote it (user / omen_ai / smart_sense).

**Why**
1. Precedents keep delegation legible: Nest signs its setpoint changes; NVIDIA's "Optimized" breaks visibly on manual edit; HP Smart Sense.
2. The 2.0 label displays recorded history — if MVP doesn't record it, 2.0 launches with nothing to show.

**Because of that**
- V1 must record attribution even though it flips mode at game launch unlabeled.
- Override-while-AI-active is undefined (still open — currently the knob is only re-signed).

## P7 · Inter-card relationship grammar — marks carry governance
**What is aligned**
1. Marks carry governance, not grids — "this card manages that card" is expressed on the governed control, never by position.
2. Grade derives from write behavior, never chosen aesthetically; the visual claim must never exceed the actual write coupling.
3. Grade 0 independence · 1 annotation (signature badge: "whoever last wrote the knob is signed on the knob") · 2 adjacency+capture (strip docked above, hairline gap, colored top edge, vertical only) · 3 containment/absorption (frame owns the zone, manual = escape hatch, max ONE per page).
4. Upgrades are strictly additive; nothing from a lower grade is ever removed. Reads never earn vocabulary.

**Why**
1. Survey of shipped products (Nest, Tesla, NVIDIA App, smart-home dashboards): none express governance by position — all use marks on the governed control and logs.

**Because of that**
- Today's OMEN AI coupling = one write point (launch flip) = grade 1 only, which frees the page layout.
- The AI identity color must be distinct from the selection accent (still open — purple provisional; fails AA normal text on elevated surfaces, 4.44:1).

---

## Open register (Q-…)

| ID | Question | Status | Note | Suggested owner |
|---|---|---|---|---|
| Q-01 | Where do devices belong (dashboard slot vs top nav)? | OPEN | Research: entrance-not-home; list stays persistent. Pick the surface. | Chris + Juntao |
| Q-02 | What lives under Personalization? | DRAFTED | Bucket list exists (macros/lighting/sync/add-ons TBD) — needs sign-off. | Juntao |
| Q-03 | What makes each curated page unique? | PROPOSAL | The anchor rule: one deliberate focal card per page. | team |
| Q-04 | Do curated pages allow light reordering? | OPEN | Needs a stress test. | team |
| Q-05 | How is the PC represented as a device? | ANSWERED | Identity card stays; interfaces split to device modal; engine lives in Performance (79% details via Devices). | Christy (HW enablement) |
| Q-06 | Grid: 12 columns ratification | PENDING | Juntao × Chris aligned on 12; Jay leaned 6. | Jay |
| Q-07 | Arbitration: manual override while AI active | OPEN | Single strategy point stubbed in code — must be defined before 2.0. | Randy + design |
| Q-08 | AI identity hue (≠ selection accent) | OPEN | Purple provisional; fails AA normal on elevated (4.44). | design + DS |
| Q-09 | OMEN AI: exposure vs altitude | OPEN | Decoupled: how forefront it is = marketing, reversible; where it sits in the control architecture = structural. Hard fact (Chris, 1:1): OMEN AI legally requires data-collection consent → power modes must stay reachable without it. | Randy + business |
| Q-10 | Armed (future-tense) state glyph | OPEN | Managed = solid badge; armed ("will take over at launch") needs a distinct, readable-before-it-acts form; the sentence lives in the disclosure. | design |
| Q-11 | Frame priority stack | OPEN | One stroke at a time: spotlight vs managed vs edit-selection vs critical health — arbitration order TBD (extends the state priority stack). | design |
| Q-12 | Badge color grammar + narrow breakpoints | OPEN | Reserved bands (AI purple, health R/A/G) closed to content badges and vice versa; tablet/mobile gutters (12/10px) too tight for straddling badges — shrink/tuck rule needed. | design + DS |
| Q-13 | Takeover rendering of governed cards | OPEN | Visible + inert + "Managed by X" (canon) vs cards disappearing (both voiced in the 1:1) — needs ideation before it hardens. | Juntao + Chris |

## Drafted records — G1…G8 (written, awaiting sign-off)

> The eight gaps a reviewer would ask about, drafted in the same unit format.
> Status: **DRAFT** — proposals to ratify or amend, not decisions.
> Ratifying one = flip its tag here and, where noted, edit a value in `card-schema.jsonc`.

### G1 · Terminology — one word per thing (strawman for the Vince session)
**What is proposed**
1. **Card** — the generic grid-unit contract (type × size × depth). The schema's noun.
2. **Widget** — a card *instance on the customizable dashboard* (user add/remove/resize). Dashboard-specific.
3. **Tile** — a sub-card control element (the power-mode tiles). Tiles never sit on the grid directly.
4. **Panel** — persistent chrome outside the grid (device rail). Not a card.
5. **Modal** — the L3/L4 container; exactly two patterns (Device / Detail, P5).
6. **Overlay** — transient, non-modal surface (toast, popover); never carries L3+ content.

**Why** — five words are used interchangeably in meetings; the code already distinguishes them (`CATALOG` widgets vs `.power-mode-btn` tiles) — the vocabulary exists, it's just unnamed.
**Because of that** — docs, Figma layer names, and CSS class prefixes adopt these six; the validator can later lint naming.

### G2 · Card states — every card defines five
**What is proposed**
1. Every card type defines: **default · empty · loading · error · disconnected** (disconnected: device types only).
2. State changes never change card height (corollary of P4's height discipline).
3. Empty ≠ removed: the card keeps its slot with a quiet affordance ("No games yet — browse").
4. Disconnected device cards show last-known values + timestamp, never blank.

**Why** — the prototype renders default only; Punchcut will ask on day one; height-stable states protect the grid.
**Because of that** — each type's contract in `card-schema.jsonc` gains a `states` block; the prototype backfills one exemplar per type before handoff.

### G3 · Status color semantics — one grammar per hue
**What is proposed** (from Evidence Plate E3)
1. Green `#22c55e` = healthy/positive · Orange `#ff6b2b` = elevated/attention · Red `#ef4444` = critical/risk.
2. Accent (the user's pick) = selection/interactivity ONLY — never a health state.
3. Purple = AI authorship ONLY (P7) — never a health state.
4. Tokens rename semantically (`--status-healthy`), not by color name.

**Why** — orange/red currently double as mode identities (Performance/Unleashed) AND health states — same hue, two grammars. Context disambiguates today (tile identity vs readout), but that's a convention worth stating, not an accident.
**Because of that** — the double duty is tolerated and *recorded*; if testing shows confusion, mode identities move off the status hues — never the reverse.

### G4 · Capability degradation — the page degrades by rule table, not by design
**What is aligned** (exists in code — recording, not proposing)
1. Three-layer capability ladder: telemetry (always) / software write / hardware write (`machine.ts` MACHINES).
2. Form is a pure function of (capability, AI authority): `formOf()` — no scattered conditionals.
3. Absent capability = the block **does not exist**. Nothing greys out (P6.4).
4. The 3rd-party envelope slot renders **empty** until the Windows power-plan write question is answered ([ENG] — do not invent content).
5. Non-HP machines cap at the 2.0 experience (the matrix).

**Why** — degradation as data means a new SKU is a new table row, not a new design.
**Because of that** — SKU questions route to the rule table; Punchcut receives the table, not per-SKU screens.

### G5 · Dashboard mandatory slots — almost nothing is locked
**What is proposed**
1. The user may remove any card; only the **Add Widget** affordance stays reachable.
2. The *default* layout (not the user's) must include at least one performance status card (vitals).
3. Safety-relevant signals (thermal warning) surface via alerts even if their card was removed — removal never mutes safety.
4. Nothing else is mandatory. (If the business wants OMEN AI sticky, record that separately as a business call — not a design law.)

**Why** — P1 says the dashboard carries the user's opinion; every locked slot spends that budget.
**Because of that** — `spaces.dashboard.mandatorySlots` in the schema gets these three entries; the remove affordance stays universal.

### G6 · Perform → Performance rename — decided by data, pending one verification
**What is proposed** — ratify the rename (Perform → Performance, Personalize → Personalization).
**Why** — Jeff's A/B (n=15, directional): Customize find-rate 73→100%, fan-control nav 73→86% post-rename; verb labels read as commands, noun labels read as places.
**Because of that** — routes/nav copy update at the next nav touch; docs already say Performance. **Blocked on: verify the two suspected data errors with Jeff before quoting these numbers outside the team.**

### G7 · Figma ↔ code sync workflow — the loop, recorded
**What is aligned** (practiced this week — recording the working process)
1. Source-of-truth split: **code** = behavior & shipped truth · **Figma** = authoring & ratification surface · **schema** = the contract both obey.
2. The loop: code→Figma via MCP (context, screens, evidence) → design authored/chosen in Figma (Iterations pages) → the chosen direction synced back to CSS/components → `npm run audit:cards` validates → HANDOFF + this doc updated in the same session.
3. Real components travel through Code Connect keys (15 `.figma.tsx` files → Hadouken + Treehouse Component Library); screens never hand-fake a component that exists.
4. Known block: **Miranda Sans missing from the Figma org** — Hadouken text overrides stay locked until DS uploads it.

**Why** — the loop was invented across sessions; unrecorded process is the first thing a team loses.
**Because of that** — any future session (or model) re-enters the loop from this record; deviations from the loop are review findings.

### G8 · Accessibility baseline — first bricks + the keyboard gap
**What is proposed**
1. Computed contrast (Evidence Plate E4): `--purple` on elevated = 4.44:1 **fails AA normal text** (feeds Q-08); red 4.67 and accent blue 4.78 are marginal → these hues never carry text below 11px without a luminance pairing.
2. AI signature marks must carry a **non-hue channel** (shape/position — the asterisk/tick/seal in the tile Iterations already comply); protan red-vs-purple separation is a known failure (Iterations V6 tension note).
3. Keyboard minimum: mode-tile rows = radiogroup with arrow-key nav · modals = focus trap + Esc · the L4 gate = explicit confirm, never default-focused.
4. This is a floor, not a program — a real audit is Punchcut-phase work.

**Why** — the E4 numbers are computed, not opinions; the keyboard rules are the cheapest 80%.
**Because of that** — new components inherit the floor; Q-08's hue decision must clear 4.5:1 on elevated before ratification.

---

## Drafted records — G9…G14 (typology session, 2026-07-16)

> Status: **DRAFT** — proposals from the Jul 16 card-typology working session, to ratify or amend.
> G9 **amends a DECIDED item (P3.1)**; the written reason required by the anti-drift rule is inside the record.

### G9 · Three templates, one anatomy — the Controls & Status merge (amends P3.1)
**What is proposed**
1. Card templates go from four to three: **Device / Control & Status / Content** — each a distinct design logic (object dossier · instrument panel · showcase).
2. The read/write line moves from the type system into a **mandatory per-card declaration**: `interactivity: read-only | writes`. Status is a control at rest; a control is status you can push.
3. R6 re-keys to the declaration: a card declaring read-only that renders a control component is a violation (the Weather catch survives the merge).

**Why** — written reason for amending P3.1: both of the registry's only [OPEN] boundary cases (weather, omenai) sat on the Status↔Controls line — the merge dissolves them; the codebase already ships exactly three visual vocabularies (device-card.css · stat/control · tiles/list); both old types drill to the same modal species; and takeover flips a control card into a status card at runtime — under one template that is a property flip, not a re-classification.
**Because of that** — schema `types` merges, instances remap, `audit-cards.mjs` re-keys R6; the remotePlay hybrid (control + live media) remains unsolved and stays flagged.

### G10 · Card independence — governance is vertical only
**What is proposed**
1. No card governs a sibling card, ever. Coupling either descends into one card's own modal (L3) or ascends above the cards (profile / page-level agent).
2. Relationship grades 2/3 (P7) remain a **theoretical ceiling**, not a build target.

**Why** — the 1:1 converged on it ("cards in the same section should not have manageability over each other" — agreed); every surveyed shipped product expresses governance as marks on the governed control, never as sideways card hierarchy; sideways governance makes layout carry state.
**Because of that** — OMEN AI's prominence is explicitly NOT this question: **exposure** (forefront-ness — marketing, reversible) and **altitude** (place in the control architecture — structural) are decoupled and parked on the register (Q-09, with the legal-consent constraint recorded). Takeover rendering of governed cards = Q-13.

### G11 · Two scopes on the card face — global control vs key control
**What is proposed**
1. The title row hosts at most **one optional global element** (card-scope): nav link XOR status chip XOR a single binary toggle XOR kebab; overflow collapses into the kebab. ≥8px dead zone around it; the title row's composition stays stable across sizes.
2. **Key controls** (subject-scope, any width) always live in the content area.
3. The footer as a zone is abolished: view-all/CTA move to the global slot; the meta line dissolves — freshness renders beside the value it qualifies, attribution moves to the frame layer (G12), spec lines are body content.

**Why** — 6/19 shipping cards already put their one verb at title-right (WidgetShell `action`); every multi-segment control in the product is too wide for the title row (PowerMode, Profile, Weather); scope-based placement is teachable: global = about the card, key = about the subject.
**Because of that** — list cards satisfy the counter law with a count or a "+N" overflow tile; "Apply" in the title row stays a schema violation.

### G12 · Two-scope states — content states in place, card states are FORMS
**What is proposed**
1. **Content states** (loading / empty / stale / no-signal / error / health) render in the footprint of the content they qualify. No status zone exists; controls self-report their own state.
2. **Card states** (managed · locked · offline · spotlight · edit-selection) are **forms, not labels** — a whole-card mode readable from across the room. Each form is one recipe of four coordinated changes: ① frame signal — stroke + corner badge riding the card edge (the form's *nameplate*, not the form itself; scrim at full takeover) ② surface treatment (dim / scrim / glow) ③ control behavior (inert-but-visible / locked / frozen) ④ value behavior (live under management · last-known + stamp when offline). Recipes are defined once on the shell and inherited by all three templates — never improvised per card. Implementation: card wrapper hosts stroke/badge/glow; the face keeps its clip.
3. **A frame signal is a door, not a lamp**: activating it opens the canonical modal anchored and spotlit at the offending control. Escalation content→card only through the gates (undisplayed at this size · not rendered · multi-problem rollup).

**Why** — a label can be missed; a form cannot — trust states must be unmissable (automation readable before and while it acts). Position encodes scope (inside = about the content, frame = about the card); OS notification badges set the precedent that system chrome never invades content art; the governance strip's three jobs split cleanly (glance signal → frame · naming → badge label / in-place chip · release → badge-as-door), and the door rule preserves discoverability at sizes that cannot show the problem in place.
**Because of that** — two guardrails: a form never changes geometry (size, position, slot structure — grid stability sits above forms), and only whole-card facts earn a form (one signed slider = a content-scope chip, never a card form). The three disableds are three *forms* sharing the inert-controls ingredient with distinct nameplates + treatments (managed / locked / offline); stroke arbitration = Q-11.

### G13 · Badge grammar — position encodes scope, colors are caste-bound
**What is proposed**
1. **Content badges** (counter, NEW, promo) live inside the face — free layer, per-template representation.
2. **Card-state badges** ride the frame — shell vocabulary, identical across all three templates, with a size ladder: S = glyph only (never zero) · M+ = glyph + agent name · hover = enhancement only (never the sole channel) · click = full disclosure (who wrote / what else it holds / how to take it back).
3. Reserved color bands (AI purple + health red/amber/green) are **closed to content badges**, and promo gradients are closed to semantic badges. Badges carry their own backing surface — never bare glyphs gambling on art contrast.
4. Corner congestion resolves by the badge slot map: named positions, concurrency cap, priority arbitration.

**Why** — the two badge species must be tellable at a glance; without the color caste rule, the first third-party wallpaper pack can counterfeit a warning.
**Because of that** — armed's future-tense glyph = Q-10; narrow-breakpoint badge behavior = Q-12.

### G14 · Content template — freedom charter
**What is proposed**
1. Content cards are **free by default**; the floor is this list and nothing more:
   ① a title — visually optional on hero, always in the a11y tree; clamped lines + ellipsis; a scrim under any text on art
   ② one declared whole-tile interaction (launcher/navigate) — no mixed gestures
   ③ registered sizes + states, including the missing-art fallback
   ④ media color isolation — art never colors chrome or the frame
   ⑤ target sizes ≥24px
   ⑥ list subsets carry a count or a "+N" overflow tile
2. **Hero = a declared unique exception**: one per curated page (it is the anchor), ≤2 CTAs with clear primary/secondary.
3. Template follows **subject**, not page: pages have a *dominant* template (Play ≈ content, Perform ≈ control & status), the dashboard is deliberately mixed by pinning — the mix ratio, not new frames, is what makes pages feel different.

**Why** — content's job is merchandising and identity; the free layer IS the product here. An explicit license beats an undefined gap — the agency handoff needs the floor in writing. And the strict page mapping is already false in shipping code: QuickLaunch/GamePass/Deals are content cards living on the dashboard.
**Because of that** — content reviews check the floor only; everything not on the list is explicitly free.
