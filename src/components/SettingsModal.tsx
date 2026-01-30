import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FaKey,
  FaPalette,
  FaCog,
  FaFolder,
  FaTimes,
  FaDownload,
  FaCloudDownloadAlt,
  FaUpload,
  FaTrash,
  FaFileExport,
  FaEye,
  FaEyeSlash,
  FaProjectDiagram,
  FaCube,
  FaGoogle,
} from 'react-icons/fa';
import { SiOpenai, SiAnthropic } from 'react-icons/si';
import ReactMarkdown from 'react-markdown';
import { themes } from '../constants/themes';
import { useSettingsStore } from '../stores/useSettingsStore';
import type { EdgeType, TextProvider, MediaProvider } from '../stores/useSettingsStore';
import { SettingsModelPicker } from './SettingsModelPicker';
import './SettingsModal.css';

// Custom brand icons for services without official icons
const OpenRouterIcon: React.FC = () => (
  <svg viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" stroke="currentColor">
    <path
      d="M3 248.945C18 248.945 76 236 106 219C136 202 136 202 198 158C276.497 102.293 332 120.945 423 120.945"
      strokeWidth="90"
      fill="none"
    />
    <path d="M511 121.5L357.25 210.268L357.25 32.7324L511 121.5Z" />
    <path
      d="M0 249C15 249 73 261.945 103 278.945C133 295.945 133 295.945 195 339.945C273.497 395.652 329 377 420 377"
      strokeWidth="90"
      fill="none"
    />
    <path d="M508 376.445L354.25 287.678L354.25 465.213L508 376.445Z" />
  </svg>
);

const ReplicateIcon: React.FC = () => (
  <svg viewBox="0 0 1000 1000" width="1em" height="1em" fill="currentColor">
    <polygon points="1000,427.6 1000,540.6 603.4,540.6 603.4,1000 477,1000 477,427.6" />
    <polygon points="1000,213.8 1000,327 364.8,327 364.8,1000 238.4,1000 238.4,213.8" />
    <polygon points="1000,0 1000,113.2 126.4,113.2 126.4,1000 0,1000 0,0" />
  </svg>
);

const OllamaIcon: React.FC = () => (
  <svg viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M168.64 23.253c4.608 1.814 8.768 4.8 12.544 8.747 6.293 6.528 11.605 15.872 15.659 26.944 4.074 11.136 6.72 23.467 7.722 35.84a107.824 107.824 0 0143.712-13.568l1.088-.085c18.56-1.494 36.907 1.856 52.907 10.112a103.091 103.091 0 016.336 3.626c1.067-12.138 3.669-24.192 7.68-35.072 4.053-11.093 9.365-20.416 15.637-26.965a35.628 35.628 0 0112.566-8.747c5.482-2.133 11.306-2.517 16.981-.896 8.555 2.432 15.893 7.851 21.675 15.723 5.29 7.19 9.258 16.405 11.968 27.456 4.906 19.925 5.76 46.144 2.453 77.76l1.131.853.554.406c16.15 12.288 27.392 29.802 33.344 50.133 9.28 31.723 4.608 67.307-11.392 87.211l-.384.448.043.064c8.896 16.256 14.293 33.429 15.445 51.2l.043.64c1.365 22.72-4.267 45.589-17.365 68.053l-.15.213.214.512c10.069 24.683 13.226 49.536 9.344 74.368l-.128.832a13.888 13.888 0 01-15.936 11.435 13.83 13.83 0 01-11.31-10.43 13.828 13.828 0 01-.21-5.399c3.562-22.038.213-44.139-10.24-66.624a13.713 13.713 0 01.853-13.163l.085-.128c12.886-19.712 18.219-39.04 17.067-58.027-.981-16.618-6.933-32.938-17.067-48.49a13.737 13.737 0 013.84-18.902l.192-.128c5.184-3.392 9.963-12.053 12.374-23.893a90.218 90.218 0 00-2.027-42.112c-4.373-14.933-12.373-27.392-23.573-35.904-12.694-9.685-29.504-14.357-50.774-13.013a13.93 13.93 0 01-13.482-7.915c-6.699-14.187-16.47-24.341-28.651-30.635a70.145 70.145 0 00-37.803-7.082c-26.56 2.112-49.984 17.088-56.96 35.968a13.91 13.91 0 01-13.013 9.066c-22.763.043-40.384 5.376-53.269 14.998-11.136 8.32-18.731 19.946-22.742 33.877a86.824 86.824 0 00-1.45 40.235c2.389 11.904 7.061 21.76 12.416 27.072l.17.149c4.523 4.416 5.483 11.307 2.326 16.747-7.68 13.269-13.419 33.045-14.358 52.053-1.066 21.717 3.968 40.576 15.339 54.101l.341.406a13.711 13.711 0 012.027 14.72c-12.288 26.368-16.064 48.042-11.989 65.109a13.91 13.91 0 01-27.072 6.357c-5.184-21.717-1.664-46.592 10.09-74.624l.299-.746-.17-.256a92.574 92.574 0 01-12.758-27.926l-.107-.405a122.965 122.965 0 01-3.776-38.08c.939-19.413 5.931-39.296 13.27-55.253l.2..."
    />
  </svg>
);

const LMStudioIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" fillRule="evenodd">
    <path
      d="M2.84 2a1.273 1.273 0 100 2.547h14.107a1.273 1.273 0 100-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H22.04a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h14.106a1.274 1.274 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H15.38a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h14.106a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h9.698a1.273 1.273 0 100-2.547h-9.698z"
      fillOpacity=".3"
    />
    <path d="M2.84 2a1.273 1.273 0 100 2.547h10.287a1.274 1.274 0 000-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H18.22a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H11.56a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h5.78a1.273 1.273 0 100-2.547h-5.78z" />
  </svg>
);

const FalIcon: React.FC = () => (
  <svg
    viewBox="0 0 512 512"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit={2}
    width="1em"
    height="1em"
  >
    <path
      d="M330.176 0c8.864 0 16 7.2 16.8 16.032a166.368 166.368 0 00148.992 148.992c8.8.864 16.032 7.968 16.032 16.832v148.288c0 8.864-7.232 15.968-16.032 16.832a166.368 166.368 0 00-148.992 148.992c-.8 8.832-7.936 16.032-16.8 16.032H181.856c-8.864 0-15.968-7.2-16.832-16.032a166.4 166.4 0 00-148.992-148.992C7.2 346.112 0 339.008 0 330.144V181.856c0-8.864 7.2-15.968 16.032-16.832A166.4 166.4 0 00165.024 16.032C165.888 7.2 172.992 0 181.888 0h148.288zM102.816 255.584v.064c0 84.544 69.536 154.112 154.08 154.176 84.544-.064 154.08-69.632 154.08-154.176v-.064a154.144 154.144 0 00-154.08-154.24c-84.576.032-154.144 69.664-154.08 154.24z"
      fill="currentColor"
    />
  </svg>
);

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: FaCog },
  { id: 'apiKeys', label: 'API Keys', icon: FaKey },
  { id: 'models', label: 'Models', icon: FaCube },
  { id: 'appearance', label: 'Appearance', icon: FaPalette },
  { id: 'updates', label: 'Updates', icon: FaCloudDownloadAlt },
  { id: 'workflow', label: 'Workflow', icon: FaProjectDiagram },
];

// Update state types
export interface UpdateState {
  supported?: boolean;
  currentVersion?: string | null;
  updateStatus?: string;
  updateInfo?: {
    version?: string;
    publishedAt?: string;
    notes?: string;
  } | null;
  updatePath?: string | null;
  updateError?: string | null;
  lastUpdateCheck?: number | null;
}

export interface UpdateActions {
  onCheck?: () => void;
  onDownload?: () => void;
  onInstall?: () => void;
}

