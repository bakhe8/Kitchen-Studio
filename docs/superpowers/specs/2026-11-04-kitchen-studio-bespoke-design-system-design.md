# Kitchen Studio Bespoke Design System — Design Specification

Date: 2026-11-04  
Status: Awaiting owner approval  
Selected approach: Central design system with layered migration

## Intent

Create an original Arabic-first design system for every Kitchen Studio interface. The system must make color, geometry, motion, and interaction communicate meaning. It must emerge from the product's field-measurement, spatial-design, manufacturing, proposal, and delivery workflows rather than imitate a generic external design system.

The current project contains 62 CSS files (about 608 KB) and 298 JavaScript files (about 3.8 MB). Existing interfaces already share some navy, teal, paper, and technical-drawing motifs, but values and component states are repeated locally and inconsistently. The migration therefore has to centralize rules without forcing an unsafe all-at-once rewrite.

## Goals

- Give every color an explicit semantic role and prevent decorative reuse of state colors.
- Define a coherent shape grammar for work surfaces, controls, fields, overlays, alerts, and spatial objects.
- Make visual response and interaction state operate as one system: hover, focus, press, selection, completion, validation, warning, conflict, and disabled states must be perceivable and behaviorally consistent.
- Establish reusable design tokens and component contracts that cover all current Kitchen Studio workspaces.
- Preserve Arabic RTL behavior, technical drawing legibility, large pointer targets, keyboard access, and existing product behavior.
- Migrate by functional family with bounded visual and interaction verification after each family.
- Leave a documented system that future screens can adopt without inventing new colors, radii, shadows, or state behavior.

## Non-goals

- Rewriting business logic, persistence, project formats, geometry calculations, or APIs.
- Replacing existing technical drawings, production data, catalog content, or domain terminology.
- Converting the application to a new frontend framework.
- Making every surface visually identical; field work, CAD work, factory work, and customer presentation may use different densities within the same semantic system.
- Introducing ornamental animation or color that has no state or structural meaning.
- Removing the existing unsupported-small-device experience unless separately requested.

## Anti-goals

The result is considered a failure if it:

- looks like a generic component library with Kitchen Studio colors applied;
- uses teal, green, amber, or red inconsistently across workflows;
- relies on color alone to communicate state;
- rounds every container identically regardless of function;
- introduces motion that slows measuring, drawing, production, or review tasks;
- reduces the usable drawing area or makes dense professional screens unnecessarily spacious;
- produces a visually consistent shell while leaving hover, focus, pressed, selected, loading, success, error, and disabled behavior inconsistent;
- requires a simultaneous rewrite of all 62 existing style sheets.

## Constraints

- Arabic is the primary interface language and RTL is the default direction.
- Existing Tahoma/Arial fallbacks remain initially to avoid a network or font-packaging dependency. Typography may be revisited as a separately verified enhancement.
- Existing SVG technical drawings and the studio mark remain product assets, not decorative reconstructions.
- Pointer targets should remain at least 44 px for principal and coarse-pointer controls.
- Focus must remain visible with at least a 3 px high-contrast treatment.
- Reduced-motion preferences must disable nonessential translation and elevation animation.
- Each migration stage must preserve current behavior and pass the project's automated checks.
- Legacy selectors may temporarily map to new tokens, but new component styling must not add raw state colors or arbitrary radii.

## Approaches considered

### 1. Immediate full rewrite

Replace all existing styles at once. This maximizes theoretical consistency but creates excessive regression risk across a large, specialized interface surface and makes failures difficult to isolate.

### 2. Central system with layered migration — selected

Create the semantic foundation and common component contracts first, then migrate functional families one at a time. Legacy screens continue to operate while each migrated family becomes system-native. This approach provides real system coherence with bounded risk and measurable progress.

### 3. Global visual skin

Override colors, radii, and shadows globally without reforming component states. This is fast but cannot deliver visuo-interactive synergy or consistent behavior, so it was rejected.

## Design concept: The Measured Workshop

Kitchen Studio is a professional environment where measurements become decisions and decisions become manufactured objects. The visual language therefore combines:

- **Measured structure:** strong alignment, visible relationships, exact numeric emphasis, and calm technical surfaces.
- **Workshop materiality:** paper-white work surfaces, ink-navy structural chrome, teal operational focus, and restrained warm metal accents.
- **State traceability:** every interaction leaves an intelligible visual trace—focused, entered, checked, approved, warned, conflicted, or blocked.
- **Morphological purpose:** geometry communicates what an object is and how it behaves before the user touches it.

