import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
  ChangeEvent,
} from 'react';
import {
  FaPalette,
  FaVideo,
  FaMusic,
  FaBalanceScale,
  FaComment,
  FaStar,
  FaSeedling,
  FaBolt,
  FaRocket,
  FaMagic,
  FaFolderOpen,
  FaRobot,
  FaFilm,
  FaFileAlt,
  FaClock,
} from 'react-icons/fa';
import { IconType } from 'react-icons';
import './WelcomeScreen.css';
import noderLogo from '../../noderBG.png';
import FaultyTerminal from './FaultyTerminal';
import { useShowAssistantPanel } from '../stores/useSettingsStore';
import { logger } from '../utils/logger';
import { invoke } from '../types/tauri';
import type {
  WorkflowTemplate as Template,
  TemplateCategory as WorkflowTemplateCategory,
} from '../utils/workflowTemplates';

// =============================================================================
// Types
// =============================================================================

interface Workflow {
  id: string;
  name: string;
  updated_at?: string;
}

interface TemplateCategory {
  id: WorkflowTemplateCategory;
  label: string;
  icon: string;
}

interface IndicatorStyle {
  width: number;
  transform: string;
  opacity: number;
}

interface TemplateGalleryProps {
  templates: Template[];
  onLoadTemplate?: (template: Template) => void;
}

interface WorkflowsListProps {
  onLoadWorkflow?: (workflow: Workflow) => void;
}

interface WelcomeScreenProps {
  onBuildWithAI?: () => void;
  onStartFromScratch?: (name: string) => void;
  onLoadWorkflow?: (workflow?: Workflow) => void;
  onLoadTemplate?: (template: Template) => void;
  templates?: Template[];
}

type ViewMode = 'templates' | 'workflows';

// =============================================================================
// Constants
// =============================================================================

const VIEW_MODE_STORAGE_KEY = 'noder-welcome-view-mode';

// Icon mapping for template and category icons
const iconMap: Record<string, IconType> = {
  palette: FaPalette,
  video: FaVideo,
  music: FaMusic,
  balance: FaBalanceScale,
  comment: FaComment,
  star: FaStar,
  seedling: FaSeedling,
  bolt: FaBolt,
  rocket: FaRocket,
  magic: FaMagic,
  folder: FaFolderOpen,
  robot: FaRobot,
  film: FaFilm,
};

const getIcon = (iconName: string, size: number = 24): JSX.Element | null => {
  const IconComponent = iconMap[iconName];
  return IconComponent ? <IconComponent size={size} /> : null;
};

const templateCategories: TemplateCategory[] = [
  { id: 'beginner', label: 'Beginner', icon: 'seedling' },
  { id: 'intermediate', label: 'Intermediate', icon: 'bolt' },
  { id: 'advanced', label: 'Advanced', icon: 'rocket' },
];

const onboardingSteps = [
  {
    step: '01',
    title: 'Choose a starting point',
    description: 'Open a template, load a saved workflow, or begin with a clean canvas.',
  },
  {
    step: '02',
    title: 'Connect providers',
    description: 'Add API keys or local provider URLs so new nodes are ready to run.',
  },
  {
    step: '03',
    title: 'Run and compare outputs',
    description: 'Execute the flow, inspect results, and keep the strongest output paths.',
  },
];

// =============================================================================
// WelcomeBackdrop Component
// =============================================================================

const WelcomeBackdrop = React.memo(() => (
  <>
    <div className="welcome-terminal" aria-hidden="true">
      <FaultyTerminal
        scale={2}
        gridMul={[2, 1]}
        digitSize={2}
        timeScale={0.4}
        pause={false}
        scanlineIntensity={0}
        glitchAmount={9}
        flickerAmount={1}
        noiseAmp={0.5}
        chromaticAberration={0}
        dither={0}
        curvature={0.4}
        tint="#ffffff"
        pageLoadAnimation={false}
        brightness={0.4}
      />
    </div>
  </>
));

WelcomeBackdrop.displayName = 'WelcomeBackdrop';

// =============================================================================
// TemplateGallery Component
// =============================================================================

