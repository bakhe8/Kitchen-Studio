# Interaction Architecture Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the current Kitchen Studio implementation with the interaction-architecture specification without duplicating geometry, factory, save, or approval rules.

**Architecture:** Keep the existing domain functions as sources of truth. First normalize explicit width-edit semantics, then add a small intent/preview adapter consumed by the existing designer surfaces, and finally pin the 2400/800/400 journey and context-preservation behavior with source-bound tests.

**Tech Stack:** Browser-native JavaScript modules, HTML/CSS, Node.js assertion checks, existing `scripts/run-checks.mjs` test runner.

**Spec:** `docs/kitchen-studio/interaction-architecture-reconciliation-2026-11-04.md`

## Global Constraints

- Do not copy geometry, catalog, pricing, save, approval, or release rules into UI modules.
- Explicit width edits may alter a user's width lock but must not release measurement, appliance, model, or position constraints.
- A successful explicit width edit leaves the target width locked and preserves unrelated locks.
- Preview never persists; commit, project save, client approval, and production release remain distinct events.
- Drag, numeric entry, and buttons must resolve through the same intent and constraints.
- Cancelled, stale, or superseded sessions must not apply late results.

## Review Focus

- A personally width-locked target should accept an explicit edit while remaining locked.
- An appliance/model/site-protected target must remain uneditable through every input kind.
- A locked neighbor must never donate width to another unit.
- Cancel or late results must preserve the exact prior values and locks.
- Undo must restore target, donors, locks, and inherited relationships as one operation.

---

### Task 1: Normalize explicit width-edit semantics

**Files:**
- Modify: `public/kitchen-proposal-change.js`
- Modify: `public/kitchen-whole-plan-ui.js`
- Modify: `public/kitchen-view.js`
- Test: `tools/check-kitchen-whole-visit.mjs`
- Test: `tools/check-kitchen-view.mjs`

**Interfaces:**
- Consumes: existing `previewKitchenWidthChange(doc, unitId, deltaMm, options)`.
- Produces: `previewKitchenWidthChange(..., {explicitUserChange:true, inputKind, edge})`; successful candidates retain `locks.width=true` for the target.

- [x] **Step 1: Write failing tests** for a personally locked target edited explicitly; assert success, target lock retention, donor protection, and appliance-host rejection.
- [x] **Step 2: Run** `node tools/check-kitchen-whole-visit.mjs`; observed the expected personal-lock rejection before implementation.
- [x] **Step 3: Implement** explicit-edit options in `previewKitchenWidthChange` and pass them from both live UI callers; do not weaken `anchored()` or donor rules.
- [x] **Step 4: Run** `check-kitchen-whole-visit`, `check-kitchen-view`, and `check-kitchen-designer-studio`; all PASS.

**Follow-up correction:** the initial checks started with an already-pinned target and did not prove automatic → pinned. Added a failing regression in `check-kitchen-proposal-change`, then made `rearrange` pin only the explicitly edited target. Both lightweight and full previews now produce the same pinned candidate. Added full lock restoration to CAD undo checks and two-edit recovery coverage.

### Task 2: Add the shared interaction-intent adapter

**Files:**
- Create: `public/kitchen-interaction-intent.js`
- Create: `tools/check-kitchen-interaction-intent.mjs`
- Modify: `public/kitchen-whole-plan-ui.js`
- Modify: `public/kitchen-view.js`

**Interfaces:**
- Produces: `createInteractionSession(baseDoc)`, `previewInteractionIntent(doc, intent, session, {withEffects})`, `commitInteractionPreview(preview, session, currentDoc)`, and `cancelInteractionSession(session)`.
- Preview output exposes status, candidate, affected/protected objects, constraint reasons, evidence revisions, and effects status.

- [x] **Step 1: Add contract tests** for numeric/grip/button/scrub equivalence, superseded intent rejection, cancelled-session rejection, and base-revision mismatch.
- [x] **Step 2: Run and inspect the contract checks.** Eleven behavior cases pass. Implementation and tests were developed concurrently; no missing-module red run is claimed.
- [x] **Step 3: Implement the adapter** by delegating width geometry to `previewKitchenWidthChange`; do not persist inside the adapter.
- [x] **Step 4: Route both designer surfaces through the adapter** while preserving current copy and focus behavior.
- [x] **Step 5: Run the focused adapter and UI checks**; PASS.

