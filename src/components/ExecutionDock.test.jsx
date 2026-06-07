import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ExecutionDock from './ExecutionDock';

const baseProps = {
  isProcessing: false,
  processed: 0,
  total: 3,
  failedCount: 0,
  outputCount: 2,
  currentNodeName: '',
  onRun: vi.fn(),
  onStop: vi.fn(),
  onRetryFailed: vi.fn(),
  onOpenOutputs: vi.fn(),
};

describe('ExecutionDock', () => {
  it('shows ready workflow state and runs the workflow', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();

    render(<ExecutionDock {...baseProps} onRun={onRun} />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('3 nodes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open outputs/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run workflow/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('shows active progress and exposes stop while running', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();

    render(
      <ExecutionDock
        {...baseProps}
        isProcessing
        processed={1}
        total={4}
        currentNodeName="Image Generation"
        onStop={onStop}
      />
    );

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getByText('Image Generation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stop workflow/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('offers retry when failed nodes exist', async () => {
    const user = userEvent.setup();
    const onRetryFailed = vi.fn();

    render(<ExecutionDock {...baseProps} failedCount={2} onRetryFailed={onRetryFailed} />);

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry failed/i }));
    expect(onRetryFailed).toHaveBeenCalledTimes(1);
  });
});
