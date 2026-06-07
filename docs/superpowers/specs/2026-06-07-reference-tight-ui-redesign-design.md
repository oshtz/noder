# Reference-Tight UI Redesign Design

Date: 2026-06-07
Project: noder
Status: Draft for user review

## Objective

Redesign noder into a reference-tight node-canvas workspace while preserving the existing feature set. The target feel is a sparse black creative-workflow canvas with compact chrome, dense nodes, small floating controls, and contextual panels. The redesign combines:

- App shell and surface redesign.
- Deeper interaction redesign for how controls, outputs, inspector, assistant, and gallery appear.

## Source Context

The current app is a Vite, React, React Flow, and Tauri desktop app. Relevant existing surfaces include:

- `src/App.tsx`: main React Flow canvas, sidebar, editor toolbar, inspector, output filmstrip, gallery, execution dock, assistant panel, welcome screen, validation panel, and error recovery panel.
- `src/App.css`: global app styles, React Flow overrides, nodes, titlebar, editor toolbar, minimap, and canvas styles.
- `src/components/Sidebar.tsx` and `src/components/Sidebar.css`: icon rail, workflow popovers, templates, gallery, settings, and new workflow flow.
- `src/components/WorkflowUX.css`: execution dock, inspector, output filmstrip, connection hint, contextual gallery surface, and node status badges.
- `src/components/BaseNode.tsx`: node shell, floating titles, metadata, status badges, handles, resize behavior, and legacy popover path.
- `src/constants/themes.ts`: theme CSS variables and theme picker compatibility.

The user selected the reference-tight visual direction and requested not to rebuild every theme. The default dark experience should receive the full polish. Other themes should remain functional through shared variables and compatibility styling.

## Product Requirements

The redesign must keep all current features available:

- Workflow create, load, save, rename, delete, export, and templates.
- Canvas pan, zoom, drag, connect, group, ungroup, auto-layout, undo, redo, keyboard shortcuts, and drag/drop import.
- Node inspector, per-node run, retry, delete, execution order controls, connection hints, validation errors, and error recovery.
- Workflow execution, run, stop, retry failed, progress, current node status, failed run state, and output count.
- Output gallery, recent outputs, compare/gallery workflows, and canvas output access.
- Assistant panel access.
- Settings, theme picker, provider keys, model settings, toolbar visibility, update settings, and workflow settings.
- Welcome screen and empty workflow affordances.

The redesign should change layout, styling, density, and reveal behavior. It should not remove product capability.

## Non-Goals

- Do not rebuild every theme palette.
- Do not rewrite React Flow or replace the node graph model.
- Do not redesign provider settings, model schemas, workflow persistence, or execution logic beyond UI states needed for the redesign.
- Do not add unrelated features.
- Do not make a marketing landing page.

## Visual System

The default dark workspace should use:

- Near-black canvas background with a fine low-contrast grid.
- Compact 4-8px border radii, with cards capped at 8px unless existing controls require otherwise.
- Subtle dark surfaces with thin borders and restrained shadows.
- Small, dense type inside operational surfaces.
- Low-saturation accent usage for active states, compatible handles, run state, and errors.
- Icon-first commands using the existing `react-icons` library.
- Minimal explanatory UI text. Controls should rely on icons, labels only where needed, and tooltips/title attributes for clarification.

Default dark theme should be the primary polished target. Other themes should inherit the redesigned layout and use their existing CSS variables. If a non-dark theme produces an acceptable but less bespoke result, that is in scope.

## App Shell

The canvas becomes the dominant surface.

### Left Rail

Replace the current large floating pill rail with a slim fixed rail at the far left edge, visually closer to the reference image.

Behavior:

- Keep existing entry points: home, create workflow, workflows, templates, gallery, controls, assistant if enabled, settings.
- Use compact icon buttons with subtle active states.
- Keep hover/focus labels for accessibility and discoverability.
- Avoid a large floating container that competes with the graph.

### Workflow Title

Move active workflow identity into a compact top-left chip.

Behavior:

- Show workflow name and unsaved state.
- Keep save affordance accessible through rail/popover or chip action.
- Preserve rename and workflow management through the workflows popover.

### Bottom Command Dock

Create one bottom-center command dock that consolidates canvas and execution controls.

Controls:

- Undo and redo.
- Auto-layout menu.
- Group and ungroup.
- Zoom level or zoom actions.
- Run/stop primary action.
- Retry failed when relevant.
- Output/gallery shortcut when outputs exist.

The dock should be compact by default and expand statefully during execution or failure. It should not introduce a new pointer/pan mode unless implementation work also wires that mode to real canvas behavior.

### Titlebar

Keep the Tauri titlebar behavior, but align its visual treatment with the reference-tight workspace: dark, quiet, and not visually dominant.

## Nodes And Canvas

### Node Chrome

Nodes should become smaller, flatter, and denser:

- Compact headers and tighter content padding.
- 4-6px radius for node bodies.
- Thin, low-contrast borders.
- Subtle selected/processing/error outlines.
- Floating node title remains, but metadata chips become quieter.
- Secondary badges appear on hover, selection, processing, or error rather than always dominating the node.