const TemplateGallery = React.memo<TemplateGalleryProps>(({ templates, onLoadTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState<WorkflowTemplateCategory>('beginner');
  const categoriesRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({
    width: 0,
    transform: 'translateX(0px)',
    opacity: 0,
  });

  const updateIndicator = useCallback(() => {
    const container = categoriesRef.current;
    const button = buttonRefs.current[selectedCategory];
    if (!container || !button) return;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const left = buttonRect.left - containerRect.left;
    setIndicatorStyle({
      width: buttonRect.width,
      transform: `translateX(${left}px)`,
      opacity: 1,
    });
  }, [selectedCategory]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const container = categoriesRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateIndicator]);

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.category === selectedCategory),
    [templates, selectedCategory]
  );

  return (
    <div className="welcome-templates">
      <h2 className="templates-title">Start from a Template</h2>

      <div className="templates-categories" ref={categoriesRef}>
        <span className="templates-category-indicator" aria-hidden="true" style={indicatorStyle} />
        {templateCategories.map((category) => (
          <button
            key={category.id}
            className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
            ref={(node) => {
              if (node) {
                buttonRefs.current[category.id] = node;
              }
            }}
          >
            <span className="category-icon">{getIcon(category.icon, 16)}</span>
            <span className="category-label">{category.label}</span>
          </button>
        ))}
      </div>

      <div className="templates-grid">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="template-card"
            onClick={() => onLoadTemplate && onLoadTemplate(template)}
          >
            <div className="template-icon">{getIcon(template.icon, 32)}</div>
            <h3 className="template-name">{template.name}</h3>
            <p className="template-description">{template.description}</p>
            <div className="template-stats">
              <span className="template-stat">{template.nodes.length} nodes</span>
              <span className="template-stat">{template.edges.length} connections</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

TemplateGallery.displayName = 'TemplateGallery';

// =============================================================================
// WorkflowsList Component
// =============================================================================

const WorkflowsList = React.memo<WorkflowsListProps>(({ onLoadWorkflow }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkflows = async (): Promise<void> => {
      try {
        setLoading(true);
        const workflowsList = (await invoke('list_workflows')) as Workflow[];
        setWorkflows(Array.isArray(workflowsList) ? workflowsList : []);
      } catch (error) {
        logger.error('Failed to load workflows:', error);
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflows();
  }, []);

  if (loading) {
    return (
      <div className="welcome-templates">
        <h2 className="templates-title">Your Workflows</h2>
        <div className="workflows-loading">Loading workflows...</div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="welcome-templates">
        <h2 className="templates-title">Your Workflows</h2>
        <div className="workflows-empty">
          <p>No saved workflows yet</p>
          <p className="workflows-empty-hint">Create your first workflow to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-templates">
      <h2 className="templates-title">Your Workflows</h2>
      <div className="workflows-list">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="workflow-card"
            onClick={() => onLoadWorkflow && onLoadWorkflow(workflow)}
          >
            <div className="workflow-icon">
              <FaFileAlt size={32} />
            </div>
            <div className="workflow-info">
              <h3 className="workflow-name">{workflow.name}</h3>
              {workflow.updated_at && (
                <div className="workflow-meta">
                  <FaClock size={12} />
                  <span>{new Date(workflow.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

WorkflowsList.displayName = 'WorkflowsList';

// =============================================================================
// WelcomeScreen Component
// =============================================================================

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onBuildWithAI,
  onStartFromScratch,
  onLoadWorkflow,
  onLoadTemplate,
  templates = [],
}) => {
  // Read showAssistantPanel from settings store
  const showAssistantPanel = useShowAssistantPanel();

  const [isNaming, setIsNaming] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return saved === 'workflows' ? 'workflows' : 'templates';
    } catch {
      return 'templates';
    }
  });

  // Persist view mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (error) {
      logger.error('Failed to save view mode:', error);
    }
  }, [viewMode]);

  useEffect(() => {
    if (isNaming) {
      nameInputRef.current?.focus();
    }
  }, [isNaming]);

  const handleStartCreate = (): void => {
    setIsNaming(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (onStartFromScratch) {
      onStartFromScratch(workflowName.trim());
    }
    setWorkflowName('');
    setIsNaming(false);
  };

  const handleCancel = (): void => {
    setWorkflowName('');
    setIsNaming(false);
  };

  return (
    <div className="welcome-screen">
      <WelcomeBackdrop />

      <div className="welcome-content">
        <div className="welcome-logo">
          <img src={noderLogo} alt="Noder" className="welcome-logo-image" />
        </div>

        <section className="welcome-onboarding" aria-labelledby="welcome-onboarding-title">
          <h1 id="welcome-onboarding-title" className="welcome-title">
            Build creative AI workflows visually
          </h1>
          <p className="welcome-subtitle">
            Chain text, image, video, audio, and utility nodes into repeatable media workflows.
          </p>
          <div className="welcome-quick-start" aria-label="Quick start steps">
            {onboardingSteps.map((item) => (
              <div className="welcome-step" key={item.step}>
                <span className="welcome-step-number">{item.step}</span>
                <span className="welcome-step-copy">
                  <span className="welcome-step-title">{item.title}</span>
                  <span className="welcome-step-description">{item.description}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="welcome-actions">
          {showAssistantPanel && (
            <button className="welcome-button welcome-button-primary" onClick={onBuildWithAI}>
              <FaRobot />
              Build with AI
            </button>
          )}
          <button className="welcome-button welcome-button-secondary" onClick={handleStartCreate}>
            <FaMagic />
            Start from scratch
          </button>
        </div>
        {isNaming && (
          <form className="welcome-name-form" onSubmit={handleSubmit}>
            <input
              ref={nameInputRef}
              type="text"
              className="welcome-name-input"
              placeholder="Name your workflow"
              value={workflowName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setWorkflowName(event.target.value)
              }
            />
            <div className="welcome-name-actions">
              <button
                type="submit"
                className="welcome-button welcome-button-primary welcome-button-compact"
              >
                Create
              </button>
              <button
                type="button"
                className="welcome-button welcome-button-secondary welcome-button-compact"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {onLoadWorkflow && (
          <button className="welcome-link" type="button" onClick={() => onLoadWorkflow()}>
            <FaFolderOpen />
            Load workflow
          </button>
        )}

        {/* View Mode Toggle */}
        <div className="welcome-view-toggle">
          <button
            className={`view-toggle-button ${viewMode === 'templates' ? 'active' : ''}`}
            onClick={() => setViewMode('templates')}
          >
            <FaStar />
            <span>Templates</span>
          </button>
          <button
            className={`view-toggle-button ${viewMode === 'workflows' ? 'active' : ''}`}
            onClick={() => setViewMode('workflows')}
          >
            <FaFileAlt />
            <span>My Workflows</span>
          </button>
        </div>

        {/* Conditionally render based on view mode */}
        {viewMode === 'templates' ? (
          <TemplateGallery templates={templates} onLoadTemplate={onLoadTemplate} />
        ) : (
          <WorkflowsList onLoadWorkflow={onLoadWorkflow} />
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;
