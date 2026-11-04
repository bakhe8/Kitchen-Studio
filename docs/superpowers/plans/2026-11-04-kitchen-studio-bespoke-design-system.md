# Kitchen Studio Bespoke Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Measured Workshop design system and migrate every Kitchen Studio interface to its semantic color, purposeful shape, and unified visual-interaction contracts.

**Architecture:** A central foundation stylesheet owns semantic tokens and safe global behavior. A generated inventory and policy checker define coverage and system-native status. Feature families consume the contracts locally during migration; only after legacy rules are retired are repeated component rules consolidated centrally.

**Tech Stack:** Static HTML/CSS, browser-native JavaScript ES modules, Node.js project checks, Codex in-app browser verification.

**Spec:** `docs/superpowers/specs/2026-11-04-kitchen-studio-bespoke-design-system-design.md`

## Global Constraints

- Arabic-first and RTL by default.
- Preserve business logic, persistence, project formats, geometry, APIs, SVG technical drawings, and the studio mark.
- Keep Tahoma/Arial initially; add no external font dependency.
- Normal text contrast ≥ 4.5:1; large text and essential non-text indicators ≥ 3:1.
- Principal and coarse-pointer targets ≥ 44 × 44 px.
- Visible focus uses a high-contrast treatment of at least 3 px.
- State must never rely on color alone.
- Primary workflows remain usable at 200% zoom.
- Respect `prefers-reduced-motion: reduce`.
- Preserve the current unsupported-small-device route.
- No deployment, publishing, framework migration, or API change.

## Review Focus

- A migrated screen beside an unmigrated screen must retain correct masthead, focus, dialog, overlay, and z-index behavior; pinned by Task 3 mixed-shell checks.
- Material swatches and technical palettes must survive raw-color policy checks through explicit allowlisting; pinned by Task 2 allowlist checks.
- Arabic labels, arrows, anchored menus, and keyboard order must remain correct in RTL; pinned by browser journeys in Tasks 3–8.
- Factory-density controls must retain 44 px hit areas without losing scan density; pinned by Task 6 coarse-pointer assertions.
- Proposal, production, report, and delivery print output must not inherit inappropriate screen surfaces or shadows; pinned by Task 7 print-style checks.

---

### Task 1: Foundation Tokens and Design-System Entry Point

**Files:**
- Create: `public/kitchen-design-system.css`
- Modify: `public/index.html`
- Create: `tools/check-kitchen-design-foundation.mjs`

**Interfaces:**
- Produces: semantic CSS custom properties prefixed `--ks-`; safe base focus, reduced-motion, disabled, selection, and surface rules.
- Consumes: existing `public/index.html` stylesheet loading order.

- [ ] Write `tools/check-kitchen-design-foundation.mjs` assertions that require the central stylesheet link before feature CSS, required semantic token families, 3 px focus, reduced-motion handling, and no selector-level feature component overrides.
- [ ] Run `node tools/check-kitchen-design-foundation.mjs`; expect failure because the foundation file and link do not exist.
- [ ] Create `public/kitchen-design-system.css` with structural, operational, spacing, radius, border, elevation, motion, typography, density, target-size, and z-index tokens plus safe base behavior.
- [ ] Add the stylesheet link before feature styles in `public/index.html`.
- [ ] Run `node tools/check-kitchen-design-foundation.mjs`; expect PASS.
- [ ] Run `npm test`; expect 228/228 or the current expanded total to pass.

### Task 2: Inventory, Policy Checker, and Migration Manifest

**Files:**
- Create: `tools/build-kitchen-design-inventory.mjs`
- Create: `tools/check-kitchen-design-native.mjs`
- Create: `docs/design-system/inventory.json`
- Create: `docs/design-system/migration.md`
- Create: `docs/design-system/allowlist.json`
- Create: `tools/check-kitchen-design-inventory.mjs`

**Interfaces:**
- Consumes: `--ks-*` tokens from Task 1; all `public/*.css`, `public/*.js`, and `public/index.html` references.
- Produces: deterministic interface/style inventory, family manifest, raw-value allowlist, and `checkFile(path)` policy result for later tasks.

- [ ] Write inventory tests requiring counts for routes/screens/components/stylesheets, classification into field/design/factory/presentation/operations, deterministic ordering, and no missing CSS file from the source directory.
- [ ] Write policy tests requiring rejection of an unapproved raw action/complete/attention/danger color, arbitrary radius/shadow/transition/focus style, and acceptance of a documented material-swatch allowlist entry.
- [ ] Run both check files; expect failure because generators and policy checker do not exist.
- [ ] Implement inventory generation and `checkFile(path)` with precise diagnostics and allowlist support.
- [ ] Generate `inventory.json` and the prioritized migration manifest.
- [ ] Run both check files; expect PASS and recorded coverage totals.
- [ ] Run `npm test`; expect full suite PASS.