### Handles

Handles must remain functional but become visually slimmer:

- Avoid large always-visible add-circle handles.
- Reveal clear connection points on hover, selection, or active connection.
- Use type color carefully for compatibility and mismatch states.

### Edges

Connections should feel like the reference:

- Thin paths by default.
- Type color or accent only where useful.
- Active connection, compatible targets, and failure/processing glows should be subtle.
- Avoid heavy animated dash effects unless the edge is actively involved in execution.

### Canvas Background

Use a near-black grid with low contrast and enough detail to orient users without creating visual noise. The canvas should remain legible under all zoom levels that React Flow supports.

## Contextual Surfaces

Default state is composition mode: canvas, left rail, top workflow chip, and bottom command dock.

### Inspector

The inspector should be contextual:

- Hidden by default.
- Opens when a node is selected.
- Opens or stays open for a failed node.
- Can be dismissed with the existing close action. If the selected node remains selected, the panel should stay dismissed until another node is selected or an error requires the panel.
- Uses a compact side sheet or drawer with the same content as today: model, connections, last run, failure, actions, run/retry, move order, delete.

### Outputs

Recent outputs should not occupy the canvas by default.

Behavior:

- Output preview tray opens from the dock or after a generation completes.
- Brief post-run reveal is acceptable, but it should be easy to collapse.
- Gallery remains available from rail and dock.
- Full gallery remains an overlay or full-screen panel when explicitly opened.

### Assistant

Assistant access remains, but the assistant should not compete with the graph by default.

Behavior:

- Open from rail or dock.
- When open, it should offset or overlay cleanly without breaking canvas controls.
- The default canvas should still read as a node workspace, not a chat-first app.

### Popovers

Workflow, templates, new workflow, and settings popovers should inherit the compact dark surface style. Preserve their existing behaviors and data loading paths.

## Interaction Model

### Composition Mode

Default visual state:

- Large uninterrupted canvas.
- Left rail.
- Workflow title chip.
- Bottom command dock.
- No persistent inspector or filmstrip.

### Inspect Mode

Triggered by selecting a node.

Visible changes:

- Node receives a clear selected state.
- Inspector opens as a compact contextual surface.
- Node handles and compatible connection affordances become more visible.

### Execution Mode

Triggered by running a workflow.

Visible changes:

- Bottom dock expands to show progress, stop, current node, failed count, and output count.
- Processing node state is visible on the canvas.
- Edges involved in execution can show subtle active styling.

### Output Review Mode

Triggered by successful output generation or explicit output action.

Visible changes:

- Compact output tray opens.
- User can open full gallery.
- Tray can collapse back to composition mode.

### Failure Mode

Triggered by validation or execution errors.

Visible changes:

- Failed node and relevant error surface stay visible until resolved or dismissed.
- Retry actions are available from the dock and inspector.
- Errors should not be hidden behind hover-only UI.

## Implementation Boundaries

The implementation should favor existing components and contracts:

- Keep `App.tsx` as the orchestration surface, but introduce small shell state where needed for contextual surfaces.
- Reuse `ExecutionDock`, `EditorToolbar`, `NodeInspectorPanel`, `OutputFilmstrip`, `Sidebar`, `Popover`, `ValidationErrorsPanel`, and `ErrorRecoveryPanel` rather than replacing them wholesale.
- It is acceptable to merge toolbar and execution dock behavior into a new command dock component if that reduces duplicated floating controls.
- Keep node data contracts and workflow execution hooks unchanged unless a UI reveal state requires a narrow prop addition.
- Keep CSS variable theming. Add shared surface variables if needed, with defaults derived from existing theme variables.

## Accessibility And Responsiveness

- Icon-only controls need `aria-label` and hover/focus titles or labels.
- Keyboard shortcuts should continue to work.
- Focus states must remain visible on dark surfaces.
- Text must not overflow buttons, chips, cards, rails, or panels.
- Mobile/narrow behavior should not overlap controls. On narrow widths, contextual panels can become bottom sheets or full-width overlays.
- The design should avoid nested cards and oversized decorative panels.

## Verification Plan

After implementation, verify:

- `npm run typecheck`
- Relevant component tests for changed surfaces.
- A full app load in the browser or Tauri-compatible dev shell.
- Visual QA at desktop viewport and one narrow/mobile viewport.
- No blank page or framework overlay.
- No relevant console errors.
- First meaningful screen renders.
- Opening workflow/template/gallery/settings popovers still works.
- Selecting a node opens inspector.
- Running workflow state updates the bottom dock.
- Outputs can be opened from the compact tray or gallery access.
- Failure/validation state remains visible and actionable.

## Acceptance Criteria

The redesign is complete when:

- The default dark canvas visually matches the selected reference-tight direction.
- Persistent inspector and filmstrip no longer occupy the default composition state.
- The left rail, workflow title, command dock, nodes, edges, and contextual panels all share one compact dark visual system.
- Existing features remain reachable and functional.
- Other themes remain selectable and do not break layout.
- Verification passes or any remaining gaps are explicitly documented.