// Workflow actions - still need to be passed in since they interact with App state
export interface WorkflowActions {
  onSaveWorkflow?: () => void;
  onLoadWorkflow?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearWorkflow?: () => void;
  onExportWorkflow?: () => void;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateState?: UpdateState;
  updateActions?: UpdateActions;
  workflowActions?: WorkflowActions;
}

/**
 * SettingsModal - Application settings panel
 * Now uses Zustand stores directly for settings state
 */
export function SettingsModal({
  isOpen,
  onClose,
  updateState = {},
  updateActions = {},
  workflowActions = {},
}: SettingsModalProps) {
  // Use Zustand store directly - no more prop drilling!
  const {
    // API Keys
    openaiApiKey,
    openRouterApiKey,
    anthropicApiKey,
    replicateApiKey,
    falApiKey,
    geminiApiKey,
    ollamaBaseUrl,
    lmStudioBaseUrl,
    // General settings
    defaultSaveLocation,
    showTemplates,
    showAssistantPanel,
    runButtonUnlocked,
    runButtonPosition,
    // Default models
    defaultTextModel,
    defaultImageModel,
    defaultVideoModel,
    defaultAudioModel,
    defaultUpscalerModel,
    // Edge appearance
    edgeType,
    // Theme
    currentTheme,
    // Default providers
    defaultTextProvider,
    defaultImageProvider,
    defaultVideoProvider,
    defaultAudioProvider,
    defaultUpscalerProvider,
    // Setters
    setOpenAIApiKey,
    setOpenRouterApiKey,
    setAnthropicApiKey,
    setReplicateApiKey,
    setFalApiKey,
    setGeminiApiKey,
    setOllamaBaseUrl,
    setLmStudioBaseUrl,
    setDefaultSaveLocation,
    setShowTemplates,
    setShowAssistantPanel,
    setRunButtonUnlocked,
    setRunButtonPosition,
    setDefaultTextModel,
    setDefaultImageModel,
    setDefaultVideoModel,
    setDefaultAudioModel,
    setDefaultUpscalerModel,
    setEdgeType,
    setCurrentTheme,
    setDefaultTextProvider,
    setDefaultImageProvider,
    setDefaultVideoProvider,
    setDefaultAudioProvider,
    setDefaultUpscalerProvider,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState('general');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  const {
    supported: updateSupported = false,
    currentVersion = null,
    updateStatus = 'idle',
    updateInfo = null,
    updatePath = null,
    updateError = null,
    lastUpdateCheck = null,
  } = updateState;

  const {
    onCheck: onUpdateCheck,
    onDownload: onUpdateDownload,
    onInstall: onUpdateInstall,
  } = updateActions;

  const { onSaveWorkflow, onLoadWorkflow, onClearWorkflow, onExportWorkflow } = workflowActions;

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap and click outside to close
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleKeyVisibility = (keyName: string) => {
    setVisibleKeys((prev) => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderApiKeyInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    keyName: string,
    Icon?: React.ComponentType
  ) => (
    <div className="settings-field api-key-field">
      <label className="settings-label">
        {Icon && (
          <span className="settings-label-icon">
            <Icon />
          </span>
        )}
        {label}
      </label>
      <div className="api-key-input-wrapper">
        <input
          type={visibleKeys[keyName] ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter your ${label} API key`}
          className="settings-input"
        />
        <button
          type="button"
          className="visibility-toggle"
          onClick={() => toggleKeyVisibility(keyName)}
          title={visibleKeys[keyName] ? 'Hide' : 'Show'}
        >
          {visibleKeys[keyName] ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    </div>
  );

  const renderToggle = (
    value: boolean,
    onChange: (value: boolean) => void,
    label: string,
    description?: string
  ) => (
    <div className="settings-field">
      <div className="toggle-row">
        <div className="toggle-info">
          <label className="settings-label">{label}</label>
          {description && <small className="settings-help">{description}</small>}
        </div>
        <button
          type="button"
          className={`toggle-switch ${value ? 'active' : ''}`}
          onClick={() => onChange(!value)}
          role="switch"
          aria-checked={value}
        >
          <span className="toggle-knob" />
        </button>
      </div>
    </div>
  );

  const renderActionButton = (
    label: string,
    description: string,
    onClick: () => void,
    disabled = false
  ) => (
    <div className="settings-field">
      <button
        type="button"
        className="settings-action-button"
        onClick={onClick}
        disabled={disabled}
      >
        <span className="settings-action-title">{label}</span>
        {description && <span className="settings-action-desc">{description}</span>}
      </button>
    </div>
  );

  const renderGeneralTab = () => (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">File Storage</h3>
        <div className="settings-field">
          <label className="settings-label">Default Save Location</label>
          <div className="input-with-icon">
            <FaFolder className="input-icon" />
            <input
              type="text"
              value={defaultSaveLocation || ''}
              onChange={(e) => setDefaultSaveLocation(e.target.value)}
              placeholder="Downloads/noder"
              className="settings-input with-icon"
            />
          </div>
          <small className="settings-help">Default folder for saving generated media files</small>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Sidebar</h3>
        {renderToggle(
          showTemplates,
          setShowTemplates,
          'Show Templates Button',
          'Show or hide the workflow templates button in the sidebar'
        )}
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Assistant & Controls</h3>
        {renderToggle(
          showAssistantPanel,
          setShowAssistantPanel,
          'Show AI Assistant Panel',
          'Show or hide the noder.bot assistant panel'
        )}
        {renderToggle(
          runButtonUnlocked,
          setRunButtonUnlocked,
          'Unlock Run Workflow Button',
          'Enable the drag handle to reposition the floating Run Workflow button'
        )}
        {renderActionButton(
          'Reset Run Button Position',
          'Restore the default bottom-right position',
          () => setRunButtonPosition({ x: 20, y: 20 }),
          !runButtonPosition
        )}
      </div>
    </div>
  );

  const renderApiKeysTab = () => (
    <div className="settings-tab-content">
      {/* Major AI Providers */}
      <div className="settings-group">
        <h3 className="settings-group-title">Major AI Providers</h3>
        <p className="settings-group-description">
          API keys for leading AI companies. Keys are stored locally and never shared.
        </p>

        {renderApiKeyInput('OpenAI', openaiApiKey, setOpenAIApiKey, 'openai', SiOpenai)}
        {renderApiKeyInput(
          'Anthropic',
          anthropicApiKey,
          setAnthropicApiKey,
          'anthropic',
          SiAnthropic
        )}
        {renderApiKeyInput('Google Gemini', geminiApiKey, setGeminiApiKey, 'gemini', FaGoogle)}
      </div>

      {/* Model Aggregators */}
      <div className="settings-group">
        <h3 className="settings-group-title">Model Aggregators</h3>
        <p className="settings-group-description">
          Access multiple AI models through unified APIs.
        </p>

        {renderApiKeyInput(
          'OpenRouter',
          openRouterApiKey,
          setOpenRouterApiKey,
          'openrouter',
          OpenRouterIcon
        )}
        {renderApiKeyInput(
          'Replicate',
          replicateApiKey,
          setReplicateApiKey,
          'replicate',
          ReplicateIcon
        )}
        {renderApiKeyInput('Fal', falApiKey, setFalApiKey, 'fal', FalIcon)}
      </div>

      {/* Local AI Providers */}
      <div className="settings-group">
        <h3 className="settings-group-title">Local AI Providers</h3>
        <p className="settings-group-description">
          Configure local AI servers for running models on your own hardware.
        </p>

        <div className="settings-field api-key-field">
          <label className="settings-label">
            <span className="settings-label-icon">
              <OllamaIcon />
            </span>
            Ollama Base URL
          </label>
          <input
            type="text"
            value={ollamaBaseUrl || ''}
            onChange={(e) => setOllamaBaseUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="settings-input"
          />
        </div>

        <div className="settings-field api-key-field">
          <label className="settings-label">
            <span className="settings-label-icon">
              <LMStudioIcon />
            </span>
            LM Studio Base URL
          </label>
          <input
            type="text"
            value={lmStudioBaseUrl || ''}
            onChange={(e) => setLmStudioBaseUrl(e.target.value)}
            placeholder="http://localhost:1234"
            className="settings-input"
          />
        </div>
      </div>
    </div>
  );

  const renderAppearanceTab = () => {
    // Light themes (backgrounds with high brightness)
    const lightThemes = [
      'github',
      'cream',
      'solarized-light',
      'paper',
      'snow',
      'sand',
      'rose-pine-dawn',
      'latte',
      'peach',
      'sage',
      'lilac',
      'seafoam',
      'apricot',
      'clay',
      'blossom',
      'honey',
      'mist',
      'matcha',
    ];

    const themeNames = Object.keys(themes);
    const darkThemes = themeNames.filter((t) => !lightThemes.includes(t));
    const availableLightThemes = themeNames.filter((t) => lightThemes.includes(t));

    const renderThemeCard = (themeName: string) => {
      const theme = themes[themeName as keyof typeof themes];
      if (!theme) return null;

      return (
        <button
          key={themeName}
          className={`theme-card ${currentTheme === themeName ? 'active' : ''}`}
          onClick={() => setCurrentTheme(themeName)}
          style={
            {
              '--theme-bg': theme['--bg-color'],
              '--theme-primary': theme['--primary-color'],
              '--theme-secondary': theme['--bg-secondary'],
              '--theme-text': theme['--text-color'],
            } as React.CSSProperties
          }
        >
          <div className="theme-preview">
            <div className="theme-preview-header" />
            <div className="theme-preview-body">
              <div className="theme-preview-node" />
              <div className="theme-preview-node" />
            </div>
          </div>
          <span className="theme-name">{themeName}</span>
        </button>
      );
    };

    return (
      <div className="settings-tab-content">
        <div className="settings-group">
          <h3 className="settings-group-title">Theme</h3>
          <p className="settings-group-description">Choose a color theme for the interface</p>

          <div className="theme-section">
            <h4 className="theme-category-title">Dark Themes</h4>
            <div className="theme-grid">{darkThemes.map(renderThemeCard)}</div>
          </div>

          <div className="theme-section">
            <h4 className="theme-category-title">Light Themes</h4>
            <div className="theme-grid">{availableLightThemes.map(renderThemeCard)}</div>
          </div>
        </div>

        <div className="settings-group">
          <h3 className="settings-group-title">Edge Style</h3>
          <p className="settings-group-description">
            Choose how connections between nodes are drawn
          </p>
          <div className="edge-type-grid">
            {(
              [
                { id: 'bezier', label: 'Bezier', description: 'Smooth curved lines' },
                {
                  id: 'smoothstep',
                  label: 'Smooth Step',
                  description: 'Rounded right-angle edges',
                },
                { id: 'step', label: 'Step', description: 'Sharp right-angle edges' },
                { id: 'straight', label: 'Straight', description: 'Direct straight lines' },
              ] as const
            ).map((type) => (
              <button
                key={type.id}
                className={`edge-type-card ${edgeType === type.id ? 'active' : ''}`}
                onClick={() => setEdgeType(type.id as EdgeType)}
              >
                <div className="edge-type-preview">
                  <svg viewBox="0 0 80 40" className="edge-preview-svg">
                    {type.id === 'bezier' && (
                      <path
                        d="M 10 35 C 30 35, 50 5, 70 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    )}
                    {type.id === 'smoothstep' && (
                      <path
                        d="M 10 35 L 10 20 Q 10 12, 18 12 L 62 12 Q 70 12, 70 5 L 70 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    )}
                    {type.id === 'step' && (
                      <path
                        d="M 10 35 L 10 20 L 70 20 L 70 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    )}
                    {type.id === 'straight' && (
                      <path d="M 10 35 L 70 5" fill="none" stroke="currentColor" strokeWidth="2" />
                    )}
                    <circle cx="10" cy="35" r="4" fill="currentColor" />
                    <circle cx="70" cy="5" r="4" fill="currentColor" />
                  </svg>
                </div>
                <span className="edge-type-label">{type.label}</span>
                <span className="edge-type-description">{type.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderUpdatesTab = () => {
    const statusLabels: Record<string, string> = {
      idle: 'Idle',
      checking: 'Checking for updates',
      available: 'Update available',
      downloading: 'Downloading update',
      ready: 'Ready to install',
      installing: 'Installing update',
      'up-to-date': 'Up to date',
      error: 'Update failed',
    };

    const statusText = statusLabels[updateStatus] || 'Unknown';
    const lastCheckedText = lastUpdateCheck ? new Date(lastUpdateCheck).toLocaleString() : 'Never';
    const publishedText = updateInfo?.publishedAt
      ? new Date(updateInfo.publishedAt).toLocaleDateString()
      : '-';
    const isBusy = ['checking', 'downloading', 'installing'].includes(updateStatus);

    return (
      <div className="settings-tab-content">
        <div className="settings-group">
          <h3 className="settings-group-title">App Updates</h3>
          <p className="settings-group-description">Check for updates and keep noder up to date.</p>

          {!updateSupported && (
            <div className="update-banner">Updates are available in the desktop build.</div>
          )}

          <div className="update-meta-grid">
            <div className="update-meta-item">
              <span className="update-meta-label">Current version</span>
              <span className="update-meta-value">{currentVersion || 'Unknown'}</span>
            </div>
            <div className="update-meta-item">
              <span className="update-meta-label">Latest version</span>
              <span className="update-meta-value">{updateInfo?.version || '-'}</span>
            </div>
            <div className="update-meta-item">
              <span className="update-meta-label">Last checked</span>
              <span className="update-meta-value">{lastCheckedText}</span>
            </div>
            <div className="update-meta-item">
              <span className="update-meta-label">Status</span>
              <span className={`update-status-pill status-${updateStatus}`}>{statusText}</span>
            </div>
            <div className="update-meta-item">
              <span className="update-meta-label">Published</span>
              <span className="update-meta-value">{publishedText}</span>
            </div>
          </div>

          {updateError && <div className="update-error">{updateError}</div>}

          <div className="update-actions">
            <button
              type="button"
              className="update-action-button"
              onClick={() => onUpdateCheck?.()}
              disabled={!updateSupported || isBusy}
            >
              Check for updates
            </button>
            {updateInfo && !updatePath && (
              <button
                type="button"
                className="update-action-button"
                onClick={() => onUpdateDownload?.()}
                disabled={!updateSupported || isBusy}
              >
                Download update
              </button>
            )}
            {updatePath && (
              <button
                type="button"
                className="update-action-button primary"
                onClick={() => onUpdateInstall?.()}
                disabled={!updateSupported || isBusy}
              >
                Install and restart
              </button>
            )}
          </div>

          {updateInfo?.notes && (
            <div className="update-notes">
              <div className="update-notes-title">Release notes</div>
              <ReactMarkdown className="update-notes-content">{updateInfo.notes}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWorkflowTab = () => (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">Workflow Management</h3>
        <p className="settings-group-description">Save, load, and manage your workflows</p>

        <div className="workflow-actions-grid">
          <button className="workflow-action-card" onClick={onSaveWorkflow}>
            <div className="workflow-action-icon">
              <FaDownload />
            </div>
            <div className="workflow-action-info">
              <span className="workflow-action-title">Save Workflow</span>
              <span className="workflow-action-desc">Download current workflow as JSON</span>
            </div>
          </button>

          <button
            className="workflow-action-card"
            onClick={() => document.getElementById('settingsLoadWorkflowInput')?.click()}
          >
            <div className="workflow-action-icon">
              <FaUpload />
            </div>
            <div className="workflow-action-info">
              <span className="workflow-action-title">Load Workflow</span>
              <span className="workflow-action-desc">Import workflow from JSON file</span>
            </div>
            <input
              id="settingsLoadWorkflowInput"
              type="file"
              accept=".json"
              onChange={onLoadWorkflow}
              style={{ display: 'none' }}
            />
          </button>

          {onExportWorkflow && (
            <button className="workflow-action-card" onClick={onExportWorkflow}>
              <div className="workflow-action-icon">
                <FaFileExport />
              </div>
              <div className="workflow-action-info">
                <span className="workflow-action-title">Export Workflow</span>
                <span className="workflow-action-desc">Export as shareable format</span>
              </div>
            </button>
          )}

          <button className="workflow-action-card danger" onClick={onClearWorkflow}>
            <div className="workflow-action-icon">
              <FaTrash />
            </div>
            <div className="workflow-action-info">
              <span className="workflow-action-title">Clear Workflow</span>
              <span className="workflow-action-desc">Remove all nodes and connections</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // Provider availability helpers
  interface ProviderOption {
    id: string;
    label: string;
    available: boolean;
  }

  const getAvailableTextProviders = (): ProviderOption[] => {
    return [
      { id: 'openrouter', label: 'OpenRouter', available: !!openRouterApiKey },
      { id: 'openai', label: 'OpenAI', available: !!openaiApiKey },
      { id: 'anthropic', label: 'Anthropic', available: !!anthropicApiKey },
      { id: 'google', label: 'Google Gemini', available: !!geminiApiKey },
      { id: 'ollama', label: 'Ollama', available: !!ollamaBaseUrl },
      { id: 'lmstudio', label: 'LM Studio', available: !!lmStudioBaseUrl },
    ];
  };

  const getAvailableImageProviders = (): ProviderOption[] => {
    return [
      { id: 'replicate', label: 'Replicate', available: !!replicateApiKey },
      { id: 'fal', label: 'Fal', available: !!falApiKey },
      { id: 'openrouter', label: 'OpenRouter', available: !!openRouterApiKey },
    ];
  };

  // Video, audio, and upscaler are supported by Replicate and Fal
  const getAvailableMediaProviders = (): ProviderOption[] => {
    return [
      { id: 'replicate', label: 'Replicate', available: !!replicateApiKey },
      { id: 'fal', label: 'Fal', available: !!falApiKey },
    ];
  };

  // Map provider IDs to their icon components
  const getProviderIcon = (providerId: string): React.ReactNode => {
    switch (providerId) {
      case 'openrouter':
        return <OpenRouterIcon />;
      case 'replicate':
        return <ReplicateIcon />;
      case 'fal':
        return <FalIcon />;
      case 'openai':
        return <SiOpenai />;
      case 'anthropic':
        return <SiAnthropic />;
      case 'google':
        return <FaGoogle />;
      case 'ollama':
        return <OllamaIcon />;
      case 'lmstudio':
        return <LMStudioIcon />;
      default:
        return null;
    }
  };

  const renderProviderSelect = (
    providers: ProviderOption[],
    value: string,
    onChange: (value: string) => void
  ) => {
    const availableProviders = providers.filter((p) => p.available);
    const currentProvider = providers.find((p) => p.id === value);
    const isCurrentAvailable = currentProvider?.available ?? false;

    return (
      <div className="provider-select-wrapper">
        <span className="provider-icon">{getProviderIcon(value)}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="settings-select provider-select"
        >
          {/* Show current selection even if not available (with warning) */}
          {!isCurrentAvailable && currentProvider && (
            <option value={currentProvider.id} disabled>
              {currentProvider.label} (No API Key)
            </option>
          )}
          {availableProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
          {availableProviders.length === 0 && (
            <option value="" disabled>
              No providers configured
            </option>
          )}
        </select>
      </div>
    );
  };

  const renderModelWithProvider = (
    label: string,
    providerValue: string,
    providerOptions: ProviderOption[],
    onProviderChange: (value: string) => void,
    modelValue: string,
    onModelChange: (value: string) => void,
    placeholder: string,
    modelType: 'text' | 'image' | 'video' | 'audio' | 'upscaler',
    helpText?: string
  ) => (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <div className="model-provider-row">
        {renderProviderSelect(providerOptions, providerValue, onProviderChange)}
        <SettingsModelPicker
          value={modelValue}
          onChange={onModelChange}
          provider={providerValue as TextProvider | MediaProvider}
          modelType={modelType}
          placeholder={placeholder}
        />
      </div>
      {helpText && <small className="settings-help">{helpText}</small>}
    </div>
  );

  const renderModelsTab = () => {
    const textProviders = getAvailableTextProviders();
    const imageProviders = getAvailableImageProviders();
    const mediaProviders = getAvailableMediaProviders(); // Video, audio, upscaler - Replicate only

    return (
      <div className="settings-tab-content">
        <div className="settings-group">
          <h3 className="settings-group-title">Default Models</h3>
          <p className="settings-group-description">
            Set default models for new nodes. These will be used when you create new nodes of each
            type.
          </p>

          {renderModelWithProvider(
            'Text Generation',
            defaultTextProvider,
            textProviders,
            (v) => setDefaultTextProvider(v as TextProvider),
            defaultTextModel,
            setDefaultTextModel,
            'openai/gpt-4o-mini',
            'text',
            'Default model for Text/LLM nodes'
          )}

          {renderModelWithProvider(
            'Image Generation',
            defaultImageProvider,
            imageProviders,
            (v) => setDefaultImageProvider(v as MediaProvider),
            defaultImageModel,
            setDefaultImageModel,
            'black-forest-labs/flux-2-klein-4b',
            'image',
            'Default model for Image nodes'
          )}

          {renderModelWithProvider(
            'Video Generation',
            defaultVideoProvider,
            mediaProviders,
            (v) => setDefaultVideoProvider(v as MediaProvider),
            defaultVideoModel,
            setDefaultVideoModel,
            'lightricks/ltx-2-fast',
            'video',
            'Default model for Video nodes'
          )}

          {renderModelWithProvider(
            'Audio Generation',
            defaultAudioProvider,
            mediaProviders,
            (v) => setDefaultAudioProvider(v as MediaProvider),
            defaultAudioModel,
            setDefaultAudioModel,
            'google/lyria-2',
            'audio',
            'Default model for Audio nodes'
          )}

          {renderModelWithProvider(
            'Upscaler',
            defaultUpscalerProvider,
            mediaProviders,
            (v) => setDefaultUpscalerProvider(v as MediaProvider),
            defaultUpscalerModel,
            setDefaultUpscalerModel,
            'recraft-ai/recraft-crisp-upscale',
            'upscaler',
            'Default model for Upscaler nodes'
          )}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab();
      case 'apiKeys':
        return renderApiKeysTab();
      case 'models':
        return renderModelsTab();
      case 'appearance':
        return renderAppearanceTab();
      case 'updates':
        return renderUpdatesTab();
      case 'workflow':
        return renderWorkflowTab();
      default:
        return renderGeneralTab();
    }
  };

  return createPortal(
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="settings-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-modal-header">
          <h2 id="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close settings">
            <FaTimes />
          </button>
        </div>

        <div className="settings-modal-body">
          <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`settings-panel-${tab.id}`}
                id={`settings-tab-${tab.id}`}
              >
                <tab.icon className="tab-icon" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div
            className="settings-content"
            role="tabpanel"
            id={`settings-panel-${activeTab}`}
            aria-labelledby={`settings-tab-${activeTab}`}
          >
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SettingsModal;
