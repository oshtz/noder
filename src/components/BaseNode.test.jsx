import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BaseNode from './BaseNode';
import { emit } from '../utils/eventBus';

vi.mock('reactflow', () => ({
  Handle: ({ id, children }) => (
    <div data-testid="handle" data-handle-id={id}>
      {children}
    </div>
  ),
  Position: {
    Left: 'left',
    Right: 'right',
    Top: 'top',
    Bottom: 'bottom',
  },
}));

vi.mock('@reactflow/node-resizer', () => ({
  NodeResizer: () => <div data-testid="node-resizer" />,
}));

vi.mock('./NodeSettingsPopover', () => ({
  NodeSettingsPopover: ({ children }) => <div data-testid="settings-popover">{children}</div>,
}));

describe('BaseNode', () => {
  it('emits a custom title when edited', async () => {
    const user = userEvent.setup();
    render(<BaseNode id="node-1" data={{ title: 'Text', customTitle: null }} selected={false} />);

    await user.dblClick(screen.getByText('Text'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Title');
    await user.tab();

    expect(emit).toHaveBeenCalledWith('nodeDataUpdated', {
      nodeId: 'node-1',
      updates: { customTitle: 'New Title' },
    });
  });

  it('renders handles for configured ports', () => {
    render(
      <BaseNode
        id="node-2"
        data={{ title: 'Node' }}
        selected={false}
        handles={[
          { id: 'in', type: 'input', position: 'left', dataType: 'text' },
          { id: 'out', type: 'output', position: 'right', dataType: 'text' },
        ]}
      />
    );

    const handles = screen.getAllByTestId('handle');
    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveAttribute('data-handle-id', 'in');
    expect(handles[1]).toHaveAttribute('data-handle-id', 'out');
  });

  it('calls onRemove when delete is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <BaseNode
        id="node-3"
        data={{ title: 'Delete Me', executionOrder: 1, onRemove }}
        selected={true}
      />
    );

    await user.click(screen.getByRole('button', { name: /delete node/i }));
    expect(onRemove).toHaveBeenCalledWith('node-3');
  });
});
