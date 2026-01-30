import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from './Sidebar';
import { invoke } from '@tauri-apps/api/core';

vi.mock('./Popover', () => ({
  default: ({ children }) => <div data-testid="popover">{children}</div>,
}));

vi.mock('./SettingsModal', () => ({
  default: ({ isOpen }) => (isOpen ? <div data-testid="settings-modal" /> : null),
}));

vi.mock('./OutputGallery', () => ({
  default: () => <div data-testid="output-gallery" />,
}));

const buildProps = (overrides = {}) => ({
  onWorkflowLoad: vi.fn(),
  activeWorkflow: null,
  hasUnsavedChanges: false,
  onSave: vi.fn(),
  isOpen: true,
  onToggle: vi.fn(),
  workflowOutputs: [],
  database: null,
  onThemeChange: vi.fn(),
  currentTheme: 'default',
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
  runButtonPosition: null,
  onRunButtonPositionReset: vi.fn(),
  onSaveWorkflow: vi.fn(),
  onLoadWorkflow: vi.fn(),
  onExportWorkflow: vi.fn(),
  onClearWorkflow: vi.fn(),
  onLoadTemplate: vi.fn(),
  workflowTemplates: [],
  onGalleryDragStart: vi.fn(),
  onGalleryDragEnd: vi.fn(),
  updateState: {},
  updateActions: {},
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
  showEditorToolbar: false,
  onShowEditorToolbarChange: vi.fn(),
  onGoHome: vi.fn(),
  ...overrides,
});

describe('Sidebar', () => {
  beforeEach(() => {
    invoke.mockImplementation(async (command) => {
      if (command === 'list_workflows') {
        return [{ id: 'wf-1', name: 'First Workflow' }];
      }
      return null;
    });
  });

  it('loads workflows and shows them in the popover', async () => {
    const user = userEvent.setup();
    render(<Sidebar {...buildProps()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('list_workflows');
    });

    await user.click(screen.getByTitle('Workflows'));
    expect(await screen.findByText('First Workflow')).toBeInTheDocument();
  });

  it('calls onGoHome when the home button is clicked', async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();
    render(<Sidebar {...buildProps({ onGoHome })} />);

    await user.click(screen.getByTitle('Home'));
    expect(onGoHome).toHaveBeenCalled();
  });

  it('opens the settings modal when settings is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar {...buildProps()} />);

    await user.click(screen.getByTitle('Settings'));
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
  });

  it('shows the new workflow input when add is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar {...buildProps()} />);

    await user.click(screen.getByTitle('Add Workflow'));
    expect(screen.getByPlaceholderText('Workflow Name')).toBeInTheDocument();
  });
});
