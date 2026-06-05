import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';
import { useSettingsStore } from '../stores/useSettingsStore';

const buildProps = (overrides = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  onThemeChange: vi.fn(),
  currentTheme: 'default',
  updateState: {},
  updateActions: {},
  openaiApiKey: '',
  onOpenAIApiKeyChange: vi.fn(),
  openRouterApiKey: '',
  onOpenRouterApiKeyChange: vi.fn(),
  anthropicApiKey: '',
  onAnthropicApiKeyChange: vi.fn(),
  replicateApiKey: '',
  onReplicateApiKeyChange: vi.fn(),
  geminiApiKey: '',
  onGeminiApiKeyChange: vi.fn(),
  ollamaBaseUrl: '',
  onOllamaBaseUrlChange: vi.fn(),
  lmStudioBaseUrl: '',
  onLmStudioBaseUrlChange: vi.fn(),
  defaultSaveLocation: '',
  onDefaultSaveLocationChange: vi.fn(),
  showTemplates: false,
  onShowTemplatesChange: vi.fn(),
  showAssistantPanel: false,
  onShowAssistantPanelChange: vi.fn(),
  runButtonUnlocked: false,
  onRunButtonUnlockedChange: vi.fn(),
  runButtonPosition: { x: 10, y: 10 },
  onRunButtonPositionReset: vi.fn(),
  onSaveWorkflow: vi.fn(),
  onLoadWorkflow: vi.fn(),
  onClearWorkflow: vi.fn(),
  onExportWorkflow: vi.fn(),
  defaultTextModel: '',
  onDefaultTextModelChange: vi.fn(),
  defaultImageModel: '',
  onDefaultImageModelChange: vi.fn(),
  defaultVideoModel: '',
  onDefaultVideoModelChange: vi.fn(),
  defaultAudioModel: '',
  onDefaultAudioModelChange: vi.fn(),
  defaultUpscalerModel: '',
  onDefaultUpscalerModelChange: vi.fn(),
  edgeType: 'bezier',
  onEdgeTypeChange: vi.fn(),
  ...overrides,
});

describe('SettingsModal', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      openaiApiKey: '',
      openRouterApiKey: '',
      anthropicApiKey: '',
      replicateApiKey: '',
      falApiKey: '',
      geminiApiKey: '',
      ollamaBaseUrl: '',
      lmStudioBaseUrl: '',
      defaultSaveLocation: '',
      defaultTextModel: 'openai/gpt-4o-mini',
      defaultImageModel: 'black-forest-labs/flux-2-klein-4b',
      defaultVideoModel: 'lightricks/ltx-2-fast',
      defaultAudioModel: 'google/lyria-2',
      defaultUpscalerModel: 'recraft-ai/recraft-crisp-upscale',
      defaultTextProvider: 'openrouter',
      defaultImageProvider: 'replicate',
      defaultVideoProvider: 'replicate',
      defaultAudioProvider: 'replicate',
      defaultUpscalerProvider: 'replicate',
    });
  });

  it('renders when open', () => {
    render(<SettingsModal {...buildProps()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    render(<SettingsModal {...buildProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('switches tabs and shows API keys content', async () => {
    const user = userEvent.setup();
    render(<SettingsModal {...buildProps()} />);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('tab', { name: /api keys/i }));
    expect(screen.getByText('Major AI Providers')).toBeInTheDocument();
  });

  it('closes when overlay is clicked', async () => {
    const onClose = vi.fn();
    render(<SettingsModal {...buildProps({ onClose })} />);
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.closest('.settings-modal-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows setup readiness on the general tab', () => {
    render(<SettingsModal {...buildProps()} />);

    expect(screen.getByText('Setup readiness')).toBeInTheDocument();
    expect(screen.getByText('Providers configured')).toBeInTheDocument();
    expect(screen.getByText('Default save location')).toBeInTheDocument();
    expect(screen.getByText('Default models')).toBeInTheDocument();
  });

  it('guides users to configure providers before choosing default models', async () => {
    const user = userEvent.setup();
    render(<SettingsModal {...buildProps()} />);
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('tab', { name: /models/i }));

    expect(screen.getAllByText('No providers configured')[0]).toBeInTheDocument();
    expect(screen.getByText(/Add an API key or local provider/i)).toBeInTheDocument();
  });
});
