import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmptyWorkflowOverlay from './EmptyWorkflowOverlay';
import { useSettingsStore } from '../stores/useSettingsStore';

describe('EmptyWorkflowOverlay', () => {
  beforeEach(() => {
    useSettingsStore.setState({ showAssistantPanel: true });
  });

  it('explains how to open the node menu on an empty canvas', () => {
    render(<EmptyWorkflowOverlay onBuildWithAI={vi.fn()} onStartFromScratch={vi.fn()} />);

    expect(screen.getByText(/Double-click the canvas/i)).toBeInTheDocument();
    expect(screen.getByText('Open node menu anywhere on the canvas')).toBeInTheDocument();
  });

  it('still opens the manual start action', async () => {
    const user = userEvent.setup();
    const onStartFromScratch = vi.fn();
    render(
      <EmptyWorkflowOverlay onBuildWithAI={vi.fn()} onStartFromScratch={onStartFromScratch} />
    );

    await user.click(screen.getByRole('button', { name: /open node menu/i }));

    expect(onStartFromScratch).toHaveBeenCalled();
  });
});
