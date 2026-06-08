import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPanel from './AssistantPanel';

vi.mock('../utils/openrouterClient', () => ({
  streamOpenRouter: vi.fn(),
}));

const renderAssistantPanel = () =>
  render(
    <AssistantPanel
      openRouterApiKey="test-key"
      systemPrompt="You are noder.bot."
      executeToolCall={vi.fn()}
    />
  );

const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('AssistantPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('assistant-panel-open', 'true');
    mockMatchMedia(false);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
  });

  it('resizes the open assistant panel from its left edge', () => {
    renderAssistantPanel();

    const panel = document.querySelector('.assistant-panel');
    const resizeHandle = screen.getByRole('separator', { name: /resize assistant panel/i });

    expect(panel).toHaveStyle({ width: '360px' });

    fireEvent.mouseDown(resizeHandle, { clientX: 840 });
    fireEvent.mouseMove(document, { clientX: 700 });

    expect(panel).toHaveStyle({ width: '500px' });
    expect(localStorage.getItem('assistant-panel-width')).toBe('500');

    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe('');
  });

  it('uses the compact mobile layout without desktop resize width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    mockMatchMedia(true);

    renderAssistantPanel();

    const panel = document.querySelector('.assistant-panel');

    expect(panel.style.width).toBe('');
    expect(
      screen.queryByRole('separator', { name: /resize assistant panel/i })
    ).not.toBeInTheDocument();
  });
});
