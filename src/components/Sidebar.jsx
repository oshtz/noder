import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FaPen, FaTrash, FaSave, FaCheck, FaPlus, FaCog, FaProjectDiagram, FaImage, FaRocket, FaPalette, FaVideo, FaMusic, FaBalanceScale, FaComment, FaStar, FaSeedling, FaBolt, FaSlidersH, FaHome } from 'react-icons/fa';
import Popover from './Popover';
import { SettingsModal } from './SettingsModal';
import OutputGallery from './OutputGallery';
import { toSafeWorkflowId } from '../utils/workflowId';
import './Sidebar.css';

// Icon mapping for template icons
const templateIconMap = {
  palette: FaPalette,
  video: FaVideo,
  music: FaMusic,
  balance: FaBalanceScale,
  comment: FaComment,
  star: FaStar,
  seedling: FaSeedling,
  bolt: FaBolt,
  rocket: FaRocket
};

const getTemplateIcon = (iconName, size = 40) => {
  const IconComponent = templateIconMap[iconName];
  return IconComponent ? <IconComponent size={size} /> : <FaProjectDiagram size={size} />;
};

const templateCategories = [
  { id: 'beginner', label: 'Beginner', icon: 'seedling' },
  { id: 'intermediate', label: 'Intermediate', icon: 'bolt' },
  { id: 'advanced', label: 'Advanced', icon: 'rocket' }
];

