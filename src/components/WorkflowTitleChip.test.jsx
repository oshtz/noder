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