### Task 3: Field and Survey Family

**Files:**
- Modify: `public/kitchen-visit-start.css`
- Modify: field/survey CSS listed by the generated manifest, including `kitchen-survey-entry.css`, `kitchen-survey-wall-sheet.css`, `kitchen-survey-walk.css`, `kitchen-wall-ink.css`, `kitchen-outline-walk.css`, `kitchen-field.css`, and `kitchen-survey-notebook.css`
- Create: `tools/check-kitchen-design-field.mjs`
- Create: `docs/design-system/qa-field.md`

**Interfaces:**
- Consumes: Task 1 tokens and Task 2 policy/inventory.
- Produces: system-native field-density patterns, measurement/drawing linkage states, notices, forms, and mixed-shell compatibility.

- [ ] Write field-family checks for token adoption, 44 px targets, non-color-only next/complete/error states, stable focus, reduced motion, and the visit-start reference state matrix.
- [ ] Run `node tools/check-kitchen-design-field.mjs`; expect failure on legacy declarations/states.
- [ ] Migrate the manifest's field/survey styles to Measured Workshop contracts, preserving selectors and behavior.
- [ ] Run field checks and Task 2 native policy; expect PASS for the entire field family.
- [ ] Verify browser journeys for empty, focus, partial, complete, invalid, perimeter dialog, 768 px, 200% zoom, keyboard order, RTL anchoring, console, and mixed navigation to an unmigrated design screen.
- [ ] Save before/after evidence and `qa-field.md`; require no P0–P2 findings.
- [ ] Run `npm test`; expect full suite PASS.

### Task 4: Design and Spatial Editing Family

**Files:**
- Modify: design/CAD/shelf/finish CSS listed by the manifest, including `kitchen-designer-studio.css`, `kitchen-finish-studio.css`, `kitchen-workspace-ui.css`, `kitchen-design-pages.css`, `shelf-planner.css`, and `shelf-dock.css`
- Create: `tools/check-kitchen-design-spatial.mjs`
- Create: `docs/design-system/qa-spatial.md`

**Interfaces:**
- Consumes: Task 1 tokens, Task 2 policy, and field-family shell patterns from Task 3.
- Produces: unified canvas selection, inspector, command rail, tool palette, dimension, handle, and precision-control contracts.

- [ ] Write spatial checks for canvas/inspector selection linkage, action-semantic outline, tool active/pressed/focus states, 44 px hit areas around compact glyphs, and palette/dialog layering.
- [ ] Run spatial checks; expect failure on legacy styling.
- [ ] Migrate design/spatial styles without changing geometry or event behavior.
- [ ] Run spatial and native-policy checks; expect PASS.
- [ ] Verify browser journeys for object selection, dimension editing, view modes, undo/redo, menus, dialogs, 768 px, 200% zoom, RTL, and console.
- [ ] Save evidence and `qa-spatial.md`; require no P0–P2 findings.
- [ ] Run `npm test`; expect full suite PASS.

### Task 5: Catalog and Defaults Family

**Files:**
- Modify: catalog, library, device, defaults, and material CSS from the manifest
- Create: `tools/check-kitchen-design-catalog.mjs`
- Create: `docs/design-system/qa-catalog.md`

**Interfaces:**
- Consumes: Task 1 tokens, Task 2 allowlist/policy, and shared form/table patterns.
- Produces: system-native catalogs, swatches, imports, filters, tables, readiness states, and empty/loading/error states.

- [ ] Write checks for semantic readiness/import states, swatch allowlisting, form/table focus, compact row targets, and non-color-only selection.
- [ ] Run catalog checks; expect failure.
- [ ] Migrate catalog/default/library styles while preserving material and user-color data.
- [ ] Run catalog and native-policy checks; expect PASS.
- [ ] Verify browser journeys for empty catalog, import, filter, selection, readiness attention, invalid data, 768 px, 200% zoom, RTL, and console.
- [ ] Save evidence and `qa-catalog.md`; require no P0–P2 findings.
- [ ] Run `npm test`; expect full suite PASS.

### Task 6: Factory, Production, Inventory, and Workshop Family

**Files:**
- Modify: factory/production/inventory/workshop CSS from the manifest, including `kitchen-factory-pages.css`, `kitchen-production-row.css`, and `kitchen-workshop.css`
- Create: `tools/check-kitchen-design-factory.mjs`
- Create: `docs/design-system/qa-factory.md`

