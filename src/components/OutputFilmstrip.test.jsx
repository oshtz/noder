import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OutputFilmstrip from './OutputFilmstrip';

const outputs = [
  {
    id: 'out-1',
    nodeId: 'image-1',
    type: 'image',
    value: 'https://example.com/image.png',
    prompt: 'first',
    timestamp: 1000,
  },
  {
    id: 'out-2',
    nodeId: 'text-1',
    type: 'text',
    value: 'Generated caption',
    prompt: 'second',
    timestamp: 2000,
  },
];

describe('OutputFilmstrip', () => {
  it('shows recent outputs with their source node context', () => {
    render(
      <OutputFilmstrip
        outputs={outputs}
        nodes={[
          { id: 'image-1', type: 'image', position: { x: 0, y: 0 }, data: { title: 'Image' } },
          { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { title: 'Text' } },
        ]}
        onOpenGallery={vi.fn()}
      />
    );

    expect(screen.getByText('Recent outputs')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('Generated caption')).toBeInTheDocument();
  });

  it('opens the full gallery from the tray', async () => {
    const user = userEvent.setup();
    const onOpenGallery = vi.fn();

    render(<OutputFilmstrip outputs={outputs} nodes={[]} onOpenGallery={onOpenGallery} />);

    await user.click(screen.getByRole('button', { name: /open gallery/i }));
    expect(onOpenGallery).toHaveBeenCalledTimes(1);
  });

  it('does not render when there are no outputs', () => {
    const { container } = render(
      <OutputFilmstrip outputs={[]} nodes={[]} onOpenGallery={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('closes the contextual output tray', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OutputFilmstrip outputs={outputs} nodes={[]} onOpenGallery={vi.fn()} onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: /close recent outputs/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
