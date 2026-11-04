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

### Task 2: Add the shared interaction-intent adapter

**Files:**
- Create: `public/kitchen-interaction-intent.js`
- Create: `tools/check-kitchen-interaction-intent.mjs`
- Modify: `public/kitchen-whole-plan-ui.js`
- Modify: `public/kitchen-view.js`

**Interfaces:**
- Produces: `createInteractionSession(baseRevision)`, `previewInteractionIntent(doc, intent, session)`, and `commitInteractionPreview(preview, session)`.
- Preview output exposes status, candidate, affected/protected objects, constraint reasons, evidence revisions, and effects status.

- [ ] **Step 1: Write failing contract tests** for numeric/grip/button equivalence, superseded intent rejection, cancelled-session rejection, and base-revision mismatch.
- [ ] **Step 2: Run** `node tools/check-kitchen-interaction-intent.mjs`; expect missing-module failure.
- [ ] **Step 3: Implement the adapter** by delegating width geometry to `previewKitchenWidthChange`; do not persist inside the adapter.
- [ ] **Step 4: Route both designer surfaces through the adapter** while preserving current copy and focus behavior.
- [ ] **Step 5: Run the focused adapter and UI checks** and expect PASS.

### Task 3: Pin the 2400/800/400 acceptance slice

**Files:**
- Create: `tools/check-kitchen-interaction-slice.mjs`
- Modify: `docs/kitchen-studio/designer-studio-integration.md`

**Interfaces:**
- Consumes: Task 2 intent adapter and existing project commit/undo/redo APIs.
- Produces: one executable acceptance journey for valid resize, 2500 mm conflict, cancel, undo, save, and stale-result rejection.

- [ ] **Step 1: Write the failing journey** with four 600 mm units; assert 600/800/400/600, affected-unit explanation, target lock, and one undo operation.
- [ ] **Step 2: Add the 900 mm conflict case**; assert the prior candidate remains unchanged and the 100 mm deficit is explained.
- [ ] **Step 3: Add cancellation, stale result, save snapshot, and redo assertions.**
- [ ] **Step 4: Run** `node tools/check-kitchen-interaction-slice.mjs`; fix only contract gaps revealed by the journey.
- [ ] **Step 5: Update the integration document** with exact proven behavior and evidence limits.

### Task 4: Preserve object context across detail transitions

**Files:**
- Modify: `public/kitchen-whole-plan-ui.js`
- Modify: `public/kitchen-designer-studio.js`
- Test: `tools/check-kitchen-designer-studio.mjs`

**Interfaces:**
- Consumes: stable unit ID, view ID, per-view camera/frame state, and opener element.
- Produces: selection/view/focus restoration after detail, interior, and view changes.

- [ ] **Step 1: Write failing tests** for detail open/close focus, interior return, view switch selection, per-view camera restore, and two-stage Escape.
- [ ] **Step 2: Run** `node tools/check-kitchen-designer-studio.mjs`; verify the new cases fail for the intended gaps.
- [ ] **Step 3: Implement minimal context snapshots and restoration** without duplicating project state.
- [ ] **Step 4: Run the focused check** and expect PASS.

### Task 5: Final reconciliation verification

**Files:**
- Modify: `docs/kitchen-studio/interaction-architecture-reconciliation-2026-11-04.md`
- Modify: `docs/kitchen-studio/designer-studio-integration.md`

**Interfaces:**
- Consumes: Tasks 1–4 evidence.
- Produces: truthful implemented/partial/pending status for every reconciliation row.

- [ ] **Step 1: Run all focused interaction checks** and record exact commands/results.
- [ ] **Step 2: Run** `npm test`; expect every project check to pass.
- [ ] **Step 3: Verify representative browser journeys** for mouse, keyboard, reduced motion, and narrow layout; do not claim touch-device or technician acceptance without those tests.
- [ ] **Step 4: Update the reconciliation matrix** from evidence only.
