import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomeScreen from './WelcomeScreen';
import { useSettingsStore } from '../stores/useSettingsStore';

vi.mock('./FaultyTerminal', () => ({
  default: () => <div data-testid="welcome-backdrop" />,
}));

const templates = [
  {
    id: 'starter',
    name: 'Starter Flow',
    description: 'A short starter workflow',
    icon: 'magic',
    category: 'beginner',
    nodes: [],
    edges: [],
  },
];

describe('WelcomeScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ showAssistantPanel: true });
  });

  it('shows a first-run onboarding summary above the starting actions', () => {
    render(<WelcomeScreen templates={templates} />);

    expect(screen.getByRole('heading', { name: 'Build creative AI workflows visually' }));
    expect(screen.getByText(/Chain text, image, video, audio, and utility nodes/i));
    expect(screen.getByText('Choose a starting point')).toBeInTheDocument();
    expect(screen.getByText('Connect providers')).toBeInTheDocument();
    expect(screen.getByText('Run and compare outputs')).toBeInTheDocument();
  });

  it('keeps the start-from-scratch naming flow intact', async () => {
    const user = userEvent.setup();
    const onStartFromScratch = vi.fn();
    render(<WelcomeScreen templates={templates} onStartFromScratch={onStartFromScratch} />);

    await user.click(screen.getByRole('button', { name: /start from scratch/i }));
    await user.type(screen.getByPlaceholderText('Name your workflow'), 'Launch Flow');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onStartFromScratch).toHaveBeenCalledWith('Launch Flow');
  });
});
