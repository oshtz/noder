# Reference-Tight UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the selected approach 2 + 3 redesign: a reference-tight app shell plus deeper contextual interaction model for noder's existing feature set.

**Architecture:** Add small, focused UI units around the existing React Flow app instead of replacing the workflow model. A contextual-surface hook owns inspector/output reveal state, a new bottom command dock consolidates toolbar and execution controls, and the existing Sidebar, node, edge, inspector, gallery, and output components are restyled and lightly adapted. `App.tsx` remains the orchestration layer.

**Tech Stack:** React 18, TypeScript, React Flow, Zustand settings store, `react-icons`, Vitest, Testing Library, CSS variables, Vite, Tauri-compatible web shell.

---

## File Structure

- Create `src/hooks/useContextualSurfaces.ts`: Encapsulates composition, inspect, output review, and failure reveal state.
- Create `src/hooks/useContextualSurfaces.test.ts`: Unit tests for inspector dismissal, node switching, output auto-open, and failure visibility.
- Create `src/components/CommandDock.tsx`: Unified bottom-center dock for undo/redo, layout, grouping, execution, retry, outputs, and zoom display.
- Create `src/components/CommandDock.test.jsx`: Interaction tests for run/stop, retry, outputs, layout menu, grouping, and disabled states.
- Create `src/components/WorkflowTitleChip.tsx`: Compact top-left workflow identity and save affordance.
- Create `src/components/WorkflowTitleChip.test.jsx`: Tests for active workflow name, unsaved state, fallback name, and save action.
- Modify `src/App.tsx`: Wire contextual surfaces, replace persistent inspector/filmstrip/dock/toolbar composition, add title chip, render command dock.
- Modify `src/App.css`: Reference-tight canvas, titlebar, node shell, React Flow controls/minimap, handle, edge, and global surface styling.
- Modify `src/components/WorkflowUX.css`: Command dock, compact inspector, contextual output tray, connection hint, gallery overlay, responsive shell styling.
- Modify `src/components/Sidebar.tsx`: Compact rail behavior and assistant toggle entry point using the existing settings store.
- Modify `src/components/Sidebar.css`: Left-edge rail matching the reference, compact icon states, popover surface styling.
- Modify `src/components/Sidebar.test.jsx`: Add assistant toggle coverage and update label expectations if labels become hover-only but still accessible.
- Modify `src/components/OutputFilmstrip.tsx`: Add close action for contextual output tray.
- Modify `src/components/OutputFilmstrip.test.jsx`: Add close action and keep gallery access coverage.
- Modify `src/components/BaseNode.tsx`: Slim handle presentation, status visibility contract, compact metadata.
- Modify `src/components/BaseNode.test.jsx`: Add compact handle/status behavior tests.
- Modify `src/components/CustomEdge.tsx`: Tone down default edge styling and keep active flow styling visible.
- Modify relevant tests for changed surface names and classes.

---

### Task 1: Contextual Surface State Hook

**Files:**

- Create: `src/hooks/useContextualSurfaces.ts`
- Create: `src/hooks/useContextualSurfaces.test.ts`

- [ ] **Step 1: Write failing tests for composition, inspect, output, and failure states**