## Color semantics

All token names describe meaning, not hue. Exact values may be tuned during visual calibration, but their roles are fixed.

### Structural colors

- `--ks-canvas`: application background; separates the workspace from browser chrome.
- `--ks-surface-1`: primary content surfaces and forms.
- `--ks-surface-2`: subordinate panels, grouped controls, and inactive drafting regions.
- `--ks-surface-inset`: recessed wells such as segmented controls, canvases, and inspectors.
- `--ks-ink-strong`: primary headings, critical numbers, and active structural lines.
- `--ks-ink`: default content.
- `--ks-ink-muted`: guidance, metadata, and inactive labels.
- `--ks-line`: default separation.
- `--ks-line-strong`: boundaries requiring stronger spatial definition.

### Operational colors

- `--ks-action`: the current actionable step, active tool, focus relationship, and primary CTA.
- `--ks-action-hover`, `--ks-action-pressed`, `--ks-action-soft`: interaction derivatives that remain inside the action family.
- `--ks-complete`: verified completion, saved/ready state, and successful checks only.
- `--ks-attention`: a recoverable condition requiring review or setup.
- `--ks-danger`: invalid, destructive, blocked, or unsafe conditions.
- `--ks-info`: neutral system information that is neither an action nor a warning.

Every semantic state must use at least two signals among color, icon, label, border morphology, and spatial placement. Color alone is insufficient.

## Shape morphology

Shape categories correspond to purpose and interaction:

- **Structural bars:** 0–4 px radius; visually anchored; used for global mastheads, fixed drawing toolbars, and production rails.
- **Work surfaces:** 12–16 px radius; restrained shadow; used for substantial task regions such as measurement boards, proposal sheets, and production work areas.
- **Control groups and inset wells:** 8–10 px radius; inner or near-flat treatment; used for segmented controls, view modes, and grouped tools.
- **Fields and standard controls:** 8–10 px radius with clear boundary; focus increases edge prominence and adds an external ring without changing layout.
- **Primary actions:** 9–12 px radius, stronger fill and controlled elevation; press removes translation/elevation to create a tactile downward response.
- **Status surfaces:** geometry varies by urgency: informational states remain rectangular and quiet; attention gains a stronger leading edge; danger uses the strongest boundary and never relies on a soft decorative pill.
- **Chips and compact metadata:** pill geometry is reserved for short, non-primary categorical content. It must not be used for ordinary buttons, panels, or long labels.
- **Dialogs and floating palettes:** 12–16 px radius, higher elevation, explicit focus boundary, and a visually anchored title/action region.

Shape transitions must not resize layout. Hover may strengthen edge/elevation. Press may reduce elevation or translate by at most 1 px. Selection changes surface and boundary together. Disabled state removes elevation and reduces contrast while preserving legibility.

## Visuo-interactive synergy

### Core interaction grammar

- **Rest:** shape identifies the component category.
- **Hover:** the potential interaction becomes clearer through boundary/elevation change.
- **Focus:** a high-contrast external ring marks keyboard or active input ownership.
- **Pressed:** elevation collapses and the surface moves no more than 1 px.
- **Selected/active:** surface fill, border, and icon/label state change together.
- **Entered:** data fields emphasize the value and reduce placeholder prominence.
- **Complete:** field, related diagram geometry, and progress indicator resolve together using the completion semantic.
- **Warning/conflict:** the affected object and the recovery action share attention semantics, while unaffected regions remain neutral.
- **Error/blocked:** field or object, explanatory message, and correction path are visually linked.
- **Disabled:** shape remains recognizable, but interaction cues and elevation are removed.

### Spatial and drawing interfaces

For measurement, CAD, shelf, and drawing workflows, the visual object and its control are treated as one interaction unit:

- focusing a dimensional field highlights its corresponding axis or object;
- hovering an axis reveals the associated editable control;
- entering a valid value updates the numeric field, diagram line, and progress state together;
- selected objects share one action-semantic outline across canvas and inspector;
- invalid geometry uses danger semantics on the exact affected relationship, not the whole canvas;
- contextual actions appear close to the selected object without covering critical geometry.

## Token architecture

Create a central foundation stylesheet loaded before feature styles, provisionally `public/kitchen-design-system.css`. During the staged migration it owns tokens and safe global base rules only. Existing feature CSS is mostly unlayered and would outrank centrally layered component rules, so migrated feature styles must consume the shared tokens and component contracts locally until legacy styling has been retired.

The staged architecture is:

1. **Foundation:** central colors, typography, spacing, radii, borders, shadows, durations, easing, z-index, control sizes, RTL-safe focus, reduced motion, and compatibility variable aliases.
2. **Migrated feature contracts:** each migrated feature file adopts the shared tokens and documented primitive/pattern state matrices locally, allowing it to override its own legacy declarations predictably.
3. **Compatibility:** temporary legacy-variable mappings remain central, but selector-level overrides stay with the migrated feature to avoid cascade ambiguity.
4. **Consolidation:** after consumers are migrated, repeated component/pattern declarations move into declared central layers and legacy rules are removed or explicitly placed in a lower-priority legacy layer.

New CSS must consume semantic tokens. Raw color values are allowed only inside token definitions, data visualizations with documented palettes, imported assets, and unavoidable domain-specific material previews.

## Typography and numeric content

- Use a restrained type scale with explicit roles: display, screen title, section title, body, control, metadata, and technical number.
- Technical measurements use tabular numerals and stronger weight.
- Labels and values remain distinct without relying solely on size.
- Arabic line height must accommodate diacritics and avoid cropped glyphs.
- Do not center long Arabic labels inside narrow controls; preserve start alignment where scanning benefits.

## Spacing and density

Define a 4 px base scale with semantic aliases for control gaps, panel padding, workspace gutters, and dense-table spacing.

Density modes are contextual, not user-facing themes:

- **Field:** large targets, generous separation, sunlight-readable contrast.
- **Studio:** balanced density for planning and design.
- **Factory:** compact rows and high data throughput while retaining target and focus requirements.
- **Presentation:** calmer hierarchy for customer-facing proposals and reviews.

All modes share the same semantics and component morphology.

## Motion

- Durations: fast feedback around 120–160 ms; panel/dialog transitions around 180–220 ms.
- Only opacity, transform, border, background, and shadow transitions are permitted for common interaction feedback.
- Avoid animating layout dimensions in dense professional workspaces.
- Respect `prefers-reduced-motion: reduce` by removing nonessential transitions and translations.
- Completion feedback should be subtle and local; no celebratory motion in production workflows.

## Accessibility contract

- Visible focus is mandatory for every interactive element.
- State information must remain understandable without color.
- Text and essential controls must meet WCAG AA contrast targets.
- Touch targets are at least 44 × 44 px for principal/coarse-pointer interactions; dense factory controls may use compact visual content inside a 44 px hit target.
- RTL order, arrow direction, previous/next meaning, and icon placement must be audited per component.
- `aria-current`, `aria-selected`, `aria-pressed`, validity attributes, and live regions must drive matching visual states where applicable.
- High zoom and 768 px compact-desktop layouts must avoid horizontal document overflow for primary workflows.

## Component contracts

The first system release must define:

- global masthead and workspace identity;
- primary, secondary, ghost, destructive, and icon buttons;
- text, numeric, select, search, checkbox, radio, and switch inputs;
- segmented controls and view tabs;
- task/context cards and work surfaces;
- neutral, informational, attention, danger, and completion notices;
- toolbars, command rails, overflow menus, and floating palettes;
- dialogs, drawers, inspectors, and anchored popovers;
- tables, data rows, empty states, status cells, and bulk actions;
- progress meters, step indicators, save/readiness/conflict statuses;
- drawing selection, dimension fields, object handles, axes, and canvas overlays;
- customer-facing proposal/review surfaces;
- loading, empty, error, offline, stale, and disabled states.

Each contract documents anatomy, allowed variants, state matrix, keyboard behavior, RTL behavior, density behavior, and prohibited uses.

## Migration order

### Phase 0 — Inventory and baseline

- Generate a route, screen, component, selector, and token inventory across the application and all 62 style sheets, with coverage counts that define “all interfaces.”
- Capture representative screens and interaction states for every functional family.
- Identify shared components, duplicate values, cascade conflicts, and visual exceptions.
- Establish visual regression viewport/state matrix.
- Deliver a generated inventory, representative QA matrix, exception register, and prioritized migration manifest; do not manually document every selector.

### Phase 1 — Foundation and reference screen

- Implement central tokens, base rules, primitives, and compatibility aliases.
- Convert the current visit-start measurement screen into the first system-native reference.
- Validate empty, focus, partial, complete, invalid, compact, and coarse-pointer states.

### Phase 2 — Field and survey

- Migrate visit start, measured perimeter, survey entry, wall sheets, survey walk, wall ink, notebook, appliance intake, and field forms.
- Prioritize sunlight contrast, large targets, and measurement-to-diagram linkage.

### Phase 3 — Design and spatial editing