const Sidebar = ({
  onWorkflowLoad,
  activeWorkflow,
  hasUnsavedChanges,
  onSave,
  isOpen,
  onToggle,
  workflowOutputs = [],
  database = null,
  // Settings props
  onThemeChange,
  currentTheme,
  openaiApiKey,
  onOpenAIApiKeyChange,
  openRouterApiKey,
  onOpenRouterApiKeyChange,
  anthropicApiKey,
  onAnthropicApiKeyChange,
  replicateApiKey,
  onReplicateApiKeyChange,
  geminiApiKey,
  onGeminiApiKeyChange,
  ollamaBaseUrl,
  onOllamaBaseUrlChange,
  lmStudioBaseUrl,
  onLmStudioBaseUrlChange,
  defaultSaveLocation,
  onDefaultSaveLocationChange,
  showTemplates = true,
  onShowTemplatesChange,
  showAssistantPanel = true,
  onShowAssistantPanelChange,
  runButtonUnlocked = false,
  onRunButtonUnlockedChange,
  runButtonPosition = null,
  onRunButtonPositionReset,
  onSaveWorkflow,
  onLoadWorkflow,
  onExportWorkflow,
  onClearWorkflow,
  onLoadTemplate,
  workflowTemplates = [],
  onGalleryDragStart,
  onGalleryDragEnd,
  updateState = null,
  updateActions = null,
  // Default model settings
  defaultTextModel,
  onDefaultTextModelChange,
  defaultImageModel,
  onDefaultImageModelChange,
  defaultVideoModel,
  onDefaultVideoModelChange,
  defaultAudioModel,
  onDefaultAudioModelChange,
  defaultUpscalerModel,
  onDefaultUpscalerModelChange,
  // Edge appearance
  edgeType,
  onEdgeTypeChange,
  // Editor toolbar visibility toggle
  showEditorToolbar,
  onShowEditorToolbarChange,
  // Home navigation
  onGoHome
}) => {
  const [workflows, setWorkflows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showPopover, setShowPopover] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showBetaFeatures, setShowBetaFeatures] = useState(false);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState('beginner');
  const addButtonRef = useRef(null);
  const workflowsButtonRef = useRef(null);
  const galleryButtonRef = useRef(null);
  const templatesButtonRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const templateCategoriesRef = useRef(null);
  const templateCategoryButtonRefs = useRef({});
  const [templateIndicatorStyle, setTemplateIndicatorStyle] = useState({
    width: 0,
    transform: 'translateX(0px)',
    opacity: 0
  });
  const [activePopover, setActivePopover] = useState(null);
  const [workflowSortBy, setWorkflowSortBy] = useState('recent'); // 'recent', 'name', 'created'
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const updateTemplateIndicator = useCallback(() => {
    const container = templateCategoriesRef.current;
    const button = templateCategoryButtonRefs.current[selectedTemplateCategory];
    if (!container || !button) return;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const left = buttonRect.left - containerRect.left;
    setTemplateIndicatorStyle({
      width: buttonRect.width,
      transform: `translateX(${left}px)`,
      opacity: 1
    });
  }, [selectedTemplateCategory]);

  useLayoutEffect(() => {
    if (activePopover !== 'templates') return;
    updateTemplateIndicator();
  }, [activePopover, updateTemplateIndicator]);

  useEffect(() => {
    if (activePopover !== 'templates') return undefined;
    const container = templateCategoriesRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(() => updateTemplateIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [activePopover, updateTemplateIndicator]);

  const loadWorkflows = async () => {
    try {
      const workflowsList = await invoke('list_workflows');
      setWorkflows(workflowsList);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  // Sort workflows based on selected criteria
  const sortedWorkflows = useMemo(() => {
    if (!workflows || workflows.length === 0) return [];
    
    const sorted = [...workflows];
    
    switch (workflowSortBy) {
      case 'recent':
        // Sort by last modified/accessed time (most recent first)
        return sorted.sort((a, b) => {
          const timeA = a.lastAccessed || a.modified || a.created || 0;
          const timeB = b.lastAccessed || b.modified || b.created || 0;
          return timeB - timeA;
        });
      case 'name':
        // Sort alphabetically by name
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'created':
        // Sort by creation time (newest first)
        return sorted.sort((a, b) => {
          const timeA = a.created || 0;
          const timeB = b.created || 0;
          return timeB - timeA;
        });
      default:
        return sorted;
    }
  }, [workflows, workflowSortBy]);

  const handleRename = async (workflowId, newName) => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    const nextId = toSafeWorkflowId(trimmedName);
    if (workflows.some(workflow => workflow.id === nextId && workflow.id !== workflowId)) {
      alert('A workflow with this name already exists.');
      return;
    }
    try {
      await invoke('rename_workflow', { id: workflowId, newName: trimmedName });
      setEditingId(null);
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to rename workflow:', error);
    }
  };

  const handleDelete = async (workflowId) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      try {
        // Check if we're deleting the active workflow
        const isActiveWorkflow = activeWorkflow?.id === workflowId;
        
        // Delete the workflow
        await invoke('delete_workflow', { id: workflowId });
        
        // Reload the workflows list
        await loadWorkflows();
        
        // If we deleted the active workflow, select another one if available
        if (isActiveWorkflow) {
          const updatedWorkflows = await invoke('list_workflows');
          if (updatedWorkflows && updatedWorkflows.length > 0) {
            // Load the first available workflow
            await handleLoad(updatedWorkflows[0]);
          }
        }
      } catch (error) {
        console.error('Failed to delete workflow:', error);
      }
    }
  };

  const handleLoad = async (workflow) => {
    try {
      const loadedWorkflowData = await invoke('load_workflow', { id: workflow.id });
      // Ensure the loaded workflow has id, name, and data
      const loadedWorkflow = {
        id: workflow.id,
        name: workflow.name,
        data: loadedWorkflowData.data || loadedWorkflowData
      };
      onWorkflowLoad(loadedWorkflow);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  const handleNewWorkflow = async (name) => {
    try {
      // Determine a unique name if blank or duplicate
      let baseName = name && name.trim() ? name.trim() : "Untitled Workflow";
      let uniqueName = baseName;
      let counter = 2;
      const existingIds = workflows.map(wf => wf.id);
      let uniqueId = toSafeWorkflowId(uniqueName);
      while (existingIds.includes(uniqueId)) {
        uniqueName = `${baseName} ${counter}`;
        uniqueId = toSafeWorkflowId(uniqueName);
        counter++;
      }

      const newWorkflow = {
        name: uniqueName,
        id: uniqueId,
        data: {
          nodes: [],
          edges: []
        }
      };

      // Save the new workflow
      await invoke('save_workflow', { 
        name: newWorkflow.name, 
        data: newWorkflow.data 
      });

      // Reload the workflows list
      await loadWorkflows();

      // Load the newly created workflow
      onWorkflowLoad(newWorkflow);

      // Close the popover and reset state
      setShowPopover(false);
      setCreatingWorkflow(false);
      setNewWorkflowName('');
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  return (
    <>
    <div className="sidebar-container icon-mode">
      <div className="sidebar-icon-bar">
        {/* Home Button */}
        <button
          className="sidebar-icon-button"
          onClick={() => onGoHome && onGoHome()}
          title="Home"
        >
          <FaHome />
        </button>

        {/* Add Workflow Button */}
        <button
          className="sidebar-icon-button primary"
          onClick={() => {
            setShowPopover(true);
            setCreatingWorkflow(true);
          }}
          ref={addButtonRef}
          title="Add Workflow"
        >
          <FaPlus />
        </button>

        {/* Workflows Button */}
        <button
          className={`sidebar-icon-button ${activePopover === 'workflows' ? 'active' : ''}`}
          onClick={() => setActivePopover(activePopover === 'workflows' ? null : 'workflows')}
          ref={workflowsButtonRef}
          title="Workflows"
        >
          <FaProjectDiagram />
        </button>

        {/* Templates Button */}
        {showTemplates && (
          <button
            className={`sidebar-icon-button ${activePopover === 'templates' ? 'active' : ''}`}
            onClick={() => setActivePopover(activePopover === 'templates' ? null : 'templates')}
            ref={templatesButtonRef}
            title="Workflow Templates"
          >
            <FaRocket />
          </button>
        )}

        {/* Output Gallery Button */}
        <button
          className={`sidebar-icon-button ${activePopover === 'gallery' ? 'active' : ''} ${workflowOutputs.length > 0 ? 'has-content' : ''}`}
          onClick={() => setActivePopover(activePopover === 'gallery' ? null : 'gallery')}
          ref={galleryButtonRef}
          title={`Output Gallery (${workflowOutputs.length})`}
        >
          <FaImage />
          {workflowOutputs.length > 0 && (
            <span className="badge">{workflowOutputs.length}</span>
          )}
        </button>

        {/* Controls Toggle Button */}
        <button
          className={`sidebar-icon-button ${showEditorToolbar ? 'active' : ''}`}
          onClick={() => onShowEditorToolbarChange?.(!showEditorToolbar)}
          title={showEditorToolbar ? "Hide Editor Toolbar" : "Show Editor Toolbar"}
        >
          <FaSlidersH />
        </button>

        {/* Spacer to push settings to bottom */}
        <div style={{ flex: 1 }} />

        {/* Settings Button at Bottom */}
        <button
          className={`sidebar-icon-button ${isSettingsModalOpen ? 'active' : ''}`}
          onClick={() => setIsSettingsModalOpen(true)}
          ref={settingsButtonRef}
          title="Settings"
        >
          <FaCog />
        </button>
      </div>

      {/* Workflows Popover */}
      {activePopover === 'workflows' && (
        <Popover
          targetRef={workflowsButtonRef}
          onClose={() => setActivePopover(null)}
          position="right"
        >
          <div className="sidebar-popover-content workflows-popover">
            <div className="popover-header">
              <h3>Workflows</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={workflowSortBy}
                  onChange={(e) => setWorkflowSortBy(e.target.value)}
                  className="workflow-sort-select"
                  title="Sort workflows"
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="created">Created</option>
                </select>
                <button
                  className={`workflow-button ghost${hasUnsavedChanges ? '' : ' is-disabled'}`}
                  onClick={() => {
                    if (!hasUnsavedChanges) return;
                    onSave && onSave();
                  }}
                  title={hasUnsavedChanges ? 'Save Changes' : 'No changes to save'}
                  disabled={!hasUnsavedChanges}
                >
                  <FaSave />
                </button>
              </div>
            </div>
            <div className="popover-body">
              {workflows.length === 0 ? (
                <div className="no-workflows">
                  No workflows saved yet
                </div>
              ) : (
                <div className="workflows-list">
                  {sortedWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className={`workflow-item ${activeWorkflow?.id === workflow.id ? 'active' : ''}`}
                    >
                      {editingId === workflow.id ? (
                        <div className="workflow-edit">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleRename(workflow.id, editingName);
                              }
                            }}
                            onBlur={() => {
                              if (editingName.trim() && editingName !== workflow.name) {
                                setTimeout(() => {
                                  handleRename(workflow.id, editingName);
                                }, 200);
                              } else {
                                setEditingId(null);
                              }
                            }}
                            autoFocus
                          />
                          <button
                            className="workflow-button"
                            onClick={() => handleRename(workflow.id, editingName)}
                          >
                            <FaCheck />
                          </button>
                        </div>
                      ) : (
                        <div className="workflow-content" onClick={() => handleLoad(workflow)}>
                          <span className="workflow-name">{workflow.name}</span>
                          <div
                            className={`workflow-actions${activeWorkflow?.id === workflow.id ? ' always-visible' : ''}`}
                          >
                            <button
                              className="workflow-button workflow-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(workflow.id);
                                setEditingName(workflow.name);
                              }}
                            >
                              <FaPen />
                            </button>
                            <button
                              className="workflow-button workflow-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(workflow.id);
                              }}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Popover>
      )}

      {/* Templates Popover */}
      {showTemplates && activePopover === 'templates' && (
        <Popover
          targetRef={templatesButtonRef}
          onClose={() => setActivePopover(null)}
          position="right"
        >
          <div className="sidebar-popover-content" style={{ width: '600px', maxWidth: '90vw' }}>
            <div className="popover-header">
              <h3>Workflow Templates</h3>
            </div>
            <div className="popover-body">
              {/* Category Buttons */}
              <div className="sidebar-template-categories" ref={templateCategoriesRef}>
                <span
                  className="sidebar-template-category-indicator"
                  aria-hidden="true"
                  style={templateIndicatorStyle}
                />
                {templateCategories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedTemplateCategory(category.id)}
                    className={`sidebar-template-category-button ${selectedTemplateCategory === category.id ? 'active' : ''}`}
                    ref={(node) => {
                      if (node) {
                        templateCategoryButtonRefs.current[category.id] = node;
                      }
                    }}
                  >
                    <span className="sidebar-template-category-icon">
                      {getTemplateIcon(category.icon, 14)}
                    </span>
                    <span className="sidebar-template-category-label">{category.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Templates Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                maxHeight: '500px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {workflowTemplates
                  .filter(t => t.category === selectedTemplateCategory)
                  .map(template => (
                    <div
                      key={template.id}
                      onClick={() => {
                        if (onLoadTemplate) {
                          onLoadTemplate(template);
                          setActivePopover(null);
                        }
                      }}
                      style={{
                        background: 'var(--bg-secondary, #2a2e37)',
                        border: '2px solid var(--border-color, #444)',
                        borderRadius: '8px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'var(--border-color, #444)';
                      }}
                    >
                      <div style={{ marginBottom: '8px' }}>{getTemplateIcon(template.icon)}</div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--text-color, #fff)',
                        marginBottom: '6px'
                      }}>
                        {template.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary, #aaa)',
                        marginBottom: '8px',
                        lineHeight: '1.4'
                      }}>
                        {template.description}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: 'var(--text-secondary, #888)'
                      }}>
                        <span>{template.nodes.length} nodes</span>
                        <span>•</span>
                        <span>{template.edges.length} connections</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Popover>
      )}

      {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onThemeChange={onThemeChange}
          currentTheme={currentTheme}
          updateState={updateState}
          updateActions={updateActions}
        openaiApiKey={openaiApiKey}
        onOpenAIApiKeyChange={onOpenAIApiKeyChange}
        openRouterApiKey={openRouterApiKey}
        onOpenRouterApiKeyChange={onOpenRouterApiKeyChange}
        anthropicApiKey={anthropicApiKey}
        onAnthropicApiKeyChange={onAnthropicApiKeyChange}
        replicateApiKey={replicateApiKey}
        onReplicateApiKeyChange={onReplicateApiKeyChange}
        geminiApiKey={geminiApiKey}
        onGeminiApiKeyChange={onGeminiApiKeyChange}
        ollamaBaseUrl={ollamaBaseUrl}
        onOllamaBaseUrlChange={onOllamaBaseUrlChange}
        lmStudioBaseUrl={lmStudioBaseUrl}
        onLmStudioBaseUrlChange={onLmStudioBaseUrlChange}
          defaultSaveLocation={defaultSaveLocation}
          onDefaultSaveLocationChange={onDefaultSaveLocationChange}
          showTemplates={showTemplates}
          onShowTemplatesChange={onShowTemplatesChange}
          showAssistantPanel={showAssistantPanel}
          onShowAssistantPanelChange={onShowAssistantPanelChange}
          runButtonUnlocked={runButtonUnlocked}
          onRunButtonUnlockedChange={onRunButtonUnlockedChange}
          runButtonPosition={runButtonPosition}
          onRunButtonPositionReset={onRunButtonPositionReset}
          onSaveWorkflow={onSaveWorkflow}
          onLoadWorkflow={onLoadWorkflow}
          onClearWorkflow={onClearWorkflow}
          onExportWorkflow={onExportWorkflow}
          defaultTextModel={defaultTextModel}
          onDefaultTextModelChange={onDefaultTextModelChange}
          defaultImageModel={defaultImageModel}
          onDefaultImageModelChange={onDefaultImageModelChange}
          defaultVideoModel={defaultVideoModel}
          onDefaultVideoModelChange={onDefaultVideoModelChange}
          defaultAudioModel={defaultAudioModel}
          onDefaultAudioModelChange={onDefaultAudioModelChange}
          defaultUpscalerModel={defaultUpscalerModel}
          onDefaultUpscalerModelChange={onDefaultUpscalerModelChange}
          edgeType={edgeType}
          onEdgeTypeChange={onEdgeTypeChange}
        />

      {/* Gallery Popover */}
      {activePopover === 'gallery' && (
        <Popover
          targetRef={galleryButtonRef}
          onClose={() => setActivePopover(null)}
          position="right"
          isDragging={isGalleryDragging}
        >
          <div className="sidebar-popover-content" style={{ width: '1100px', maxWidth: '90vw' }}>
            <OutputGallery
              outputs={workflowOutputs}
              onClose={() => setActivePopover(null)}
              database={database}
              onDraggingChange={setIsGalleryDragging}
              onGalleryDragStart={onGalleryDragStart}
              onGalleryDragEnd={onGalleryDragEnd}
            />
          </div>
        </Popover>
      )}

      {showPopover && (
        <Popover
          targetRef={addButtonRef}
          onClose={() => {
            setShowPopover(false);
            setCreatingWorkflow(false);
            setNewWorkflowName('');
          }}
          position="right"
        >
          <div className="sidebar-popover-content new-workflow-popover">
            {creatingWorkflow ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <input
                  type="text"
                  placeholder="Workflow Name"
                  value={newWorkflowName}
                  onChange={e => setNewWorkflowName(e.target.value)}
                  autoFocus
                  style={{
                    flexGrow: 1,
                    padding: '8px 12px',
                    borderRadius: 4,
                    border: '1.5px solid var(--primary-color, #ff6b6b)',
                    background: 'var(--input-bg, #333)',
                    color: 'var(--text-color, #fff)',
                    fontSize: '1rem',
                    minWidth: 0,
                    outline: 'none',
                    boxShadow: 'none',
                    width: '100%',
                  }}
                />
                <button
                  className="workflow-button primary"
                  style={{ marginLeft: 2 }}
                  onClick={() => handleNewWorkflow(newWorkflowName)}
                  title="Create"
                >
                  <FaCheck />
                </button>
                <button
                  className="workflow-button"
                  onClick={() => {
                    setCreatingWorkflow(false);
                    setNewWorkflowName('');
                    setShowPopover(false);
                  }}
                  title="Cancel"
                >
                  <FaTrash />
                </button>
              </div>
            ) : (
              <button
                className="workflow-button"
                onClick={() => setCreatingWorkflow(true)}
                style={{ width: '100%' }}
              >
                New Workflow
              </button>
            )}
          </div>
        </Popover>
      )}
    </div>
    </>
  );
};

export default Sidebar;
