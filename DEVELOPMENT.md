# Noder Development Guide

This document provides guidance for developers working on the Noder codebase.

---

## Architecture Overview

Noder is a Tauri-based desktop application with a React frontend using ReactFlow for the node-based canvas.

```
src/
├── api/              # API client abstractions
├── components/       # React components
├── constants/        # App constants and configurations
├── context/          # React Context providers
├── hooks/            # Custom React hooks
├── nodes/            # Node type definitions and components
├── stores/           # Zustand state management stores
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

---

## State Management

Noder uses **Zustand** for state management with four main stores:

| Store | Purpose | Location |
|-------|---------|----------|
| `useSettingsStore` | API keys, preferences, theme | `src/stores/useSettingsStore.ts` |
| `useWorkflowStore` | Nodes, edges, workflow metadata | `src/stores/useWorkflowStore.ts` |
| `useUIStore` | Modal states, panel visibility | `src/stores/useUIStore.ts` |
| `useExecutionStore` | Processing state, errors | `src/stores/useExecutionStore.ts` |

### Using Stores

```typescript
import { useSettingsStore } from '../stores/useSettingsStore';

// Use selector hooks for optimal re-renders
const theme = useSettingsStore((s) => s.currentTheme);

// Or use convenience selectors
import { useCurrentTheme } from '../stores/useSettingsStore';
const theme = useCurrentTheme();
```

---

## Creating a New Node

### 1. Define the Node Schema

Add a schema in `src/nodes/nodeSchemas.ts`:

```typescript
export const myNodeSchema: NodeSchema = {
  type: 'my-node',
  label: 'My Node',
  category: 'core',
  inputs: [
    { id: 'in', label: 'Input', type: 'text' }
  ],
  outputs: [
    { id: 'out', label: 'Output', type: 'text' }
  ],
  fields: [
    { id: 'prompt', label: 'Prompt', type: 'textarea' }
  ]
};
```

### 2. Create the Node Component

Create `src/nodes/core/MyNode.tsx`:

```typescript
import React from 'react';
import BaseNode from '../../components/BaseNode';

interface MyNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected: boolean;
}

const MyNode: React.FC<MyNodeProps> = ({ id, data, selected }) => {
  return (
    <BaseNode
      id={id}
      type="my-node"
      data={data}
      selected={selected}
    />
  );
};

export default MyNode;
```

### 3. Register the Node

Add to `src/nodes/index.tsx`:

```typescript
import MyNode from './core/MyNode';

export const nodeTypes = {
  // ... existing nodes
  'my-node': MyNode,
};
```

---

## Handle Type System

Handles define connection points on nodes. The system validates connections based on type compatibility.

### Handle Types

| Type | Description | Can Connect To |
|------|-------------|----------------|
| `text` | Text/string data | `text`, `prompt` |
| `image` | Image URLs | `image` |
| `video` | Video URLs | `video` |
| `audio` | Audio URLs | `audio` |
| `prompt` | Prompt input | `text`, `prompt` |

### Validation

Connection validation is handled in `src/utils/handleValidation.ts`:

```typescript
import { getValidator, isValidConnection } from '../utils/handleValidation';

// Check if a connection is valid
const isValid = isValidConnection(sourceHandle, targetHandle);
```

---

## Event Bus

Noder uses a typed pub/sub event bus for cross-component communication.

### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `node:select` | `{ nodeId: string }` | Node was selected |
| `node:delete` | `{ nodeId: string }` | Node was deleted |
| `workflow:run` | `{ targetNodeIds?: string[] }` | Workflow execution started |
| `workflow:complete` | `{ success: boolean }` | Workflow execution completed |

### Usage

```typescript
import { emit, on } from '../utils/eventBus';

// Subscribe to events
const unsubscribe = on('node:select', ({ nodeId }) => {
  console.log('Node selected:', nodeId);
});

// Emit events
emit('node:select', { nodeId: 'node-123' });

// Cleanup
unsubscribe();
```

---

## Tauri Commands

Backend commands are invoked via Tauri's IPC system. Type definitions are in `src/types/tauri.ts`.

### Using Typed Invoke

```typescript
import { invoke } from '../types/tauri';

// Typed invoke with autocomplete
const result = await invoke('load_settings');
```

### Available Commands

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `load_settings` | - | `AppSettings` | Load app settings |
| `save_settings` | `{ settings }` | `void` | Save app settings |
| `list_workflows` | - | `Workflow[]` | List saved workflows |
| `load_workflow` | `{ id }` | `Workflow` | Load a workflow |
| `save_workflow` | `{ workflow }` | `string` | Save a workflow |
| `replicate_create_prediction` | `{ model, input }` | `Prediction` | Create Replicate prediction |

---

## CSS Architecture

Noder uses a mix of global CSS and CSS Modules.

### CSS Modules (Recommended for new components)

```typescript
import styles from './MyComponent.module.css';

