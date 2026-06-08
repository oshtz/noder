import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NodeInspectorPanel from './NodeInspectorPanel';

const selectedNode = {
  id: 'image-1',
  type: 'image',
  position: { x: 0, y: 0 },
  data: {
    title: 'Image',
    customTitle: 'Hero render',
    model: 'black-forest-labs/flux',
    metadata: 'flux',
    executionOrder: 2,
    lastRunDurationMs: 1234,
    output: 'https://example.com/image.png',
  },
};

describe('NodeInspectorPanel', () => {
  it('summarizes the selected node and its workflow relationships', () => {
    render(
      <NodeInspectorPanel
        selectedNode={selectedNode}
        incomingEdges={[{ id: 'e1', source: 'text-1', target: 'image-1' }]}
        outgoingEdges={[{ id: 'e2', source: 'image-1', target: 'upscaler-1' }]}
        outputs={[{ id: 'out-1', nodeId: 'image-1', type: 'image', value: 'url' }]}
        failedNode={null}
        onRunNode={vi.fn()}
        onRetryNode={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Hero render')).toBeInTheDocument();
    expect(screen.getByText('black-forest-labs/flux')).toBeInTheDocument();
    expect(screen.getByText('1 input')).toBeInTheDocument();
    expect(screen.getByText('1 output')).toBeInTheDocument();
    expect(screen.getByText('1 saved output')).toBeInTheDocument();
    expect(screen.getByText('1.23s')).toBeInTheDocument();
  });

  it('shows node failure details and retries the selected node', async () => {
    const user = userEvent.setup();
    const onRetryNode = vi.fn();

    render(
      <NodeInspectorPanel
        selectedNode={{ ...selectedNode, data: { ...selectedNode.data, error: 'Missing API key' } }}
        incomingEdges={[]}
        outgoingEdges={[]}
        outputs={[]}
        failedNode={{ id: 'image-1', error: 'Missing API key', node: selectedNode }}
        onRunNode={vi.fn()}
        onRetryNode={onRetryNode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Missing API key')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry node/i }));
    expect(onRetryNode).toHaveBeenCalledWith('image-1');
  });

  it('renders nothing when no node is selected', () => {
    const { container } = render(
      <NodeInspectorPanel
        selectedNode={null}
        incomingEdges={[]}
        outgoingEdges={[]}
        outputs={[]}
        failedNode={null}
        onRunNode={vi.fn()}
        onRetryNode={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Select a node')).not.toBeInTheDocument();
  });
});
