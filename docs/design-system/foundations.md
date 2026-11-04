# Measured Workshop foundations

The central source is `public/kitchen-design-system.css`. The main app loads it as the first import of `kitchen-shell.css`; independent entries retain their own foundation imports. It precedes unlayered feature rules. Its semantic tokens define a contract; their presence does not establish rendered contrast or browser acceptance.

## Semantics

| Role | Tokens and permitted use |
| --- | --- |
| Structure | `--ks-canvas`, `--ks-surface-1`, `--ks-surface-2`, `--ks-surface-inset`, `--ks-ink-strong`, `--ks-ink`, `--ks-ink-muted`, `--ks-line`, `--ks-line-strong` separate work regions and information hierarchy |
| Action | `--ks-action`, `--ks-action-hover`, `--ks-action-pressed`, `--ks-action-soft` identify an action or selected relationship |
| Completion | `--ks-complete`, `--ks-complete-soft` require actual saved, confirmed, ready, measured or closed state |
| Recovery | `--ks-attention`, `--ks-attention-soft` identify recoverable preview, pending, conflict or setup conditions |
| Invalid/destructive | `--ks-danger`, `--ks-danger-soft` identify invalid, stale, blocked and destructive conditions |
| Information | `--ks-info`, `--ks-info-soft` identify neutral guidance and connection messages without implying verified success |
| Dark structure | `--ks-on-dark`, `--ks-on-dark-muted`, `--ks-focus-ring-dark` provide readable ink and keyboard ownership over dark headers and photo wells |

State also needs a label, icon, line pattern or location. Active navigation uses an action boundary and underline; it never implies successful completion. A role or gateway name is structural identity rather than a warning/success category.

## Geometry, typography and motion

Use the 4px spacing scale `--ks-space-1` through `--ks-space-6`; semantic aliases cover control gaps, panel padding, workspace gutters and field/studio/factory/presentation densities. Keep Tahoma/Arial through `--ks-font-ui`; no network font is required. The type tokens cover display, title, section, body and metadata; technical fields and identifiers use tabular numerals. Arabic text must have sufficient line height and start alignment; narrow labels must wrap rather than crop.

Structural bars use `--ks-radius-structural`, controls use `--ks-radius-control`, groups use `--ks-radius-group`, work surfaces use `--ks-radius-surface`, and overlays use `--ks-radius-overlay`. `--ks-radius-chip` is for short metadata; `--ks-radius-circle` is for circular indicators. The route chooser's existing corner geometry uses `--ks-radius-route-corner`. Do not turn ordinary actions into pills. Surface/overlay/selected/mark/swatch shadows have named tokens; the swatch shadow represents authored hardware material, not interaction elevation.

Feedback uses `--ks-duration-fast`, `--ks-duration-panel` and `--ks-ease`. Press translation is at most 1px and the twelve operational press rules now exist only inside `prefers-reduced-motion:no-preference`. Foundation reduced-motion handling shortens timing; the owning feature reset is no longer expected to defeat a more specific unqualified active selector. The completion check models the authored selectors' specificity, media participation and source order, and requires an effective `none` transform under reduced motion. The skipped navigation link's focus reveal remains functional.

The muted normal-text token is `--ks-ink-muted:#53666c`. Its measured token-pair contrast is 5.54:1 on canvas, 5.32:1 on surface-inset, 5.22:1 on action-soft and 5.33:1 on complete-soft. The foundation check requires at least 4.5:1 on all four. These pair measurements do not replace browser composition checks where opacity, images or additional layers affect the result. The standalone export snapshot changes together with the central root and remains protected by exact parity.

## Cascade and layers

`@layer ks-primitives` contains only safe low-specificity form-font inheritance, technical numeral alignment, manipulation touch behavior and coarse-pointer target defaults. Existing unlayered feature rules outrank this layer by design. State, selection, target, focus and overlay rules remain with feature owners where specificity and route/container resets matter. Consolidation does not remove those necessary local contracts or wrap legacy styles in a new global layer.