const MyComponent = () => (
  <div className={styles.container}>
    <span className={styles.title}>Title</span>
  </div>
);
```

### Theme Variables

Theme colors are defined as CSS custom properties. Access them via:

```css
.my-class {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

Available theme variables are defined in `src/constants/themes.ts`.

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests once
npm run test:run

# Run with coverage
npm test -- --coverage
```

### Writing Tests

Tests use Vitest with React Testing Library:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

---

## Code Splitting

Large components are lazy-loaded for performance:

```typescript
import { lazy, Suspense } from 'react';

const LazyComponent = lazy(() => import('./LazyComponent'));

const App = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <LazyComponent />
  </Suspense>
);
```

Currently lazy-loaded: AssistantPanel, SettingsModal, OutputGallery, WelcomeScreen

---

## Pre-commit Hooks

Husky runs lint-staged on commit:

- **TypeScript/TSX files**: Prettier + ESLint with `--max-warnings=0`
- **JavaScript/JSX files**: Prettier + ESLint
- **CSS/JSON/MD files**: Prettier

---

## Development Workflow

1. Create a feature branch from `dev`
2. Make changes following the patterns above
3. Run tests: `npm test`
4. Run lint: `npm run lint`
5. Commit (Husky will run checks)
6. Open PR to `dev`

---

## Keyboard Shortcuts

Press `?` in the editor to open the keyboard shortcuts overlay. Key shortcuts include:

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete selected nodes |
| `Ctrl+D` | Duplicate selected nodes |
| `Ctrl+C` | Copy selected nodes |
| `Ctrl+V` | Paste nodes |
| `Ctrl+G` | Group selected nodes |
| `Ctrl+Shift+G` | Ungroup selected group |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+Enter` | Run workflow |
| `?` | Show shortcuts overlay |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           App.tsx                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Sidebar   │  │  ReactFlow  │  │  Assistant  │                  │
│  │             │  │   Canvas    │  │    Panel    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   Zustand   │    │   Hooks     │    │  EventBus   │
   │   Stores    │    │             │    │             │
   │             │    │ useUndo     │    │ emit/on     │
   │ Settings    │    │ useDragDrop │    │             │
   │ Execution   │    │ useGenerate │    │             │
   │ Workflow    │    │ useKeyboard │    │             │
   └─────────────┘    └─────────────┘    └─────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Tauri Backend  │
                    │                 │
                    │  • Replicate    │
                    │  • File I/O     │
                    │  • Settings     │
                    │  • Workflows    │
                    └─────────────────┘
```

---

## JSDoc Examples

When documenting public utility functions, follow these patterns:

### createNode.ts

```typescript
/**
 * Creates a new node with the specified type and configuration.
 *
 * @param type - The node type (e.g., 'image', 'text', 'video')
 * @param position - Canvas position {x, y}
 * @param data - Optional initial data for the node
 * @returns A ReactFlow Node object ready for insertion
 *
 * @example
 * const imageNode = createNode('image', { x: 100, y: 100 });
 * setNodes(nodes => [...nodes, imageNode]);
 */
export function createNode(
  type: string,
  position: { x: number; y: number },
  data?: Record<string, unknown>
): Node { ... }
```

### eventBus.ts

```typescript
/**
 * Emits an event to all registered listeners.
 *
 * @param event - The event name to emit
 * @param payload - Data to pass to listeners
 *
 * @example
 * emit('nodeContentChanged', {
 *   sourceId: 'node-1',
 *   targetId: 'node-2',
 *   content: { type: 'text', value: 'Hello' }
 * });
 */
export function emit<K extends keyof EventMap>(
  event: K,
  payload: EventMap[K]
): void { ... }

/**
 * Subscribes to an event.
 *
 * @param event - The event name to listen for
 * @param callback - Function called when event is emitted
 * @returns Unsubscribe function
 *
 * @example
 * const unsubscribe = on('workflow:complete', (result) => {
 *   console.log('Workflow finished:', result.success);
 * });
 * // Later: unsubscribe();
 */
export function on<K extends keyof EventMap>(
  event: K,
  callback: (payload: EventMap[K]) => void
): () => void { ... }
```

### handleValidation.ts

```typescript
/**
 * Checks if two handles can be connected based on type compatibility.
 *
 * @param sourceHandle - The source (output) handle type
 * @param targetHandle - The target (input) handle type
 * @returns True if the connection is valid
 *
 * @example
 * canConnect('image', 'image'); // true
 * canConnect('text', 'prompt'); // true
 * canConnect('video', 'image'); // false
 */
export function canConnect(
  sourceHandle: HandleType,
  targetHandle: HandleType
): boolean { ... }
```

### workflowRunner.ts

```typescript
/**
 * Executes a workflow by processing nodes in dependency order.
 *
 * @param nodes - Array of workflow nodes
 * @param edges - Array of edges connecting nodes
 * @param options - Execution options
 * @param options.onProgress - Called as each node completes
 * @param options.onError - Called if a node fails
 * @returns Promise resolving to execution result
 *
 * @example
 * const result = await runWorkflow(nodes, edges, {
 *   onProgress: (nodeId, status) => {
 *     console.log(`Node ${nodeId}: ${status}`);
 *   },
 *   onError: (nodeId, error) => {
 *     console.error(`Node ${nodeId} failed:`, error);
 *   }
 * });
 */
export async function runWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: RunWorkflowOptions
): Promise<WorkflowResult> { ... }
```

---

## Bundle Analysis

Run bundle analysis to identify optimization opportunities:

```bash
npm run analyze
```

This generates `bundle-stats.html` with an interactive visualization of bundle composition.

---

*Last updated: 2026-01-17*
