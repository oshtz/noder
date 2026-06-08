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

    await user.click(screen.getByRole('button', { name: /^group selected nodes$/i }));
    expect(onGroupSelected).toHaveBeenCalledTimes(1);
  });
});