Create `src/hooks/useContextualSurfaces.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useContextualSurfaces } from './useContextualSurfaces';

describe('useContextualSurfaces', () => {
  it('keeps inspector hidden in composition mode', () => {
    const { result } = renderHook(() =>
      useContextualSurfaces({
        selectedNodeId: null,
        failedNodeIds: [],
        outputCount: 0,
        isProcessing: false,
      })
    );

    expect(result.current.showInspector).toBe(false);
    expect(result.current.showOutputTray).toBe(false);
    expect(result.current.mode).toBe('composition');
  });

  it('opens inspector when a node is selected and lets the same node stay dismissed', () => {
    const { result, rerender } = renderHook(
      (selectedNodeId: string | null) =>
        useContextualSurfaces({
          selectedNodeId,
          failedNodeIds: [],
          outputCount: 0,
          isProcessing: false,
        }),
      { initialProps: 'node-1' }
    );

    expect(result.current.showInspector).toBe(true);
    expect(result.current.mode).toBe('inspect');

    act(() => result.current.closeInspector());
    expect(result.current.showInspector).toBe(false);

    rerender('node-1');
    expect(result.current.showInspector).toBe(false);

    rerender('node-2');
    expect(result.current.showInspector).toBe(true);
  });

  it('forces inspector visible for a failed selected node', () => {
    const { result } = renderHook(() =>
      useContextualSurfaces({
        selectedNodeId: 'node-1',
        failedNodeIds: ['node-1'],
        outputCount: 0,
        isProcessing: false,
      })
    );

    act(() => result.current.closeInspector());
    expect(result.current.showInspector).toBe(true);
    expect(result.current.mode).toBe('failure');
  });

  it('opens output tray when output count increases after processing', () => {
    const { result, rerender } = renderHook(
      ({ outputCount, isProcessing }: { outputCount: number; isProcessing: boolean }) =>
        useContextualSurfaces({
          selectedNodeId: null,
          failedNodeIds: [],
          outputCount,
          isProcessing,
        }),
      { initialProps: { outputCount: 1, isProcessing: true } }
    );

    expect(result.current.showOutputTray).toBe(false);

    rerender({ outputCount: 2, isProcessing: false });
    expect(result.current.showOutputTray).toBe(true);
    expect(result.current.mode).toBe('output-review');

    act(() => result.current.closeOutputTray());
    expect(result.current.showOutputTray).toBe(false);
  });

  it('lets users manually open the output tray when outputs exist', () => {
    const { result } = renderHook(() =>
      useContextualSurfaces({
        selectedNodeId: null,
        failedNodeIds: [],
        outputCount: 3,
        isProcessing: false,
      })
    );

    act(() => result.current.openOutputTray());
    expect(result.current.showOutputTray).toBe(true);
  });
});
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run:

```powershell
npm run test:run -- src/hooks/useContextualSurfaces.test.ts
```

Expected: FAIL because `src/hooks/useContextualSurfaces.ts` does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useContextualSurfaces.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';

export type ContextualSurfaceMode = 'composition' | 'inspect' | 'execution' | 'output-review' | 'failure';

export interface UseContextualSurfacesArgs {
  selectedNodeId: string | null;
  failedNodeIds: string[];
  outputCount: number;
  isProcessing: boolean;
}

export interface UseContextualSurfacesResult {
  mode: ContextualSurfaceMode;
  showInspector: boolean;
  showOutputTray: boolean;
  openInspector: () => void;
  closeInspector: () => void;
  openOutputTray: () => void;
  closeOutputTray: () => void;
}

export function useContextualSurfaces({
  selectedNodeId,
  failedNodeIds,
  outputCount,
  isProcessing,
}: UseContextualSurfacesArgs): UseContextualSurfacesResult {
  const [dismissedInspectorNodeId, setDismissedInspectorNodeId] = useState<string | null>(null);
  const [outputTrayOpen, setOutputTrayOpen] = useState(false);
  const previousOutputCountRef = useRef(outputCount);
  const previousSelectedNodeIdRef = useRef<string | null>(selectedNodeId);

  const failedNodeSet = useMemo(() => new Set(failedNodeIds), [failedNodeIds]);
  const selectedNodeFailed = selectedNodeId ? failedNodeSet.has(selectedNodeId) : false;
  const hasFailures = failedNodeIds.length > 0;

  useEffect(() => {
    if (previousSelectedNodeIdRef.current !== selectedNodeId) {
      setDismissedInspectorNodeId(null);
      previousSelectedNodeIdRef.current = selectedNodeId;
    }
  }, [selectedNodeId]);

  useEffect(() => {
    const previousOutputCount = previousOutputCountRef.current;
    if (!isProcessing && outputCount > previousOutputCount) {
      setOutputTrayOpen(true);
    }
    previousOutputCountRef.current = outputCount;
  }, [isProcessing, outputCount]);

  const showInspector =
    !!selectedNodeId && (selectedNodeFailed || dismissedInspectorNodeId !== selectedNodeId);
  const showOutputTray = outputCount > 0 && outputTrayOpen;

  let mode: ContextualSurfaceMode = 'composition';
  if (hasFailures) mode = 'failure';
  else if (isProcessing) mode = 'execution';
  else if (showOutputTray) mode = 'output-review';
  else if (showInspector) mode = 'inspect';

  return {
    mode,
    showInspector,
    showOutputTray,
    openInspector: () => setDismissedInspectorNodeId(null),
    closeInspector: () => {
      if (!selectedNodeId || selectedNodeFailed) return;
      setDismissedInspectorNodeId(selectedNodeId);
    },
    openOutputTray: () => {
      if (outputCount > 0) setOutputTrayOpen(true);
    },
    closeOutputTray: () => setOutputTrayOpen(false),
  };
}
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run:

```powershell
npm run test:run -- src/hooks/useContextualSurfaces.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/hooks/useContextualSurfaces.ts src/hooks/useContextualSurfaces.test.ts
git commit -m "feat: add contextual surface state hook"
```

---

### Task 2: Command Dock Component

**Files:**

- Create: `src/components/CommandDock.tsx`
- Create: `src/components/CommandDock.test.jsx`
- Modify: `src/components/WorkflowUX.css`

- [ ] **Step 1: Write failing command dock tests**

Create `src/components/CommandDock.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CommandDock from './CommandDock';

const baseProps = {
  mode: 'composition',
  isProcessing: false,
  processed: 0,
  total: 3,
  failedCount: 0,
  outputCount: 2,
  currentNodeName: '',
  zoomPercent: 100,
  canUndo: true,
  canRedo: false,
  hasSelection: true,
  hasGroupSelected: false,
  onRun: vi.fn(),
  onStop: vi.fn(),
  onRetryFailed: vi.fn(),
  onOpenOutputs: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onAutoLayout: vi.fn(),
  onGroupSelected: vi.fn(),
  onUngroupSelected: vi.fn(),
};

