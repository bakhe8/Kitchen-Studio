# Measured Workshop final source review

**Status: source migration and final documentation are implemented; browser, full-suite and final acceptance are pending. Task 8 remains incomplete. Final acceptance: PENDING.** No new browser, screenshot, print/PDF review, full npm suite, inventory regeneration, Git operation or deployment was performed in this delegated scope. The current inventory continues to report legacy feature statuses and zero accepted system-native files; it must not be presented as 100% accepted migration.

## Scope and behavior

All nineteen Wave 8 styles consume the central semantic tokens. This includes saved projects, design versions, full-width forms, gateways, maintenance, oversight, drawers, photo tools, scoped workspaces, shared shell, site/stage/studio/tablet layouts, workshop navigation and the kitchen editor. Existing selectors, route/device-width behavior, business logic, persistence, geometry, project formats, APIs, studio mark and handlers remain owned by the existing features.

The central foundation adds safe low-specificity `ks-primitives`, typography/density/morphology/layer tokens and explicit dark/photo semantics. Feature state rules remain unlayered because existing specificity and narrow/container resets still matter. Local semantic aliases are documented in `foundations.md`; no alias grants a policy exemption. Original material/finish/hardware preview palettes and static required/measured/depth-plane technical colors have exact, explained allowlist entries. Interactive state does not receive a material exception.

Saved/delete/backup, assist warning/error/conflict/completion, maintenance ticket closure, oversight ready/attention/stale and photo selected states gain non-color cues. Sync connection messages remain neutral information because their current controller emits text rather than an authoritative machine-readable status. Styling does not invent successful uploads or alter recovery guards.

## Source verification

RED: `node tools/check-kitchen-design-complete.mjs` was created and run before migrating Wave 8. It exited 1 at `public/kitchen-assist.css consumes semantic foundation`.

The default gate checks every current stylesheet and supported JavaScript styling sink against native policy; complete Wave 8 coverage; inventory classification/file inclusion; required documentation and honest family QA boundaries; actual operational state contracts; focus/targets/motion; exact alias documentation; unchanged unsupported-device route; and safe central component ownership. It does not certify live contrast, geometry, focus lifecycle, screen-reader output or print parity. Inventory hash freshness is a separate generated-artifact gate, not silently bypassed or manually edited here.

The strict `--acceptance` mode additionally requires an explicit QA-backed system-native status mechanism and final accepted browser/full-suite evidence. It is expected to remain RED while those gates are pending. A passing source gate and a failing acceptance gate describe different evidence; they are not contradictory.

## Remaining acceptance work

Execute the full `qa-matrix.md` against final integrated source. Cover saved open/delete/cancel/error, backup state transitions, sync offline/unknown/retry/confirmation, versions and revision trace, gateways and return navigation, assist conflict/error/complete, maintenance open/repaired/reviewed/closed tickets, oversight readiness/unknown/stale and photo reference/included/active annotation visibility.

Cross-family journeys must verify actual cascade and global/local stacking, dark/light focus, keyboard order and dialog lifecycle, RTL anchors/arrows, 768px compact layouts, 200% zoom, coarse-pointer rectangles, reduced motion, console and print/export parity. Resolve all P0–P2 findings before acceptance. Then regenerate inventory, verify hashes, run the complete project suite and record the actual results with build/source provenance. Do not convert legacy inventory statuses by hand or infer acceptance from zero native-policy diagnostics.

## Focused verification result

PASS: the final source completion gate audits all 64 CSS and 298 JavaScript files, with zero supported-sink policy diagnostics. PASS: native-policy regression fixtures, foundation, field, spatial, catalog, factory and presentation design gates. The five family gates were rerun against the shared shell/token consolidation.

PASS: existing focused design-versions, gateways, backup-status, unreadable-backup, workshop-navigation, workshop-photo, photo-plane, photo-export, oversight-studio, assist-ui, assist-decisions, scoped-interior-ui, scoped-drawers-ui and workshop-sync-codec checks. These exercise actual model/controller/mounted export behavior; they do not replace browser acceptance. The complete maintenance-studio process also exited 0 after its API recovery, two-ticket draft, stale warranty, role isolation, storage failure, return-navigation and scoped-portal groups passed. SQLite-based controller tests emit Node's experimental SQLite warning.

The expanded native checker was observed RED on false style-sink detection before its correction, then GREEN with fixtures preserving rejection of real inline state colors, static embedded CSS literals, arbitrary generated blocks and raw conditional branches. It now audits static standalone customer/drawing/change-sheet CSS. Exact material/technical/photo exceptions retain authored source values. Product color sinks and generated technical palette assembly are reviewed data contracts; numeric geometry expressions are not disguised color exceptions.

PASS: additional existing drawing-book, proposal-presentation, report-scene, report-preview, sheet-targets, survey-studio-model (16 behavior checks) and finish-desk checks. The default completion gate was rerun after the final semantic/focus source review and passed. The strict `--acceptance` command was run and exited 1 at the expected 0-versus-362 accepted-native inventory assertion. This is the deliberate unfulfilled acceptance boundary, not a passing visual gate.

## Parent integration evidence

The integrated source was exercised in the Codex in-app browser with cache disabled after all family migrations:

- Visit start at 1280 × 720: central tokens loaded, no horizontal overflow, empty/active measurement state rendered, console errors/warnings empty.
- Field journey: entered 3600 × 4200 × 2700 mm, reached `٣ من ٣ مقاسات`, opened the live survey workspace, and confirmed the drawing, wall list, controls, focus hierarchy, and fixed action footer rendered together.
- Spatial journey: opened `step=whole`; 3D room, drawing toolbar, wall cards, inspector and action surfaces rendered without document overflow.
- Catalog journey: opened `step=template`; form, attention/readiness notice, catalog actions and lists rendered with their semantic hierarchy.
- Factory journey: opened `step=production`; dark factory masthead, review state, gate summary, production actions and empty inventory state rendered without console errors.
- Presentation journey: opened `step=quote`; totals, review state, scope controls and customer-facing hierarchy rendered without document overflow.
- Operations journey: opened `step=home`; gateway cards and project continuation rendered at 1280 px and 768 × 900. The compact viewport had `scrollWidth === clientWidth === 768` and no vertical document overflow.
- Print emulation on the production route produced white body paper, black body ink, transparent `.k-app` background, and visible `details.ps-ledger` content.
- The integrated browser console warning/error query returned an empty result.

The complete project suite was run after source consolidation: **237/237 checks passed**.

This is representative cross-family integration evidence, not exhaustive acceptance of every state in the 43-screen QA matrix. Invalid/error branches, every dialog lifecycle, every 200% zoom route, coarse-pointer journeys, and final PDF pagination remain explicitly pending.

Browser representative integration: PASS. Full suite: PASS (237/237). Exhaustive browser matrix: PENDING. Final acceptance: PENDING.

## Important source-review findings — corrected

All three findings were observed RED before implementation:

- Completion reported `kitchen-assist: effective reduced-motion press transform must be none`, observing the stronger unqualified active transform winning over the later, weaker reset.
- Native-policy regression rejected its previous acceptance of the reviewer's concatenated stylesheet bypass example.
- Foundation reported `muted normal text must meet 4.5:1 on --ks-canvas`.

All twelve Wave 8 press translations now participate only with `prefers-reduced-motion:no-preference`. The completion check evaluates the actual authored transform declarations for both motion preferences, including functional pseudo-class specificity and source order. Its regression fixture explicitly proves that the former lower-specificity reset loses; each production scope must yield `none` under reduced motion and retain `translateY(1px)` with no preference. This is a bounded source cascade model, not a browser rendering claim.

The embedded stylesheet scanner now resolves the entire bounded literal/identifier expression and every subsequent assignment/`+=` append. It audits concatenated CSS fragments, decodes literal escapes with source-position mapping, and rejects unknown runtime pieces. All three exact reviewer examples now fail with raw-color or dynamic-ownership diagnostics as appropriate. Additional fixtures preserve safe semantic concatenation/appends, reject runtime `+=`, and reject an escaped raw-color append. Existing customer/change-sheet/drawing-book/scoped-interior assemblies and the bounded index-generated gallery continue to pass.

`--ks-ink-muted` is now `#53666c`; the standalone export token snapshot was updated in the same source change. Foundation enforces at least 4.5:1 on the requested four surfaces. Measured ratios are canvas 5.54:1, inset 5.32:1, action-soft 5.22:1 and complete-soft 5.33:1. Completion enforces exact export/root parity.

Review-fix verification: PASS native, complete and foundation checks; PASS existing drawing-book, proposal-presentation, report-preview, report-scene and design-versions export/controller checks. No browser, full suite, inventory regeneration, Git operation or subagent was used for these corrections. Browser/print acceptance, full-suite evidence and final acceptance remain pending.

Follow-up scanner review: both the exact unsafe-append → sink → safe-reassignment example and the conditional safe-reassignment-before-sink variant were observed incorrectly passing before correction. Their regression assertions were RED. Ownership now fails closed on any reassignment after the declaration because source order cannot establish the value reaching the sink across time or conditional control flow. Static `+=` candidates remain accumulative and fully audited; no later assignment can discard earlier candidates. Both exact regressions now require a dynamic-ownership diagnostic, while current legitimate report/editor assemblies and safe static concatenation/appends remain supported. Native and complete checks passed after correction. Browser/full-suite/final acceptance boundaries are unchanged.

Cross-family focus review: the new effective-cascade regression was observed RED on all three dark contexts: desktop route header, `ws-head` and survey workbar. In each case the shared `.k-workshop.k-workshop :is(...,[tabindex]):focus-visible` rule won because its maximum attribute-branch specificity exceeded the earlier dark owner. The shared navigation stylesheet now supplies explicit, stronger dark ownership for desktop route controls, dark workspace headers and non-notebook survey workbars. The light survey overflow menu has a stronger normal-ring exception; light inputs and the light notebook bar retain the normal ring.

The completion regression matches the actual participating selectors from `kitchen-workshop.css`, `kitchen-workshop-nav.css`, `kitchen-stage-visit.css` and `kitchen-survey-notebook.css` to nine explicit DOM paths. It applies `index.html` stylesheet order, selector specificity, media width and declaration order. Cases cover the three dark contexts, compact light route header, light overflow menu, light notebook bar, light route picker, light header input and ordinary shared content. It also enforces at least 3:1 for the winning dark token against the structural header/workbar token (currently 7.08:1). This remains bounded source evidence; rendered focus visibility remains in the browser matrix. Complete, native and foundation checks passed. No Wave 7 file, browser, full suite, inventory generation or subagent was used.