Focus is an external 3px solid semantic ring with a 2px offset. Dark headers select the dark ring; light popovers nested in them restore the light ring. Targets reserve at least 44px logical block size; buttons, links and summaries reserve 44px inline size. Coarse-pointer rules preserve compact glyphs inside target boxes. Actual geometry, clipping and zoom remain browser gates.

The layer scale is sticky 40, popover 200, dialog 400, toast 500, photo 1200 and skip-link 1300. Local canvas stacks retain their existing small relative z-indices inside isolated drawing roots. The photograph occupies a modal root above ordinary dialogs; the keyboard skip link remains above it. Nested stacking contexts still require browser verification.

## Compatibility and exceptions

Local compatibility names are retained only to avoid changing existing consumers. They now resolve to semantic tokens; they are not independent palettes. Layout custom properties such as workspace height, bar padding, dock width, photo ratio and measured unit width remain geometry data and must not be recolored or rounded. No new legacy alias is exported as an API.

The exact alias register below is generated during this source migration. Removal requires changing all consumers within the owning family; source scanning alone does not establish runtime absence.

| Local name | Semantic destination |
| --- | --- |
| `--accent` | `var(--ks-action)` |
| `--accent-soft` | `var(--ks-action-soft)` |
| `--accent-strong` | `var(--ks-action-hover)` |
| `--amber` | `var(--ks-attention)` |
| `--amber-soft` | `var(--ks-attention-soft)` |
| `--band-edge` | `var(--ks-line-strong)`; `var(--ks-danger)` |
| `--band-wash` | `var(--ks-surface-2)`; `var(--ks-danger-soft)` |
| `--canvas` | `var(--ks-canvas)` |
| `--dl-amber` | `var(--ks-attention)` |
| `--dl-green` | `var(--ks-action)` |
| `--dl-ink` | `var(--ks-ink)` |
| `--dl-line` | `var(--ks-line)` |
| `--dl-muted` | `var(--ks-ink-muted)` |
| `--dl-paper` | `var(--ks-canvas)` |
| `--dl-red` | `var(--ks-danger)` |
| `--dl-soft` | `var(--ks-action-soft)` |
| `--dl-white` | `var(--ks-surface-1)` |
| `--dock-border` | `var(--ks-line)` |
| `--dock-fold-width` | `calc(var(--ks-target) + 2px)` |
| `--dock-forest` | `var(--ks-action)` |
| `--dock-paper` | `var(--ks-surface-1)` |
| `--ds-amber` | `var(--ks-attention)` |
| `--ds-amber-bg` | `var(--ks-attention-soft)` |
| `--ds-blue` | `var(--ks-ink-strong)` |
| `--ds-error` | `var(--ks-danger)` |
| `--ds-paper` | `var(--ks-canvas)` |
| `--error` | `var(--ks-danger)` |
| `--fs-amber` | `var(--ks-attention)` |
| `--fs-error` | `var(--ks-danger)` |
| `--fs-ink` | `var(--ks-ink)` |
| `--fs-line` | `var(--ks-line)` |
| `--fs-muted` | `var(--ks-ink-muted)` |
| `--fs-navy` | `var(--ks-ink-strong)` |
| `--fs-pale` | `var(--ks-action-soft)` |
| `--fs-paper` | `var(--ks-canvas)` |
| `--fs-surface` | `var(--ks-surface-1)` |
| `--fs-teal` | `var(--ks-action)` |
| `--gw` | `var(--ks-ink-strong)` |
| `--ink` | `var(--ks-ink-strong)` |
| `--k-border` | `var(--ks-on-dark-muted)` |
| `--k-ink` | `var(--ks-ink)` |
| `--ki-deep` | `var(--ks-ink-strong)` |
| `--ki-edge` | `var(--ks-line)` |
| `--ki-ink` | `var(--ks-ink)` |
| `--ki-mint` | `var(--ks-action-soft)` |
| `--ki-muted` | `var(--ks-ink-muted)` |
| `--ki-paper` | `var(--ks-canvas)` |
| `--kul-bg` | `var(--ks-surface-1)` |
| `--line` | `var(--ks-line)` |
| `--ms-blue-soft` | `var(--ks-action-soft)` |
| `--ms-closed` | `var(--ks-complete)` |
| `--ms-copper` | `var(--ks-attention)` |
| `--ms-copper-soft` | `var(--ks-attention-soft)` |
| `--muted` | `var(--ks-ink-muted)` |
| `--nb-amber` | `var(--ks-attention)` |
| `--nb-amber-bg` | `var(--ks-attention-soft)` |
| `--nb-error` | `var(--ks-danger)` |
| `--nb-paper` | `var(--ks-canvas)` |
| `--nb-surface` | `var(--ks-surface-1)` |
| `--os-amber` | `var(--ks-attention)` |
| `--os-amber-soft` | `var(--ks-attention-soft)` |
| `--os-blue` | `var(--ks-action)` |
| `--os-blue-soft` | `var(--ks-action-soft)` |
| `--os-green` | `var(--ks-complete)` |
| `--os-green-soft` | `var(--ks-complete-soft)` |
| `--os-ink` | `var(--ks-ink)` |
| `--os-line` | `var(--ks-line)` |
| `--os-muted` | `var(--ks-ink-muted)` |
| `--os-paper` | `var(--ks-canvas)` |
| `--os-red` | `var(--ks-danger)` |
| `--os-surface` | `var(--ks-surface-1)` |
| `--paper` | `var(--ks-surface-1)` |
| `--pd-accent` | `var(--ks-action)` |
| `--pd-ink` | `var(--ks-ink)`; `var(--ks-ink-strong)` |
| `--pd-line` | `var(--ks-line)` |
| `--pd-muted` | `var(--ks-ink-muted)` |
| `--pd-paper` | `var(--ks-surface-1)` |
| `--pd-tint` | `var(--ks-action-soft)` |
| `--plate-dim` | `var(--ks-ink-muted)` |
| `--plate-focus` | `var(--ks-action)` |
| `--plate-ink` | `var(--ks-ink-strong)` |
| `--plate-paper` | `var(--ks-surface-1)` |
| `--ps-amber` | `var(--ks-attention)` |
| `--ps-error` | `var(--ks-danger)` |
| `--ps-ink` | `var(--ks-ink)` |
| `--ps-line` | `var(--ks-line)` |
| `--ps-muted` | `var(--ks-ink-muted)` |
| `--ps-navy` | `var(--ks-ink-strong)` |
| `--ps-pale` | `var(--ks-action-soft)` |
| `--ps-paper` | `var(--ks-canvas)` |
| `--ps-surface` | `var(--ks-surface-1)` |
| `--ps-teal` | `var(--ks-action)` |
| `--qs-amber` | `var(--ks-attention)` |
| `--qs-error` | `var(--ks-danger)` |
| `--qs-ink` | `var(--ks-ink)` |
| `--qs-line` | `var(--ks-line)` |
| `--qs-muted` | `var(--ks-ink-muted)` |
| `--qs-navy` | `var(--ks-ink-strong)` |
| `--qs-pale` | `var(--ks-action-soft)` |
| `--qs-paper` | `var(--ks-canvas)` |
| `--qs-surface` | `var(--ks-surface-1)` |
| `--qs-teal` | `var(--ks-action)` |
| `--rm-grain` | `var(--ks-line)` |
| `--rm-ink` | `var(--ks-ink)` |
| `--rm-soft` | `var(--ks-ink-muted)` |
| `--scope-accent` | `var(--ks-ink)` |
| `--scope-bg` | `var(--ks-surface-2)` |
| `--scope-line` | `var(--ks-line-strong)` |
| `--shadow` | `var(--ks-shadow-surface)` |
| `--soft` | `var(--ks-surface-2)` |
| `--sp-brass` | `var(--ks-metal)` |
| `--sp-card` | `var(--ks-surface-1)` |
| `--sp-font` | `var(--ks-font-ui)` |
| `--sp-forest` | `var(--ks-action)` |
| `--sp-green` | `var(--ks-action)` |
| `--sp-ink` | `var(--ks-ink)` |
| `--sp-line` | `var(--ks-line)` |
| `--sp-moss` | `var(--ks-ink-muted)` |
| `--sp-muted` | `var(--ks-ink-muted)` |
| `--sp-paper` | `var(--ks-canvas)` |
| `--sp-soft` | `var(--ks-surface-inset)` |
| `--sp-warm` | `var(--ks-ink-muted)` |
| `--studio-copper` | `var(--ks-attention)` |
| `--studio-deep` | `var(--ks-ink-strong)` |
| `--studio-edge` | `var(--ks-line)` |
| `--studio-font` | `var(--ks-font-ui)` |
| `--studio-ink` | `var(--ks-ink)` |
| `--studio-muted` | `var(--ks-ink-muted)` |
| `--studio-paper` | `var(--ks-canvas)` |
| `--surface` | `var(--ks-surface-1)` |
| `--sv-accent` | `var(--ks-action)` |
| `--sv-ink` | `var(--ks-ink)` |
| `--sv-line` | `var(--ks-line)` |
| `--sv-pale` | `var(--ks-action-soft)` |
| `--sv-quiet` | `var(--ks-ink-muted)` |
| `--teal` | `var(--ks-action)` |
| `--teal-soft` | `var(--ks-action-soft)` |
| `--tile-ink` | `var(--ks-ink)`; `var(--ks-danger)` |
| `--tile-line` | `var(--ks-line-strong)`; `var(--ks-danger)` |
| `--tile-wash` | `var(--ks-surface-2)`; `var(--ks-danger-soft)` |
| `--ws-ink` | `var(--ks-ink)` |
| `--ws-line` | `var(--ks-line)` |
| `--ws-paper` | `var(--ks-canvas)` |
| `--ws-quiet` | `var(--ks-ink-muted)` |
| `--ws-tint` | `var(--ks-action-soft)` |