describe('CommandDock', () => {
  it('runs the workflow from the compact dock', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<CommandDock {...baseProps} onRun={onRun} />);

    await user.click(screen.getByRole('button', { name: /run workflow/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows stop and active progress during execution', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(
      <CommandDock
        {...baseProps}
        mode="execution"
        isProcessing
        processed={1}
        total={4}
        currentNodeName="Image Generation"
        onStop={onStop}
      />
    );

    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getByText('Image Generation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stop workflow/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('opens outputs and retries failed nodes when available', async () => {
    const user = userEvent.setup();
    const onOpenOutputs = vi.fn();
    const onRetryFailed = vi.fn();
    render(
      <CommandDock
        {...baseProps}
        mode="failure"
        failedCount={2}
        onOpenOutputs={onOpenOutputs}
        onRetryFailed={onRetryFailed}
      />
    );

    await user.click(screen.getByRole('button', { name: /open outputs/i }));
    await user.click(screen.getByRole('button', { name: /retry failed nodes/i }));

    expect(onOpenOutputs).toHaveBeenCalledTimes(1);
    expect(onRetryFailed).toHaveBeenCalledTimes(1);
  });

  it('opens the layout menu and chooses a direction', async () => {
    const user = userEvent.setup();
    const onAutoLayout = vi.fn();
    render(<CommandDock {...baseProps} onAutoLayout={onAutoLayout} />);

    await user.click(screen.getByRole('button', { name: /auto layout/i }));
    await user.click(screen.getByRole('button', { name: /left to right/i }));

    expect(onAutoLayout).toHaveBeenCalledWith('LR');
  });

  it('calls grouping actions and respects disabled undo or redo state', async () => {
    const user = userEvent.setup();
    const onGroupSelected = vi.fn();
    render(
      <CommandDock
        {...baseProps}
        canUndo={false}
        canRedo={false}
        onGroupSelected={onGroupSelected}
      />
    );

    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /group selected nodes/i }));
    expect(onGroupSelected).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the command dock test to verify it fails**

Run:

```powershell
npm run test:run -- src/components/CommandDock.test.jsx
```

Expected: FAIL because `src/components/CommandDock.tsx` does not exist.

- [ ] **Step 3: Implement the command dock**

Create `src/components/CommandDock.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  FaChevronDown,
  FaImages,
  FaLayerGroup,
  FaObjectUngroup,
  FaPlay,
  FaRedo,
  FaSitemap,
  FaStop,
  FaUndo,
} from 'react-icons/fa';
import type { ContextualSurfaceMode } from '../hooks/useContextualSurfaces';
import './WorkflowUX.css';

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

interface CommandDockProps {
  mode: ContextualSurfaceMode;
  isProcessing: boolean;
  processed: number;
  total: number;
  failedCount: number;
  outputCount: number;
  currentNodeName?: string;
  zoomPercent: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasGroupSelected: boolean;
  onRun: () => void | Promise<void>;
  onStop: () => void;
  onRetryFailed: () => void | Promise<void>;
  onOpenOutputs: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAutoLayout?: (direction: LayoutDirection) => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
}

const layoutOptions: Array<{ id: LayoutDirection; label: string }> = [
  { id: 'TB', label: 'Top to Bottom' },
  { id: 'BT', label: 'Bottom to Top' },
  { id: 'LR', label: 'Left to Right' },
  { id: 'RL', label: 'Right to Left' },
];

const CommandDock: React.FC<CommandDockProps> = ({
  mode,
  isProcessing,
  processed,
  total,
  failedCount,
  outputCount,
  currentNodeName = '',
  zoomPercent,
  canUndo,
  canRedo,
  hasSelection,
  hasGroupSelected,
  onRun,
  onStop,
  onRetryFailed,
  onOpenOutputs,
  onUndo,
  onRedo,
  onAutoLayout,
  onGroupSelected,
  onUngroupSelected,
}) => {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const progressPercent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  useEffect(() => {
    if (!layoutMenuOpen) return undefined;
    const closeOnPointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnPointerDown);
    return () => document.removeEventListener('mousedown', closeOnPointerDown);
  }, [layoutMenuOpen]);

  return (
    <section className={`command-dock command-dock--${mode}`} aria-label="Canvas commands">
      <div className="command-dock-main">
        <button
          type="button"
          className="command-dock-button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <FaUndo aria-hidden="true" />
        </button>
        <button
          type="button"
          className="command-dock-button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <FaRedo aria-hidden="true" />
        </button>

        <span className="command-dock-divider" aria-hidden="true" />

        <div className="command-dock-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="command-dock-button command-dock-button--wide"
            onClick={() => setLayoutMenuOpen((open) => !open)}
            aria-label="Auto layout"
            aria-expanded={layoutMenuOpen}
            title="Auto layout"
          >
            <FaSitemap aria-hidden="true" />
            <FaChevronDown className="command-dock-chevron" aria-hidden="true" />
          </button>
          {layoutMenuOpen && (
            <div className="command-dock-menu" role="menu">
              {layoutOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="command-dock-menu-item"
                  onClick={() => {
                    onAutoLayout?.(option.id);
                    setLayoutMenuOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="command-dock-button"
          onClick={onGroupSelected}
          disabled={!hasSelection}
          aria-label="Group selected nodes"
          title="Group selected nodes"
        >
          <FaLayerGroup aria-hidden="true" />
        </button>
        <button
          type="button"
          className="command-dock-button"
          onClick={onUngroupSelected}
          disabled={!hasGroupSelected}
          aria-label="Ungroup selected nodes"
          title="Ungroup selected nodes"
        >
          <FaObjectUngroup aria-hidden="true" />
        </button>

        <span className="command-dock-divider" aria-hidden="true" />
        <span className="command-dock-zoom">{zoomPercent}%</span>

        <span className="command-dock-divider" aria-hidden="true" />

        {isProcessing ? (
          <button
            type="button"
            className="command-dock-action command-dock-action--danger"
            onClick={onStop}
            aria-label="Stop workflow"
          >
            <FaStop aria-hidden="true" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            className="command-dock-action command-dock-action--primary"
            onClick={() => void onRun()}
            disabled={total === 0}
            aria-label="Run workflow"
          >
            <FaPlay aria-hidden="true" />
            <span>Run</span>
          </button>
        )}

        <button
          type="button"
          className="command-dock-button"
          onClick={() => void onRetryFailed()}
          disabled={isProcessing || failedCount === 0}
          aria-label="Retry failed nodes"
          title="Retry failed nodes"
        >
          <FaRedo aria-hidden="true" />
        </button>
        <button
          type="button"
          className="command-dock-button"
          onClick={onOpenOutputs}
          disabled={outputCount === 0}
          aria-label="Open outputs"
          title="Open outputs"
        >
          <FaImages aria-hidden="true" />
        </button>
      </div>

      {(isProcessing || failedCount > 0 || currentNodeName) && (
        <div className="command-dock-status" aria-live="polite">
          <span>{total > 0 ? `${processed} / ${total}` : '0 / 0'}</span>
          {currentNodeName && <span className="command-dock-current">{currentNodeName}</span>}
          {failedCount > 0 && <span>{failedCount} failed</span>}
          <span>{outputCount} outputs</span>
        </div>
      )}

      {isProcessing && (
        <div className="command-dock-progress" aria-hidden="true">
          <div className="command-dock-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
    </section>
  );
};

export default CommandDock;
```

- [ ] **Step 4: Add initial command dock CSS**

Append to `src/components/WorkflowUX.css`:

```css
.command-dock {
  position: fixed;
  left: 50%;
  bottom: 12px;
  z-index: 900;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-color);
  pointer-events: none;
}

.command-dock-main,
.command-dock-status {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--node-border) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, #18191f 92%, transparent);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(16px);
}

.command-dock-main {
  min-height: 38px;
  padding: 4px;
}

.command-dock-button,
.command-dock-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
}

.command-dock-button:hover:not(:disabled),
.command-dock-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.command-dock-button:disabled,
.command-dock-action:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.command-dock-button--wide {
  min-width: 42px;
}

.command-dock-action {
  padding: 0 10px;
  font-weight: 700;
}

.command-dock-action--primary {
  background: #f4eeb1;
  color: #151515;
}

.command-dock-action--danger {
  color: #fecaca;
}

.command-dock-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.1);
}

.command-dock-zoom {
  min-width: 42px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.command-dock-menu-wrap {
  position: relative;
}

.command-dock-menu {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  min-width: 148px;
  transform: translateX(-50%);
  overflow: hidden;
  border: 1px solid var(--node-border);
  border-radius: 8px;
  background: #1d1e25;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.36);
}

.command-dock-menu-item {
  display: block;
  width: 100%;
  padding: 9px 11px;
  border: 0;
  background: transparent;
  color: var(--text-color);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.command-dock-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.command-dock-status {
  max-width: min(620px, calc(100vw - 108px));
  padding: 5px 9px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.command-dock-current {
  max-width: 180px;
  overflow: hidden;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-dock-progress {
  pointer-events: none;
  width: min(360px, calc(100vw - 108px));
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.command-dock-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f4eeb1, #55d6c2);
  transition: width 0.18s ease;
}
```

- [ ] **Step 5: Run command dock tests**

Run:

```powershell
npm run test:run -- src/components/CommandDock.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/CommandDock.tsx src/components/CommandDock.test.jsx src/components/WorkflowUX.css
git commit -m "feat: add compact canvas command dock"
```

---

### Task 3: Contextual Output Tray

**Files:**

- Modify: `src/components/OutputFilmstrip.tsx`
- Modify: `src/components/OutputFilmstrip.test.jsx`
- Modify: `src/components/WorkflowUX.css`

- [ ] **Step 1: Add failing close-action test**

Append this test to `src/components/OutputFilmstrip.test.jsx`:

```jsx
it('closes the contextual output tray', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(<OutputFilmstrip outputs={outputs} nodes={[]} onOpenGallery={vi.fn()} onClose={onClose} />);

  await user.click(screen.getByRole('button', { name: /close recent outputs/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run output filmstrip tests to verify failure**

Run:

```powershell
npm run test:run -- src/components/OutputFilmstrip.test.jsx
```

Expected: FAIL because there is no close button.

- [ ] **Step 3: Add `onClose` prop and close button**

Modify `src/components/OutputFilmstrip.tsx` imports:

```tsx
import { FaImages, FaTimes } from 'react-icons/fa';
```

Modify the props interface:

```tsx
interface OutputFilmstripProps {
  outputs: Output[];
  nodes: Node[];
  onOpenGallery: () => void;
  onClose?: () => void;
}
```

Modify the component signature:

```tsx
const OutputFilmstrip: React.FC<OutputFilmstripProps> = ({ outputs, nodes, onOpenGallery, onClose }) => {
```

Add the close button next to the gallery button inside `.filmstrip-header`:

```tsx
{onClose && (
  <button
    type="button"
    className="execution-action filmstrip-close"
    onClick={onClose}
    aria-label="Close recent outputs"
  >
    <FaTimes aria-hidden="true" />
  </button>
)}
```

- [ ] **Step 4: Tighten tray styling**

Add to `src/components/WorkflowUX.css`:

```css
.filmstrip-close {
  width: 30px;
  padding: 0;
}

.output-filmstrip {
  left: 76px;
  right: auto;
  bottom: 62px;
  width: min(720px, calc(100vw - 104px));
}
```

- [ ] **Step 5: Run output filmstrip tests**

Run:

```powershell
npm run test:run -- src/components/OutputFilmstrip.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/OutputFilmstrip.tsx src/components/OutputFilmstrip.test.jsx src/components/WorkflowUX.css
git commit -m "feat: make recent outputs contextual"
```

---

### Task 4: Workflow Title Chip

**Files:**

- Create: `src/components/WorkflowTitleChip.tsx`
- Create: `src/components/WorkflowTitleChip.test.jsx`
- Modify: `src/components/WorkflowUX.css`

- [ ] **Step 1: Write failing title chip tests**

Create `src/components/WorkflowTitleChip.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WorkflowTitleChip from './WorkflowTitleChip';

describe('WorkflowTitleChip', () => {
  it('shows the active workflow name', () => {
    render(
      <WorkflowTitleChip
        activeWorkflow={{ id: 'wf-1', name: 'Copy of Compositor Node' }}
        hasUnsavedChanges={false}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Copy of Compositor Node')).toBeInTheDocument();
  });

  it('shows an unsaved marker and saves when dirty', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <WorkflowTitleChip
        activeWorkflow={{ id: 'wf-1', name: 'Canvas' }}
        hasUnsavedChanges
        onSave={onSave}
      />
    );

    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save workflow/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('uses a fallback name when no workflow is active', () => {
    render(<WorkflowTitleChip activeWorkflow={null} hasUnsavedChanges={false} onSave={vi.fn()} />);

    expect(screen.getByText('Untitled Workflow')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run title chip tests to verify failure**

Run:

```powershell
npm run test:run -- src/components/WorkflowTitleChip.test.jsx
```

Expected: FAIL because `WorkflowTitleChip.tsx` does not exist.

- [ ] **Step 3: Implement title chip**

Create `src/components/WorkflowTitleChip.tsx`:

```tsx
import React from 'react';
import { FaSave } from 'react-icons/fa';
import './WorkflowUX.css';

interface WorkflowTitleChipProps {
  activeWorkflow: { id: string; name: string } | null;
  hasUnsavedChanges: boolean;
  onSave?: () => void | Promise<void>;
}

const WorkflowTitleChip: React.FC<WorkflowTitleChipProps> = ({
  activeWorkflow,
  hasUnsavedChanges,
  onSave,
}) => {
  const name = activeWorkflow?.name || 'Untitled Workflow';

  return (
    <section className="workflow-title-chip" aria-label="Active workflow">
      <span className="workflow-title-chip-name" title={name}>
        {name}
      </span>
      {hasUnsavedChanges && <span className="workflow-title-chip-status">Unsaved</span>}
      {hasUnsavedChanges && onSave && (
        <button
          type="button"
          className="workflow-title-chip-save"
          onClick={() => void onSave()}
          aria-label="Save workflow"
          title="Save workflow"
        >
          <FaSave aria-hidden="true" />
        </button>
      )}
    </section>
  );
};

export default WorkflowTitleChip;
```

- [ ] **Step 4: Add title chip CSS**

Append to `src/components/WorkflowUX.css`:

```css
.workflow-title-chip {
  position: fixed;
  top: 42px;
  left: 48px;
  z-index: 760;
  display: inline-flex;
  align-items: center;
  max-width: min(320px, calc(100vw - 112px));
  min-height: 30px;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--node-border) 70%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #1f2028 94%, transparent);
  color: var(--text-color);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.workflow-title-chip-name {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-title-chip-status {
  color: #f4eeb1;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.workflow-title-chip-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-color);
  cursor: pointer;
}
```

- [ ] **Step 5: Run title chip tests**

Run:

```powershell
npm run test:run -- src/components/WorkflowTitleChip.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/WorkflowTitleChip.tsx src/components/WorkflowTitleChip.test.jsx src/components/WorkflowUX.css
git commit -m "feat: add compact workflow title chip"
```

---

### Task 5: Slim Left Rail And Assistant Access

**Files:**

- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Sidebar.css`
- Modify: `src/components/Sidebar.test.jsx`

- [ ] **Step 1: Add failing assistant rail test**

Append to `src/components/Sidebar.test.jsx`:

```jsx
it('toggles the assistant from the icon rail', async () => {
  const user = userEvent.setup();
  const setShowAssistantPanel = vi.fn();
  useSettingsStore.setState({
    showTemplates: true,
    showAssistantPanel: false,
    setShowAssistantPanel,
  });

  render(<Sidebar {...buildProps()} />);

  await user.click(screen.getByTitle('Assistant'));
  expect(setShowAssistantPanel).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run Sidebar tests to verify failure**

Run:

```powershell
npm run test:run -- src/components/Sidebar.test.jsx
```

Expected: FAIL because there is no Assistant rail button.

- [ ] **Step 3: Add assistant toggle to Sidebar**

Modify the import list in `src/components/Sidebar.tsx`:

```tsx
  FaRobot,
```

Add settings store selectors near the existing `showTemplates` selector:

```tsx
  const showAssistantPanel = useSettingsStore((s) => s.showAssistantPanel);
  const setShowAssistantPanel = useSettingsStore((s) => s.setShowAssistantPanel);
```

Insert this button after Gallery and before Controls:

```tsx
          <button
            className={`sidebar-icon-button ${showAssistantPanel ? 'active' : ''}`}
            onClick={() => setShowAssistantPanel(!showAssistantPanel)}
            title="Assistant"
            aria-label={showAssistantPanel ? 'Hide assistant' : 'Show assistant'}
            aria-pressed={showAssistantPanel}
          >
            <FaRobot aria-hidden="true" />
            <span className="sidebar-icon-label">Assistant</span>
          </button>
```

- [ ] **Step 4: Restyle the rail toward the reference**

Modify the relevant blocks in `src/components/Sidebar.css`:

```css
.sidebar-container.icon-mode {
  position: fixed;
  left: 0;
  top: 30px;
  bottom: 0;
  transform: none;
  width: 36px;
  height: auto;
  background: color-mix(in srgb, #20212a 95%, transparent);
  border: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  box-shadow: none;
  z-index: 820;
  overflow: visible;
}

.sidebar-icon-bar {
  height: 100%;
  padding: 8px 0;
  gap: 7px;
}

.sidebar-icon-button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 13px;
  opacity: 0.72;
}

.sidebar-icon-button:hover,
.sidebar-icon-button.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-color);
  opacity: 1;
}

.sidebar-icon-button.primary {
  background: #f4eeb1;
  color: #111217;
  margin-bottom: 4px;
}

.sidebar-icon-label {
  left: calc(100% + 9px);
  padding: 5px 7px;
  border-radius: 6px;
  font-size: 11px;
}
```

- [ ] **Step 5: Keep rail labels discoverable and add Assistant to the expectation**

Keep `.sidebar-icon-label` elements in the DOM for hover/focus labels. Update the existing `adds discoverable labels to the icon rail` test to include Assistant:

```jsx
expect(screen.getByText('Assistant')).toBeInTheDocument();
```

- [ ] **Step 6: Run Sidebar tests**

Run:

```powershell
npm run test:run -- src/components/Sidebar.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/components/Sidebar.tsx src/components/Sidebar.css src/components/Sidebar.test.jsx
git commit -m "feat: slim the workspace rail"
```

---

### Task 6: App Shell Integration

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/ExecutionDock.test.jsx` only if the component becomes unused and tests are removed from the run list.
- Modify: `src/components/WorkflowUX.css`

- [ ] **Step 1: Run focused tests before integration**

Run:

```powershell
npm run test:run -- src/hooks/useContextualSurfaces.test.ts src/components/CommandDock.test.jsx src/components/WorkflowTitleChip.test.jsx src/components/OutputFilmstrip.test.jsx src/components/Sidebar.test.jsx
```

Expected: PASS.

- [ ] **Step 2: Import new shell units into `src/App.tsx`**

Add imports:

```tsx
import CommandDock from './components/CommandDock';
import WorkflowTitleChip from './components/WorkflowTitleChip';
import { useContextualSurfaces } from './hooks/useContextualSurfaces';
```

Stop rendering `ExecutionDock` and `EditorToolbar` from `App.tsx`. Keep their files in place in this plan so existing imports, tests, and future cleanup can be handled separately.

- [ ] **Step 3: Track viewport zoom for command dock display**

Add near other UI state:

```tsx
  const [zoomPercent, setZoomPercent] = useState(100);
```

Update the `ReactFlow` `onInit` prop:

```tsx
            onInit={(instance) => {
              setReactFlowInstance(instance);
              setZoomPercent(Math.round(instance.getZoom() * 100));
            }}
```

Add `onMoveEnd` to `ReactFlow`:

```tsx
            onMoveEnd={(_, viewport) => {
              setZoomPercent(Math.round(viewport.zoom * 100));
            }}
```

- [ ] **Step 4: Wire contextual surface state**

Add after `selectedFailedNode` and `dockTotal` are available:

```tsx
  const contextualSurfaces = useContextualSurfaces({
    selectedNodeId,
    failedNodeIds: failedNodes.map((failedNode) => failedNode.id),
    outputCount: normalizedWorkflowOutputs.length,
    isProcessing,
  });
```

- [ ] **Step 5: Render title chip and contextual inspector/output tray**

Add below `<Sidebar {...sidebarProps} />`:

```tsx
        {!showWelcome && (
          <WorkflowTitleChip
            activeWorkflow={activeWorkflow}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={saveCurrentWorkflow}
          />
        )}
```

Replace inspector rendering:

```tsx
      {!showWelcome && contextualSurfaces.showInspector && (
        <NodeInspectorPanel
          selectedNode={selectedNode}
          incomingEdges={selectedIncomingEdges}
          outgoingEdges={selectedOutgoingEdges}
          outputs={normalizedWorkflowOutputs}
          failedNode={selectedFailedNode}
          onRunNode={handleRunNode}
          onRetryNode={handleRetryNode}
          onDeleteNode={(nodeId) => void handleRemoveNode(nodeId)}
          onMoveNodeOrder={moveNodeOrder}
          onClose={contextualSurfaces.closeInspector}
        />
      )}
```

Replace output filmstrip rendering:

```tsx
      {!showWelcome && contextualSurfaces.showOutputTray && (
        <OutputFilmstrip
          outputs={normalizedWorkflowOutputs}
          nodes={nodes}
          onOpenGallery={() => setShowCanvasGallery(true)}
          onClose={contextualSurfaces.closeOutputTray}
        />
      )}
```

- [ ] **Step 6: Replace toolbar and execution dock with CommandDock**

Remove the `<EditorToolbar` component render block inside `<ReactFlow>`, including its `onUndo`, `onRedo`, `onAutoLayout`, grouping, and selection props.

Replace the `<ExecutionDock>` render block with:

```tsx
      {!showWelcome && (
        <CommandDock
          mode={contextualSurfaces.mode}
          isProcessing={isProcessing}
          processed={dockProcessed}
          total={dockTotal}
          failedCount={failedNodes.length}
          outputCount={normalizedWorkflowOutputs.length}
          currentNodeName={currentNodeName}
          zoomPercent={zoomPercent}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={hasSelection}
          hasGroupSelected={hasGroupSelected}
          onRun={() => runWorkflow()}
          onStop={stopWorkflow}
          onRetryFailed={handleRetryFailed}
          onOpenOutputs={contextualSurfaces.openOutputTray}
          onUndo={undo}
          onRedo={redo}
          onAutoLayout={autoLayout}
          onGroupSelected={groupSelectedNodes}
          onUngroupSelected={handleUngroupSelected}
        />
      )}
```

- [ ] **Step 7: Keep the command dock always visible**

The redesigned command dock is the primary command surface and stays visible whenever the canvas is visible. Leave `showEditorToolbar` in settings for compatibility, but do not use it to hide the command dock. Keep the exact `<CommandDock>` render block from Step 6 guarded only by `!showWelcome`.

Keep passing `showEditorToolbar` and `onShowEditorToolbarChange` through `sidebarProps` so the settings UI does not lose existing fields during this redesign.

- [ ] **Step 8: Run shell-related tests**

Run:

```powershell
npm run test:run -- src/hooks/useContextualSurfaces.test.ts src/components/CommandDock.test.jsx src/components/WorkflowTitleChip.test.jsx src/components/OutputFilmstrip.test.jsx src/components/Sidebar.test.jsx
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/App.tsx src/components/WorkflowUX.css
git commit -m "feat: wire reference-tight app shell"
```

---

### Task 7: Nodes, Handles, Edges, And Canvas Polish

**Files:**

- Modify: `src/components/BaseNode.tsx`
- Modify: `src/components/BaseNode.test.jsx`
- Modify: `src/components/CustomEdge.tsx`
- Modify: `src/App.css`
- Modify: `src/components/WorkflowUX.css`

- [ ] **Step 1: Add focused BaseNode tests for slim handles and hover-gated status**

Add to `src/components/BaseNode.test.jsx`:

```jsx
it('uses compact handle affordances instead of large add icons', () => {
  render(
    <BaseNode
      id="node-6"
      data={{ title: 'Node' }}
      selected={false}
      handles={[{ id: 'out', type: 'output', position: 'right', dataType: 'image' }]}
    />
  );

  expect(screen.getByTestId('handle')).toHaveClass('node-port-handle');
});

it('marks secondary status as contextual chrome', () => {
  render(
    <BaseNode
      id="node-7"
      data={{ title: 'Image', metadata: 'flux', output: 'ready' }}
      selected={false}
    />
  );

  expect(screen.getByLabelText('Node status')).toHaveClass('node-status-row');
});
```

- [ ] **Step 2: Run BaseNode tests to verify failure**

Run:

```powershell
npm run test:run -- src/components/BaseNode.test.jsx
```

Expected: FAIL because handles do not have `node-port-handle`.

- [ ] **Step 3: Update BaseNode handle markup**

In `src/components/BaseNode.tsx`, add `className="node-port-handle"` to `Handle`:

```tsx
            <Handle
              key={handle.id}
              className="node-port-handle"
              type={isInput ? 'target' : isOutput ? 'source' : (handle.type as 'target' | 'source')}
              position={handle.position}
              id={handle.id}
```

Replace the large `IoIosAddCircle` visual with:

```tsx
              <span className="node-port-handle-dot" aria-hidden="true" />
```

Remove the unused `IoIosAddCircle` import if it is no longer needed.

- [ ] **Step 4: Update node and canvas CSS**

Modify `src/App.css` to include the reference-tight dark defaults:

```css
.app-container {
  padding-top: 30px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
    var(--bg-color);
  background-size: 12px 12px;
}

.react-flow__background {
  opacity: 0.22;
}

.resizable-node {
  background: color-mix(in srgb, var(--node-bg) 92%, #111217);
  border: 1px solid color-mix(in srgb, var(--node-border) 70%, transparent);
  border-radius: 6px;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.2);
}

.resizable-node:hover,
.react-flow__node.selected .resizable-node {
  border-color: color-mix(in srgb, var(--primary-color) 55%, var(--node-border));
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
}

.custom-drag-handle {
  min-height: 6px !important;
  padding: 2px !important;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
}

.node-content {
  padding: 8px !important;
}

.node-floating-header {
  top: -30px;
  padding: 2px 0;
}

.node-floating-title {
  font-size: 12px;
}

.node-floating-metadata,
.node-floating-timer,
.node-status-badge {
  border-radius: 5px;
  padding: 2px 6px;
  font-size: 10px;
  opacity: 0.72;
}

.node-status-row {
  opacity: 0;
  transition: opacity 0.16s ease;
}

.base-node-container:hover .node-status-row,
.react-flow__node.selected .node-status-row {
  opacity: 1;
}

.node-port-handle {
  width: 16px !important;
  height: 16px !important;
  opacity: 0;
}

.node-port-handle-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 999px;
  background: currentColor;
}
```

- [ ] **Step 5: Tone down edge defaults**

In `src/components/CustomEdge.tsx`, change the BaseEdge style block:

```tsx
        style={{
          strokeWidth: selected ? 1.8 : isProcessing || isDataFlowing ? 1.8 : 1.2,
          stroke:
            isProcessing || isDataFlowing
              ? `url(#${flowGradientId})`
              : style?.stroke || 'rgba(150, 156, 166, 0.46)',
          strokeDasharray: isProcessing ? 4 : 0,
          animation: isProcessing ? 'dashdraw 1.2s linear infinite' : 'none',
        }}
```

Reduce glow opacity in `glowStyle`:

```tsx
    '--edge-glow-min': selected ? '0.25' : '0.12',
    '--edge-glow-max': selected ? '0.62' : '0.38',
    '--edge-glow-outer-min': selected ? '0.12' : '0.05',
    '--edge-glow-outer-max': selected ? '0.42' : '0.22',
```

- [ ] **Step 6: Run node tests and typecheck**

Run:

```powershell
npm run test:run -- src/components/BaseNode.test.jsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/components/BaseNode.tsx src/components/BaseNode.test.jsx src/components/CustomEdge.tsx src/App.css src/components/WorkflowUX.css
git commit -m "feat: polish canvas node graph chrome"
```

---

### Task 8: Contextual Panels, Responsive Rules, And Surface Styling

**Files:**

- Modify: `src/components/WorkflowUX.css`
- Modify: `src/components/Sidebar.css`
- Modify: `src/App.css`
- Modify: `src/components/ErrorRecoveryPanel.css`
- Modify: `src/components/Popover.css`

- [ ] **Step 1: Add compact contextual panel CSS**

Modify `src/components/WorkflowUX.css`:

```css
.node-inspector-panel {
  top: 48px;
  right: calc(12px + var(--assistant-panel-offset, 0px));
  bottom: auto;
  width: min(300px, calc(100vw - 92px));
  max-height: calc(100vh - 126px);
  border-radius: 8px;
  background: color-mix(in srgb, #1d1e25 94%, transparent);
}

.inspector-header {
  padding: 10px 11px;
}

.inspector-body {
  padding: 9px 11px 11px;
}

.inspector-title {
  max-width: 216px;
  font-size: 14px;
}

.connection-hint-overlay {
  left: 48px;
  top: 42px;
  width: min(300px, calc(100vw - 72px));
  border-radius: 8px;
  background: color-mix(in srgb, #1d1e25 94%, transparent);
}

.canvas-gallery-panel {
  inset: 44px 44px 44px 48px;
}

.app-container.gallery-open .canvas-gallery-panel {
  inset: 44px;
}
```

- [ ] **Step 2: Add responsive rules**

Append to `src/components/WorkflowUX.css`:

```css
@media (max-width: 900px) {
  .workflow-title-chip {
    left: 44px;
    right: 10px;
    max-width: none;
  }

  .command-dock {
    left: 44px;
    right: 10px;
    transform: none;
    align-items: stretch;
  }

  .command-dock-main {
    justify-content: center;
    overflow-x: auto;
  }

  .node-inspector-panel,
  .output-filmstrip,
  .connection-hint-overlay {
    left: 44px;
    right: 10px;
    width: auto;
  }

  .node-inspector-panel {
    top: auto;
    bottom: 62px;
    max-height: 48vh;
  }

  .output-filmstrip {
    bottom: 62px;
  }
}
```

- [ ] **Step 3: Restyle popovers and error recovery to match the compact dark system**

Append to `src/components/Popover.css`:

```css
.popover {
  border-radius: 8px;
}
```

Modify `src/components/ErrorRecoveryPanel.css` with compact dark surface defaults:

```css
.error-recovery-panel {
  border-radius: 8px;
  background: color-mix(in srgb, #1d1e25 96%, transparent);
  border-color: color-mix(in srgb, #ef4444 35%, var(--node-border));
}
```

- [ ] **Step 4: Run CSS-adjacent component tests**

Run:

```powershell
npm run test:run -- src/components/CommandDock.test.jsx src/components/OutputFilmstrip.test.jsx src/components/NodeInspectorPanel.test.jsx src/components/Sidebar.test.jsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/WorkflowUX.css src/components/Sidebar.css src/App.css src/components/ErrorRecoveryPanel.css src/components/Popover.css
git commit -m "style: align contextual panels with reference shell"
```

---

### Task 9: Default Dark Theme Token Polish

**Files:**

- Modify: `src/constants/themes.ts`
- Modify: `src/constants/themes.test.ts`
- Modify: `src/App.css`

- [ ] **Step 1: Add exact dark theme token coverage**

Add this test under the existing `describe('theme structure', () => {` block in `src/constants/themes.test.ts`:

```ts
    it('should define the reference-tight dark workspace tokens', () => {
      expect(themes.dark['--bg-color']).toBe('#08090d');
      expect(themes.dark['--bg-primary']).toBe('#08090d');
      expect(themes.dark['--bg-secondary']).toBe('#14151a');
      expect(themes.dark['--bg-tertiary']).toBe('#1d1e25');
      expect(themes.dark['--primary-color']).toBe('#f4eeb1');
      expect(themes.dark['--accent-color']).toBe('#55d6c2');
      expect(themes.dark['--node-bg']).toBe('#1b1c22');
      expect(themes.dark['--node-border']).toBe('#2a2c34');
    });
```

- [ ] **Step 2: Update the default dark palette**

Modify the `dark` entry in `src/constants/themes.ts`:

```ts
  dark: {
    '--bg-color': '#08090d',
    '--bg-primary': '#08090d',
    '--bg-secondary': '#14151a',
    '--bg-tertiary': '#1d1e25',
    '--text-color': '#f0f0ef',
    '--text-secondary': '#8a8d98',
    '--primary-color': '#f4eeb1',
    '--accent-color': '#55d6c2',
    '--node-bg': '#1b1c22',
    '--node-border': '#2a2c34',
    '--border-color': '#2a2c34',
    '--handle-color': '#55d6c2',
    '--settings-bg': '#15161b',
    '--drag-handle-bg': '#15161b',
    '--input-bg': '#17181e',
  },
```

- [ ] **Step 3: Run theme tests**

Run:

```powershell
npm run test:run -- src/constants/themes.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/constants/themes.ts src/constants/themes.test.ts src/App.css
git commit -m "style: tune default dark workspace theme"
```

---

### Task 10: Rendered QA And Final Fixes

**Files:**

- Modify only files needed by issues found during rendered QA.

- [ ] **Step 1: Run full static verification**

Run:

```powershell
npm run typecheck
npm run test:run -- src/hooks/useContextualSurfaces.test.ts src/components/CommandDock.test.jsx src/components/WorkflowTitleChip.test.jsx src/components/OutputFilmstrip.test.jsx src/components/Sidebar.test.jsx src/components/BaseNode.test.jsx src/components/NodeInspectorPanel.test.jsx
```

Expected: PASS.

- [ ] **Step 2: Start the dev server**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 3: Browser visual QA desktop**

Using the Browser plugin, verify:

- URL loads.
- Page title and DOM identify the noder app.
- First meaningful screen is not blank.
- No framework error overlay.
- Console has no relevant `error` or `warn` entries.
- Default dark shell shows slim left rail, top-left workflow chip or welcome state, and bottom-center command dock after leaving welcome.
- Inspector and output tray are absent in composition mode.
- Workflow/template/gallery/settings popovers open from the rail.

Capture a desktop screenshot and save it outside the repo or display it through Browser.

- [ ] **Step 4: Browser visual QA narrow viewport**

Set a narrow viewport around `390x844` and verify:

- Left rail does not overlap the title chip or command dock.
- Command dock scrolls or compresses without text overlap.
- Inspector/output tray use full-width bottom/side layout and do not cover all controls.

Capture a narrow screenshot and save it outside the repo or display it through Browser.

- [ ] **Step 5: Interaction QA**

Exercise at least these flows:

- Add or load a template workflow.
- Select a node and verify inspector opens.
- Close inspector and verify it stays dismissed for the same selected node.
- Open outputs from command dock when outputs exist.
- Open full gallery.
- Trigger run button with no nodes and verify disabled state, then with nodes and verify execution state changes.
- Open settings and confirm theme picker remains reachable.

- [ ] **Step 6: Fix visible issues**

For each issue found, make a targeted edit in the relevant CSS/component file, then rerun the narrowest relevant test and the browser check that exposed it.

- [ ] **Step 7: Final verification**

Run:

```powershell
npm run typecheck
npm run test:run
```

Expected: PASS. When a failure appears, inspect it before classifying it. For failures outside the changed surfaces, record the failing test names in the final QA notes and rerun the focused changed-surface tests to prove the redesign work.

- [ ] **Step 8: Commit final QA fixes**

```powershell
git add src
git commit -m "fix: polish reference-tight UI QA issues"
```

---

## Plan Self-Review

Spec coverage:

- App shell redesign is covered by Tasks 2, 4, 5, 6, and 8.
- Deeper contextual interaction model is covered by Tasks 1, 3, 6, and 10.
- Node/canvas visual system is covered by Tasks 7 and 9.
- Feature preservation is covered by Tasks 5, 6, and 10.
- Theme compatibility scope is covered by Task 9.
- Accessibility and responsive behavior are covered by Tasks 2, 4, 5, 8, and 10.
- Verification requirements are covered by Task 10.

No intentionally deferred production requirements are left out of this plan.