### Task 3: Pin the 2400/800/400 acceptance slice

**Files:**
- Create: `tools/check-kitchen-interaction-slice.mjs`
- Modify: `docs/kitchen-studio/designer-studio-integration.md`

**Interfaces:**
- Consumes: Task 2 intent adapter and existing project commit/undo/redo APIs.
- Produces: one executable acceptance journey for valid resize, 2500 mm conflict, cancel, undo, save, and stale-result rejection.

- [x] **Step 1: Add the executable journey** with four 600 mm units; assert 600/800/400/600, affected-unit explanation, target lock, and one undo operation.
- [x] **Step 2: Add the 900 mm conflict case with the other widths pinned**; assert the prior candidate remains unchanged and the 100 mm deficit is explained. A flexible 400 mm storage donor can otherwise shrink to 300 mm under the real catalog.
- [x] **Step 3: Add cancellation, stale result, save snapshot, and redo assertions.** Staleness is also tested for a lock-only document change that retains the same kitchen reference.
- [x] **Step 4: Run** `node tools/check-kitchen-interaction-slice.mjs`; both journeys PASS.
- [x] **Step 5: Update the integration document** with exact proven behavior and evidence limits.

### Task 4: Preserve object context across detail transitions

**Files:**
- Modify: `public/kitchen-whole-plan-ui.js`
- Modify: `public/kitchen-viewport.js`
- Modify: `public/kitchen-editor.js`
- Modify: `public/kitchen-workshop-ui.js`
- Test: `tools/check-kitchen-designer-studio.mjs`
- Create test: `tools/check-kitchen-designer-return.mjs`

**Interfaces:**
- Consumes: stable unit ID, view ID, per-view camera/frame state, and opener element.
- Produces: selection/view/focus restoration after detail, interior, and view changes.

- [x] **Step 1: Add behavioral tests** for detail open/close focus, interior return, view switch selection, per-view camera restore, and two-stage Escape.
- [x] **Step 2: Run** `node tools/check-kitchen-designer-studio.mjs`; observed the new Escape detail-layer assertion fail before its fix. Existing ordinary detail-button focus already passed and was retained.
- [x] **Step 3: Implement minimal context snapshots and restoration** without duplicating project state. A one-use session token connects the separate unit page to the designer; project/unit mismatches discard it.
- [x] **Step 4: Run the designer and return checks**; PASS. The real workshop router and unit save/cancel functions run under small DOM/location harnesses; full editor boot in a browser is not claimed.

### Task 5: Final reconciliation verification

**Files:**
- Modify: `docs/kitchen-studio/interaction-architecture-reconciliation-2026-11-04.md`
- Modify: `docs/kitchen-studio/designer-studio-integration.md`

**Interfaces:**
- Consumes: Tasks 1–4 evidence.
- Produces: truthful implemented/partial/pending status for every reconciliation row.

- [x] **Step 1: Run all focused interaction checks**; 13/13 scripts pass. Exact commands and limits are recorded in `docs/kitchen-studio/interaction-reconciliation-verification-2026-11-04.md`.
- [ ] **Step 2: Full `npm test` not run in this change.** Verification was narrowed to the modified domain, UI, routing, project persistence, and shared move paths. This is not evidence that every project check passes.
- [ ] **Step 3: Browser journeys not completed.** A temporary page using the real source and fixture was prepared, but both available browsers returned connection refused for the local preview. Mouse/keyboard/reduced-motion/narrow-layout browser checks and real-device/technician acceptance remain separate gates.
- [x] **Step 4: Update the reconciliation matrix** from evidence only.

## Execution decisions

- `baseRevision` is a local identity token for immutable documents; passing `currentDoc` at commit is mandatory. The source provides no aggregate measurement revision, so `measurementRevision` is explicitly `null` instead of inventing one.
- `explicitUserChange:false` remains a supported automatic/system path and does not pin the target. User-facing width callers always pass `true`.
- The adapter does not save. Source identity, role, budget, cross-window storage and production approval checks remain at their existing boundaries.
- Lightweight previews cannot commit until full effects have been computed. Unknown prices remain unknown.
- Context return required three existing navigation modules in addition to the original planned controller. No change to the saved project schema or `kitchen-project.js` was needed.
- New adapter tests were authored concurrently with implementation; observed red/green regressions are the target pin, draft-recovery pin, and Escape detail-layer cases. No unobserved test failure is reported as evidence.
