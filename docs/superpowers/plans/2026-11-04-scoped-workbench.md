# Scoped Interior and Drawer Workbench Implementation Plan

> **For agentic workers:** Execute the assigned tasks with superpowers:executing-plans. The user explicitly authorized this continuation. Do not create a Git repository, publish, migrate live data, or overwrite the concurrent finish-studio work.

**Goal:** Enable real nested interior editing and customer packing/factory runner work while enforcing role-specific data access and preserving old projects.

**Architecture:** Retain canonical archives and add typed server operations with preview, exact-role/revision checks and existing publication idempotency. Project scope v2 splits customer requests from factory measurement fields; catalog scope remains v1. Technical solvers ignore commercial state and return strictly projected results.

**Tech Stack:** Existing JS domain/UI modules, TypeScript project API, D1/R2 publisher, Node/SQLite tests and isolated Chromium.

**Spec:** docs/kitchen-studio/scoped-workbench-phase5-design.md

## Global Constraints

- Rep sees approved final sale only; owner retains pricing/final approvals.
- No default zero for unknown contentsKg; null blocks runner readiness.
- Preserve nested interiors, hidden rows, attachments, records and approval history.
- Do not load global shelf-planner, device templates, old full cache or v1 scoped drafts in the scoped editor.
- Work against saved revision; unpublished local changes must be saved first.
- No Git repository, live migration/deployment or production data mutation.

## Review Focus

1. New factory measurements must not replace customer load/pin/permission.
2. Rep generic PATCH must not alter or delete hidden factory checks/bays indirectly.
3. Invalid legacy/nested interior must never fall back to a fresh layout.
4. Hidden prices, stock and private references must not alter technical output or leak through errors.
5. Role/revision changes during preview, upload and publication must reject stale work without losing local drafts.

## Tasks

- [x] **Data and solvers — phase2_review:** Modify kitchen-project-scope.js, kitchen-access-policy.js, kitchen-drawer-fit.js and kitchen-drawer-packing.js; export technicalOnly calculation options and safe drawer context, project scope v2, owned-slice preservation. Add focused sentinel, invariance, legacy no-op, unknown load and forged PATCH tests; run scope/policy/packing checks.
- [x] **Server operations — project_baseline:** Create kitchen-scoped-operations.js; extend projects API and generated exports. Implement exact command validation and projected preview, recompute-on-apply, expected revision/role CAS and request digest. Add success, stale/race/retry/forgery/old archive tests; run domain and project-sync tests sequentially when generator ownership is clear.
- [x] **Interior editor — verification_setup:** Create kitchen-scoped-interior-ui.js around mountShelfCanvas + pure scoped selection/partition operations. Expose mountScopedInterior(host,{unitId,label,plan,role,onSave,onClose,tell}) and hasPending disposer. Test nested preservation, edit/undo, immutable dimensions, malformed input, failed-save draft retention and no global storage.
- [x] **Scoped transport/workspace — root:** Update project scope identity to v2 while catalog remains1; add operation preview/apply transport and guards. Wire isolated interior + role-specific drawer/packing controls, permission editing and pending draft safeguards. Keep approved-sale behavior and safe global export.
- [x] **Integration — root/reviewers:** Run focused and complete checks with final source; isolated browser journey factory measurements -> rep preferences/groups -> technical preview/accept -> owner preservation; interior nested edit/reopen for both roles. Record unrelated concurrent source changes separately.
- [x] **Delivery — root:** Update current docs and phase4 limitations, save evidence and before/after source inventory; report actual verification and deployment limits.

Baseline: 741 source/document/config files copied to the chat evidence root phase5-baseline before implementation assignments were released.

Final verification: 212/212 checks passed (exit 0); primary Chromium role operation/recovery journey and 9 regression cases passed. Source-only error capture added after full run was syntax-checked and primary Chromium journey re-run. No production build, live migration, deployment, Git creation, or live customer mutation.
