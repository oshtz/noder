import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FaPalette, FaVideo, FaMusic, FaBalanceScale, FaComment, FaStar, FaSeedling, FaBolt, FaRocket, FaMagic, FaFolderOpen, FaRobot, FaFilm, FaFileAlt, FaClock } from 'react-icons/fa';
import { invoke } from '@tauri-apps/api/core';
import './WelcomeScreen.css';
import noderLogo from '../../noderBG.png';
import FaultyTerminal from './FaultyTerminal';

const VIEW_MODE_STORAGE_KEY = 'noder-welcome-view-mode';

// Icon mapping for template and category icons
const iconMap = {
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
  film: FaFilm
};

const getIcon = (iconName, size = 24) => {
  const IconComponent = iconMap[iconName];
  return IconComponent ? <IconComponent size={size} /> : null;
};

const templateCategories = [
  { id: 'beginner', label: 'Beginner', icon: 'seedling' },
  { id: 'intermediate', label: 'Intermediate', icon: 'bolt' },
  { id: 'advanced', label: 'Advanced', icon: 'rocket' }
];

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

const TemplateGallery = React.memo(({ templates, onLoadTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState('beginner');
  const categoriesRef = useRef(null);
  const buttonRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({
    width: 0,
    transform: 'translateX(0px)',
    opacity: 0
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
      opacity: 1
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
    () => templates.filter(t => t.category === selectedCategory),
    [templates, selectedCategory]
  );

  return (
    <div className="welcome-templates">
      <h2 className="templates-title">Start from a Template</h2>

      <div className="templates-categories" ref={categoriesRef}>
        <span
          className="templates-category-indicator"
          aria-hidden="true"
          style={indicatorStyle}
        />
        {templateCategories.map(category => (
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
        {filteredTemplates.map(template => (
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

const WorkflowsList = React.memo(({ onLoadWorkflow }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        setLoading(true);
        const workflowsList = await invoke('list_workflows');
        setWorkflows(Array.isArray(workflowsList) ? workflowsList : []);
      } catch (error) {
        console.error('Failed to load workflows:', error);
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
        {workflows.map(workflow => (
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

const WelcomeScreen = ({
  onBuildWithAI,
  onStartFromScratch,
  onLoadWorkflow,
  onLoadTemplate,
  showAssistantPanel = true,
  templates = []
}) => {
  const [isNaming, setIsNaming] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const nameInputRef = useRef(null);
  
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState(() => {
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
      console.error('Failed to save view mode:', error);
    }
  }, [viewMode]);

  useEffect(() => {
    if (isNaming) {
      nameInputRef.current?.focus();
    }
  }, [isNaming]);

  const handleStartCreate = () => {
    setIsNaming(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onStartFromScratch) {
      onStartFromScratch(workflowName.trim());
    }
    setWorkflowName("");
    setIsNaming(false);
  };

  const handleCancel = () => {
    setWorkflowName("");
    setIsNaming(false);
  };

  return (
    <div className="welcome-screen">
      <WelcomeBackdrop />

      <div className="welcome-content">
        <div className="welcome-logo">
          <img src={noderLogo} alt="Noder" className="welcome-logo-image" />
        </div>

        <div className="welcome-actions">
          {showAssistantPanel && (
            <button
              className="welcome-button welcome-button-primary"
              onClick={onBuildWithAI}
            >
              <FaRobot />
              Build with AI
            </button>
          )}
          <button
            className="welcome-button welcome-button-secondary"
            onClick={handleStartCreate}
          >
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
              onChange={(event) => setWorkflowName(event.target.value)}
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
          <button
            className="welcome-link"
            type="button"
            onClick={onLoadWorkflow}
          >
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
