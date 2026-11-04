# Presentation, review and delivery — source verification

Date: 2026-11-04. Scope: Task 7 / Wave 7, all four stylesheets listed in `migration.md`, plus the main-app print entry point.

**Static source migration is implemented; browser and print-preview acceptance are pending. Task 7 remains incomplete.** This report does not grant system-native acceptance or establish absence of P0–P2 visual findings. No browser, screenshot, print/PDF export, inventory generation, full suite, Git operation or publication was performed in this delegated scope.

## Scope and preserved behavior

The proposal, quote, stage-review and delivery styles consume foundation colors, purposeful radii, surface elevation, motion, focus, target and layer contracts. Existing selectors, IDs, Arabic labels, project data, geometry, validation, price calculations, approval writes, receipts, permissions, persistence, handlers and standalone exported HTML were preserved. The delivery controller now emits minimal presentation attributes derived from its current draft, busy/error status, receipt progression and observation severity; these attributes do not enter persistence, API payloads or domain decisions.

The existing customer export still embeds `kitchen-customer-sheet-style.js`, portable drawing styles and its own print contract. The preview iframe continues to receive the same HTML as the download. `beforeprint` / `afterprint` disclosure handling and the authored SVG drawings remain in that export path. `kitchen-design-print.css` governs printing the main app; it is not inserted into portable customer or production exports.

| Surface | Static contract and evidence | Browser/print boundary |
| --- | --- | --- |
| Proposal drawing and inspector | Semantic action selection, underlined/double active controls, explicit danger/double errors and completion/solid transfer feedback; superseded proposal uses attention/dashed. Width stepper columns reserve 44 px each. Existing drawing coordinates, SVG strokes, non-scaling stroke behavior and large invisible grip hit strokes remain | Verify canvas/inspector selection correspondence, focus clipping, dimensions, coarse-pointer grips, long alternative names and 200% zoom |
| Quote workspace | Customer/project heading and larger total hierarchy remain. Saved information differs from attention/dashed preview/saving and danger/double invalid/stale states. Active objects, units, cost rows and services add an underlined double start boundary. Unknown price remains distinct from zero through unchanged controller/domain tests | Verify live status messages, object/source transitions, numeric typing, total comparison, pending edit guard and unknown-price approval guard |
| Approval and release | Actual `kf-sign-gates` `data-done` markers use completion/solid versus attention/dashed; structural blockers use danger/double. Existing textual approval stamp retains the approver name, waiting state or stale-data description. Generic stamp styling is informational because the stamp markup does not expose a separate machine-readable validity attribute. The existing approve action has a double boundary | Verify valid, waiting, changed-after-approval and blocked records with their actual text, names, revision trace, keyboard and release disclosure |
| Customer report preview | Neutral canvas and light header, semantic download action, dialog layer, full-screen geometry, external light-surround focus and 44 px actions. Dark project-heading action focus uses the bright dark-surround token | Verify iframe sizing, focus restoration/Escape, print button readiness and generated-report/download parity |
| Delivery and installation | Actual root emits clean/dirty/saving/submitting/stale/error state; typing updates its attribute without replacing the focused editor. Actual receipt stages emit `data-reached` derived from current state and preserve `aria-current=step`. Observation articles emit their real severity and preserve `data-resolved`. Blocking observations have danger/double treatment and dashed drawing pins; resolved observations use completion/solid and a heavier solid pin ring. Active selections use double boundary plus underline. Existing dimension text, measurement strokes and noted/draft dash patterns remain. Mounted tests bind clean/dirty/error/stale, reached stages and blocking article hooks to real controller/API output | Verify computed state treatment, receipt/state selection, unit isolation, pending drafts, observation/resolution and customer acceptance with actual authenticated browser flows |
| Main-app print | Narrow `!important` paper/ink baseline on body and transparent/inherited ink on `.k-app` wins later kitchen screen styles. Checker models actual shell/studio link order, specificity and important ranking for those properties. Print-only screen surface/shadow removal; fixed workshop and scroll containers become printable flow; actual production `.ps-canvas` is included. Ledgers, release review, receipt, observation content and technical drawings are retained. Interactive toolbar/download chrome is hidden with precise selectors, while cost-row buttons containing report data remain visible. Details use `::details-content` expansion with a descendant fallback, including actual production `details.ps-ledger` and `details.ps-capability`. Legacy `.ps-machine-book` has no current JS/HTML producer; it is conservatively included. Table headers repeat and drawing/table groups avoid unnecessary splits. SVG fill, stroke, stroke width, filter and material sample colors are not blanket-reset | Print proposal, quote, approval/release, production drawing, report and delivery artifacts; check all pages, closed details in the supported browser, long tables, page breaks, margins, background graphics off/on and PDF output |

Principal controls reserve at least 44 px in both axes, with explicit coarse-pointer label targets. Focus is 3 px with 2 px external offset. Bright focus appears only on the dark delivery header and dark quote project heading. Reduced motion disables nonessential control transitions and pressed transforms. These are source contracts, not computed accessibility or geometry measurements.

## Precise exceptions and compatibility

Seven exact exceptions were appended to `allowlist.json`; no wildcard, semantic-state, radius, shadow, motion or focus waiver was added:

- Five `technical-visualization` entries preserve delivery reference drawing data: `.dl-diagram-label` fill, `.dl-origin` stroke, `.dl-origin-label` fill, and `.dl-depth-hit` fill/stroke. Interactive focus, selected, blocked, draft and resolved graphics consume semantic tokens separately.
- Two `print-data` entries establish physical white paper (`#fff!important`) and black ink (`#000!important`) on `body[data-project-mode]` inside print media. Their exact values include the narrow important priority required to beat later screen styles.

