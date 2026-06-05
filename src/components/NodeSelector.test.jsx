import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NodeSelector from './NodeSelector';

const eventBus = vi.hoisted(() => {
  const handlers = {};
  return {
    handlers,
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
      return vi.fn();
    }),
  };
});

vi.mock('reactflow', () => ({
  useNodes: () => [],
}));

vi.mock('../utils/eventBus', () => ({
  emit: eventBus.emit,
  on: eventBus.on,
}));

const nodeDefinitions = [
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'video', label: 'Video' },
  { type: 'audio', label: 'Audio' },
  { type: 'upscaler', label: 'Upscaler' },
  { type: 'chip', label: 'Chip' },
];

describe('NodeSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    eventBus.handlers.openNodeSelector = undefined;
    vi.clearAllMocks();
  });

  it('turns Learn about Nodes into an expandable guide', async () => {
    const user = userEvent.setup();
    render(
      <NodeSelector
        nodeDefinitions={nodeDefinitions}
        onAddNode={vi.fn()}
        screenToFlowPosition={(position) => position}
      />
    );

    act(() => {
      eventBus.handlers.openNodeSelector(
        new CustomEvent('openNodeSelector', {
          detail: {
            position: { x: 80, y: 80 },
            clickPosition: { x: 80, y: 80 },
            connectionContext: null,
          },
        })
      );
    });

    await user.click(await screen.findByRole('button', { name: /learn about nodes/i }));
    const guide = screen.getByText(/Tip: Drag from a node handle/i).closest('#node-selector-guide');

    expect(guide).toBeTruthy();
    expect(within(guide).getByText(/Draft prompts, transform text/i)).toBeInTheDocument();
    expect(within(guide).getByText(/Generate or edit still images/i)).toBeInTheDocument();
    expect(within(guide).getByText(/Drag from a node handle/i)).toBeInTheDocument();
  });
});