Raw material, technical, user and print data exceptions are registered by exact file, selector or sink, property, complete value and reason in `allowlist.json`. They cannot waive radius, focus, shadow or motion policy. An exception never supplies visual acceptance. Photo pixels and measured geometry remain data; their interactive selection states still follow system semantics.

## Standalone export tokens and aliases

`kitchen-customer-sheet-style.js` exports `designExportTokens`, an embedded snapshot of the central root. The source completion gate compares its bytes with `kitchen-design-system.css`; after a central token change update the snapshot in the same change. Customer preview/download/print embeds it, and drawing-book imports it, so saved standalone HTML has no external stylesheet dependency. Raw system definitions are allowed only inside this exact root snapshot; feature overrides remain policy-controlled. Technical dimension halos use `--ks-shadow-dimension-halo`. `--ks-print-paper` and `--ks-print-ink` preserve physical white-paper/black-ink baselines.

Standalone report compatibility names remain local: `--ink` → `--ks-ink`, `--muted` → `--ks-ink-muted`, `--line` → `--ks-line`, `--forest` and `--accent` → `--ks-action`, `--warm` → `--ks-ink-strong`, `--paper` → `--ks-print-paper`, `--sand` → `--ks-surface-inset`, and `--field` → `--ks-canvas`. Product sample properties `--swatch`, `--base`, `--pic`, `--kmat`, `--kmat-line` and `--material-color` retain domain material data through exact sink exceptions. `--krs-w`, `--pha-ratio` and `--shc-ratio` retain the exact current numeric geometry expressions; they do not encode UI colors.
