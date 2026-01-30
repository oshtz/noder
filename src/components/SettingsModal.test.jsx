import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';

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
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsModal {...buildProps({ onClose })} />);
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.closest('.settings-modal-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });
});
