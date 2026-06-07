import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConnectionHintOverlay from './ConnectionHintOverlay';

describe('ConnectionHintOverlay', () => {
  it('shows the dragged data type and compatible targets', () => {
    render(
      <ConnectionHintOverlay
        hint={{
          sourceNodeLabel: 'Image',
          sourceHandleType: 'image',
          compatibleTargets: [
            { nodeId: 'upscaler-1', label: 'Upscaler', handleId: 'image-in' },
            { nodeId: 'video-1', label: 'Video', handleId: 'image-in' },
          ],
          invalidReason: null,
        }}
      />
    );

    expect(screen.getByText('Image output')).toBeInTheDocument();
    expect(screen.getByText('2 compatible targets')).toBeInTheDocument();
    expect(screen.getByText('Upscaler')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows a reason when there are no compatible targets', () => {
    render(
      <ConnectionHintOverlay
        hint={{
          sourceNodeLabel: 'Audio',
          sourceHandleType: 'audio',
          compatibleTargets: [],
          invalidReason: 'No nodes accept audio input yet.',
        }}
      />
    );

    expect(screen.getByText('No nodes accept audio input yet.')).toBeInTheDocument();
  });

  it('renders nothing without an active connection hint', () => {
    const { container } = render(<ConnectionHintOverlay hint={null} />);

    expect(container.firstChild).toBeNull();
  });
});
