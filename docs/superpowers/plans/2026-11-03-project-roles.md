# Project Roles and Owner Gateway Implementation Plan

> Execute the owner-authorized phase three in assigned file scopes with focused regression tests; root integrates and independently reviews the result.

**Goal:** Separate store, factory and representative work permissions while preserving existing projects and adding the owner's fifth gateway for supervision, pricing and final approvals.

**Architecture:** Extend the existing per-project membership roles. A shared pure change policy checks complete snapshots on the server and at local write boundaries. Authenticated server responses establish the client's role; role data is never read from an imported project. The owner sees all five gateways, scoped participants see their own work gateway and common project/results services. Existing editor/viewer memberships retain ordinary historical behavior, with commercial evidence/defaults protected for the owner as explicitly requested.

**Tech Stack:** Existing browser ES modules, TypeScript API routes, SQLite/D1, R2 and generated shop-domain bundle.

**Spec / owner decisions:** The owner requested phase three in this chat, then explicitly assigned pricing to the owner and requested a fifth private entrance for supervision and approvals. Roles extend project sharing, not account-global employment identities. Projects remain complete shared snapshots for offline calculations; this change limits UI destinations and modifications, and does not claim confidential redaction of downloaded project data.

## Authority matrix

| Role | Project changes | Navigation |
|---|---|---|
| owner / unshared local owner | All; pricing and final structure/customer/release approvals; membership management | Five gateways including oversight |
| store | Store catalog and own approval; derived invalidation of affected factory approval only | Store; shared results and synchronization |
| factory | Factory recipes and manufacturing inputs; own record approval; permitted manufacturing-derived changes | Factory; shared results and synchronization |
| rep | Survey, customer requirements, design and finish choices; measurement attestations | Representative; shared results and synchronization |
| editor (legacy) | Preserve ordinary guarded editing; also protect commercial MFG-09 evidence/defaults and their attachments for the owner | Prior work destinations; no new owner oversight authority |
| viewer (legacy) | Read only | Prior readable destinations |

Pricing terms, commercially authoritative defaults/field records, final approvals and membership are protected from new scoped roles. Cross-domain derived changes must be validated explicitly; unknown fields/roles fail closed.

Catalog memberships remain a separate resource. Existing readers stay readers; owner can grant store or factory catalog rights. Inventory actions require store/owner catalog authority; project membership alone grants no catalog authority.

## Global constraints

- Preserve old projects, fingerprints, records, shares and approvals; no bulk rewrite of real customer data.
- Recheck the exact authorized role and expected revision at publication to reject role change/revocation races.
- Shared projects with unavailable or unverified access are locked, never silently treated as locally owned.
- Protect direct links, apply/save, undo/redo, import and separate unit entry; trusted cloud installation is separate from an edit.
- Preserve the source snapshot at the chat evidence directory `phase3-baseline`; no Git initialization or deployment.

## Review focus

1. Forged full snapshots altering another domain, envelope attachments, final approvals or commercial defaults must be rejected.
2. Store technical changes may invalidate factory approval but may not forge approval or edit recipes.
3. Role reassignment/revocation during upload or project/account switching must not retain stale write privileges.
4. Legacy shares and local projects remain usable; migration preserves catalog readers and data.
5. Navigation filtering must also reject direct URLs and refreshed mounted pages; local side effects must obey capabilities.

## Tasks

- [x] Shared policy: add `public/kitchen-access-policy.js` and `tools/check-kitchen-access-policy.mjs`; validate complete canonical snapshots and domain-dependent changes.
- [x] Server: extend project/catalog role checks, metadata access response, exact-role publication guard, inventory/jobs permissions, catalog-reader migration and integration tests.
- [x] Client persistence: add access binding registry, authenticated refresh, fail-closed shared state, trusted install, commit/save/history/switch protection and sync/catalog sharing UI.
- [x] Navigation: add fifth owner gateway and oversight page; filter cards/search/routes and lock disallowed actions; protect external editors/device writes.
- [x] Verify: focused denial/allow/race/legacy tests, complete suite (192/192), isolated Chromium journeys for owner/store/factory/rep/viewer/editor and unavailable access, independent review and documentation.

**Completion evidence:** `docs/kitchen-studio/project-roles-phase3.md`; final test and browser logs in the chat evidence directory. Independent review findings covering failed cloud installation, draft loss, factory team access, scoped upload naming, attachment custody and legacy commercial evidence were addressed and covered by focused/full/browser checks as appropriate. No deployment or live migration was performed. The report records full-snapshot read access and bounded factory corner undo as explicit limits.

## Implementation ownership

- Policy agent: new shared policy and focused pure tests.
- Server agent: API routes, server libs/schema/new migration, generated-domain exports and server tests.
- Client agent: access state, project persistence/switch, sync/team UI and focused tests.
- Root: routing/editor/gateways/oversight, device-side guards, planning, browser verification and integration.