**Interfaces:**
- Consumes: foundation tokens, native policy, catalog patterns, and factory density aliases.
- Produces: compact semantic rows, capacity/status cells, conflict/blocked states, bulk actions, and safe destructive controls.

- [ ] Write checks for factory-density target boxes, status semantics, conflict/blocked distinction, destructive morphology, table focus, and coarse-pointer hit areas.
- [ ] Run factory checks; expect failure.
- [ ] Migrate factory/production/workshop styles with no domain or data-flow changes.
- [ ] Run factory and native-policy checks; expect PASS.
- [ ] Verify browser journeys for ready, warning, conflict, blocked, disabled, bulk selection, destructive confirmation preparation, keyboard order, coarse pointer, 200% zoom, RTL, and console.
- [ ] Save evidence and `qa-factory.md`; require no P0–P2 findings.
- [ ] Run `npm test`; expect full suite PASS.

### Task 7: Proposal, Review, Report, and Delivery Family

**Files:**
- Modify: proposal/quote/review/report/delivery CSS from the manifest, including `kitchen-proposal-ui.css`, `kitchen-stage-review.css`, and `kitchen-delivery-studio.css`
- Create: `public/kitchen-design-print.css`
- Create: `tools/check-kitchen-design-presentation.mjs`
- Create: `docs/design-system/qa-presentation.md`

**Interfaces:**
- Consumes: foundation tokens and presentation-density patterns.
- Produces: customer-facing hierarchy, approval/decision trace, print-safe surfaces, and export-safe state rendering.

- [ ] Write presentation checks for decision-state semantics, customer-facing hierarchy, print media removal of screen shadows/backgrounds, technical line preservation, and export-relevant content visibility.
- [ ] Run presentation checks; expect failure.
- [ ] Migrate presentation styles and add the dedicated print stylesheet.
- [ ] Run presentation and native-policy checks; expect PASS.
- [ ] Verify browser journeys and print previews for proposal, approval, report, production drawing, and delivery artifacts at desktop, 200% zoom, RTL, and console.
- [ ] Save evidence and `qa-presentation.md`; require no P0–P2 findings.
- [ ] Run `npm test`; expect full suite PASS.

### Task 8: Operations, Supporting Tools, and Final Consolidation

**Files:**
- Modify: remaining operations/support CSS from the manifest, including saved projects, versions, gateways, maintenance, oversight, backup/sync, and assist surfaces
- Modify: `public/kitchen-design-system.css`
- Update: `docs/design-system/inventory.json`
- Create: `docs/design-system/foundations.md`
- Create: `docs/design-system/components.md`
- Create: `docs/design-system/patterns.md`
- Create: `docs/design-system/qa-matrix.md`
- Create: `tools/check-kitchen-design-complete.mjs`
- Create: `docs/design-system/qa-final.md`

**Interfaces:**
- Consumes: every preceding family contract and generated coverage inventory.
- Produces: 100% migration coverage, consolidated central component layers, final documentation, and completion gate.

- [ ] Write completion checks requiring every inventoried interface to be classified and system-native, no undocumented legacy compatibility alias, no unapproved raw semantic styling, all family QA files passed, and required documentation present.
- [ ] Run completion checks; expect failure while operations and consolidation remain.
- [ ] Migrate remaining operations/support styles.
- [ ] Consolidate repeated stable primitives/patterns into declared central layers only after their legacy consumers are removed or placed below them.
- [ ] Remove obsolete compatibility declarations and regenerate inventory/migration status.
- [ ] Write foundation, component anatomy/state matrices, patterns, migration, and QA-matrix documentation.
- [ ] Run completion and all family policy checks; expect PASS with 100% inventoried coverage.
- [ ] Verify representative cross-family navigation, dialogs, overlays, focus, 768 px, 200% zoom, RTL, reduced motion, and console.
- [ ] Save final before/after evidence and `qa-final.md`; require no P0–P2 findings.
- [ ] Run `npm test`; expect full suite PASS.

## Self-review result

- Spec coverage: all foundation, semantic, morphology, interaction, density, accessibility, migration, documentation, print/export, and consolidation requirements map to Tasks 1–8.
- Shared interfaces: Task 1 tokens feed all later tasks; Task 2 inventory/policy feeds Tasks 3–8; each family contributes stable patterns to Task 8 consolidation.
- Risk containment: each functional family is independently runnable and QA-gated before consolidation.
- TDD: every implementation task starts with a failing structural/policy test and ends with focused plus full-suite verification.
- Repository constraint: this workspace currently has no `.git` metadata, so commit steps are intentionally omitted; verification artifacts and the plan ledger must preserve execution history instead.