- Migrate designer studio, shelf planner, drawing tools, architectural editing, finish studio, material palettes, and inspector panels.
- Prioritize selection consistency, canvas/inspector linkage, precision controls, and command discoverability.

### Phase 4 — Catalog, factory, and production

- Migrate catalogs, defaults, factory families/templates, production rows, machining, inventory, and workshop job surfaces.
- Prioritize compact density, status scanning, conflict visibility, and safe destructive actions.

### Phase 5 — Proposal, review, and delivery

- Migrate proposals, quotes, approvals, reports, delivery drawings, install readiness, and customer-facing pages.
- Prioritize calm hierarchy, readable summaries, decision traceability, and print/export parity.

### Phase 6 — Operations and supporting tools

- Migrate saved projects, version history, libraries, gateways, maintenance, oversight, backup/sync, assist surfaces, and remaining utilities.

### Phase 7 — Consolidation

- Remove compatibility aliases only after their consumers are migrated.
- Eliminate obsolete declarations and duplicated feature-level tokens.
- Add automated policy checks for raw semantic colors, unsupported radii, missing focus states, and minimum control targets.
- Publish the final component/state documentation.

## Definition of system-native

A screen or component is system-native only when automated and visual checks establish that:

- it has no unapproved raw semantic-state colors outside token definitions and an explicit allowlist;
- it has no unapproved radii, shadows, transition timings, or focus treatments outside the system contracts;
- principal and coarse-pointer targets meet the 44 × 44 px interaction requirement;
- normal text reaches at least 4.5:1 contrast, large text at least 3:1, and essential non-text boundaries/indicators at least 3:1;
- state remains understandable without color and matches ARIA/validity/selection attributes;
- the primary workflow remains usable at 200% zoom without loss of content or function;
- its required empty, partial, loading, complete, attention, error, conflict, disabled, and destructive states are covered where applicable;
- its representative viewports have no unresolved P0–P2 design-QA findings;
- mixed navigation between it and adjacent unmigrated screens does not break the masthead, dialogs, focus behavior, overlays, or z-index relationships.

Material/catalog swatches, technical visualization palettes, user-selected colors, and print-specific color data are allowed only through a documented lint allowlist and remain subject to contrast and meaning checks where they are interactive.

## Verification strategy

Every phase must include:

- automated project test suite;
- CSS policy/static checks for token use and forbidden raw state styling;
- browser-rendered comparison at representative desktop and compact viewports;
- keyboard traversal and visible-focus verification;
- pointer interaction verification for hover, press, selection, menus, and dialogs;
- RTL review for alignment, sequence, arrows, and anchored overlays;
- state review for empty, loading, partial, complete, warning, error, conflict, disabled, and destructive confirmation where relevant;
- console error/warning check;
- before/after captures and a phase QA report with no unresolved P0–P2 findings before advancing.

Phase 5 must additionally verify print and export output for proposals, production drawings, reports, and delivery artifacts so screen-oriented tokens do not alter document fidelity.

## Rollout and compatibility

- The central foundation stylesheet is additive at first and loaded before feature styles; it owns tokens and safe base behavior, not selector-level component overrides.
- Compatibility aliases allow old variables to resolve to new semantic tokens while a screen is being migrated. Migrated feature selectors adopt the new contracts locally until consolidation.
- A screen is marked system-native only after its feature stylesheet no longer introduces unapproved state colors, radii, shadows, or interaction behavior.
- No feature family advances to consolidation until its representative workflows pass visual and functional verification.
- Changes remain local to the existing project; no deployment, publishing, or external communication is implied.

## Documentation deliverables

- `docs/design-system/foundations.md`: principles, semantics, and token reference.
- `docs/design-system/components.md`: anatomy and state matrices.
- `docs/design-system/patterns.md`: field, studio, factory, and presentation patterns.
- `docs/design-system/migration.md`: phase status, exceptions, and compatibility mappings.
- `docs/design-system/qa-matrix.md`: required screens, states, viewports, and evidence.
- `docs/design-system/inventory.json`: generated route/screen/component coverage inventory and migration status.

## Decisions left to the builder

- Exact token values within the approved semantic roles, calibrated through browser comparison.
- Internal naming refinements that preserve the documented meaning.
- Whether a repeated legacy selector maps through compatibility aliases or is converted directly in its migration phase.
- The smallest safe grouping of files inside each functional phase.

## Owner approval gate

Implementation begins only after the owner approves this specification. After approval, a separate implementation plan will break the work into reversible, testable phases with explicit verification gates.
