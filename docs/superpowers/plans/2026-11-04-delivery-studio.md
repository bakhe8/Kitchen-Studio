# Installation and delivery studio

Authorized by the user's request to implement and test the complete installation/delivery journey.

## Objects and authority

Project → immutable manufacturing receipt → issued unit → inspection checks and append-only events. The visual is an explicitly labelled schematic of dimensions returned by the receipt API; the open local design cannot substitute for that snapshot. Existing customer acceptance is an owner-recorded handover, not an authenticated customer signature.

## Implementation

- [x] Extend real jobs API with bounded shared observations and resolutions, preserving receipt scope, role checks, optimistic sequence checks, idempotency and existing readiness rules.
- [x] Gate installation and acceptance on unresolved blocking observations. Observation and resolution retain the current packed/installed state.
- [x] Build direct unit/check selection, normalized pins on the unit schematic, contextual inspection/note controls, and immediate actual-versus-nominal feedback.
- [x] Add subject/project/receipt/unit-scoped local drafts, explicit save, undo/redo, internal navigation protection, exact retry recovery, and stale-draft protection.
- [x] Connect the existing tracking route, workshop orders, receipt downloads and customer handover.
- [x] Test domain/API and controller behavior, then run an actual-browser journey against actual handlers with isolated test authentication/database/storage.
- [x] Run the complete existing check suite and browser bundle verification; record evidence and limitations.

## Interaction state machines

Persisted stage: issued → planned → passed → packed → installed → accepted. Failed QC adds an event and remains planned. Observe/resolve are self-transitions in packed or installed; open blocking observations reject install/accept. Recorded events are immutable.

Local draft: clean → editing → locally saved → submitting → acknowledged → clean. Validation failure retains raw values. Uncertain response retains the exact request ID/body for replay. Fresh snapshot with a changed sequence freezes an unrelated stale draft. Local undo/redo never calls the events API. A saved draft is not an installation or acceptance event.

Triggers: unit/check/pin selection; drawing click in add-note mode; keyboard check selection and center-pin alternative; field input; explicit save/submit. Rules: authoritative receipt identity, finite bounded coordinates, valid check target, nonblank bounded prose, explicit actual readings and existing tolerance constraints. Feedback: selected object and anchored pin, delta/pass state, dirty/saved/stale labels, concrete validation reason and chronological record. Loops: inspect→note→correct→resolve→reinspect. Modes are visibly labelled and cancellable; accepted units are read-only.

## Verification scope

Automated and browser operational testing does not constitute empirical testing with real installers/customers. The isolated browser fixture uses production handlers and domain rules with synthetic identities and in-memory D1/R2; it does not verify deployed OAuth/cloud infrastructure.