The existing `--pd-*`, `--qs-*` and `--dl-*` color names remain as local compatibility mappings to `--ks-*` tokens. Work-height custom properties remain measured layout values. Stage review retains inherited `--ws-*` mappings owned by the workshop family. Final consolidation owns retirement of these aliases after its consumers are reviewed. Product/material colors and standalone customer report branding/palettes were not reclassified as UI state.

## RED → GREEN record

`tools/check-kitchen-design-presentation.mjs` was written before migration. Its initial run exited 1 at `public/kitchen-delivery-studio.css consumes foundation tokens`. After implementation, the focused gate passed for the entire four-file manifest and new print stylesheet.

A source-review RED/GREEN follow-up required neutral customer-preview surfaces rather than treating the class name “preview” as an unsaved/warning state. The assertion failed on `.customer-preview background: var(--ks-canvas)`, then passed after the neutral canvas/light header correction. A temporary variable-replacement defect in the local `--dl-white` reference was also corrected before delivery; the focused gate now rejects nested/malformed variable references introduced by that transformation.

The focused gate additionally checks actual approval-gate markers, 44 px stepper columns, target/focus/reduced-motion contracts, light/dark focus ownership, dialog layering, total/heading hierarchy, state morphology, actual main-app shell loading, print-only declarations, closed-disclosure content, absence of blanket SVG recoloring/content hiding, retained dimension stroke widths and noted/draft dash patterns, plus the standalone export's existing print/disclosure path.

Review follow-up addressed three P2 findings with additional RED → GREEN evidence. The mounted delivery check first failed because the actual root had no `data-state`; it now verifies real clean/dirty/error/stale output, reached stages and blocking-observation severity. The print cascade regression first resolved body background to the later screen value `#e9e9df`; it now resolves white paper/black ink through both body and `.k-app`. The actual-production-disclosure regression then failed on `details.ps-capability` print visibility; both that disclosure and `details.ps-ledger` now have print expansion and child fallback rules. The checker discovers these details hooks from the actual production controller rather than substituting the quote ledger.

Final reduced-motion review found that each Wave 7 enabled press selector had higher specificity than its later reduced-motion reset. A new effective-cascade fixture first failed with `translateY(1px)` winning under `reduce`. All four press transforms now participate only inside `prefers-reduced-motion:no-preference`; the non-motion pressed shadow reset remains available in both modes. The focused checker evaluates source order, media eligibility and functional `:is`/`:not` specificity, verifies normal enabled presses still move, verifies reduced-motion presses resolve to `none`, and verifies disabled/aria-disabled controls do not press-move. Presentation and four-file native checks passed after this correction. No operations-family file was changed for this follow-up; computed browser acceptance remains pending.

## Verification executed

All of the following focused commands passed:

```powershell
node tools/check-kitchen-design-presentation.mjs
node tools/check-kitchen-design-native.mjs
node tools/check-kitchen-design-native.mjs public/kitchen-delivery-studio.css public/kitchen-proposal-ui.css public/kitchen-quote-studio.css public/kitchen-stage-review.css public/kitchen-design-print.css
node tools/check-kitchen-design-native.mjs public/kitchen-delivery-studio.js
node tools/check-kitchen-proposal-presentation.mjs
node tools/check-kitchen-proposal-desk.mjs
node tools/check-kitchen-proposal-grips.mjs
node tools/check-kitchen-proposal-change.mjs
node tools/check-kitchen-bespoke-quote.mjs
node tools/check-kitchen-quote-preview.mjs
node tools/check-kitchen-quote-workshop.mjs
node tools/check-kitchen-approval-log.mjs
node tools/check-kitchen-release-dependencies.mjs
node tools/check-kitchen-production-preview.mjs
node tools/check-kitchen-production-workshop.mjs
node tools/check-kitchen-delivery-domain.mjs
node tools/check-kitchen-delivery-studio.mjs
node tools/check-kitchen-report-preview.mjs
node tools/check-kitchen-report-scene.mjs
```

Native audit: zero violations in all five stylesheets; 5 documented delivery drawing exceptions and 2 print exceptions. The existing delivery domain/API checks emitted Node's SQLite experimental-feature warning; their assertions passed. No test failure remains from these focused commands.

Existing functional checks exercise real proposal/quote records, save/reopen/undo/redo, immutable geometry, approval invalidation, explicit zero versus unknown prices, report sanitization and scope, preview/download identity, actual receipt selection, stale/invalid local drafts, API retry/lost-response recovery, account/permission isolation, blocking observation through customer acceptance and cleanup of closed editors. Those checks do not render the modified CSS.

## Remaining acceptance work

The parent task must run representative browser journeys in Arabic RTL at desktop, 768 px and 200% zoom, with keyboard-only and coarse-pointer use, reduced motion, long labels and console inspection. Capture before/after evidence and computed focus/contrast/target behavior, including navigation into adjacent unmigrated shell surfaces.

Print previews and exported artifacts remain required for proposal, approval/release, production drawing, report and delivery. Inspect every page for readable totals, preserved dimensions/technical lines/material data, visible names/revisions/receipts/observations, expanded disclosures, non-clipped scroll regions and print background/shadow removal. Closed-details support, nested scrolling, actual page fragmentation and printer/PDF output require browser evidence; the static policy cannot establish those outcomes. The generated inventory must be refreshed by the final consolidation owner, and the full suite remains with the parent task.
