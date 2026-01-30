import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
  lazy,
  Suspense,
  RefObject,
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  FaPen,
  FaTrash,
  FaSave,
  FaCheck,
  FaPlus,
  FaCog,
  FaProjectDiagram,
  FaImage,
  FaRocket,
  FaPalette,
  FaVideo,
  FaMusic,
  FaBalanceScale,
  FaComment,
  FaStar,
  FaSeedling,
  FaBolt,
  FaSlidersH,
  FaHome,
} from 'react-icons/fa';
import { IconType } from 'react-icons';
import Popover from './Popover';
import { SkeletonWorkflowList } from './Skeleton';
import type { UpdateState, UpdateActions } from './SettingsModal';
import { toSafeWorkflowId } from '../utils/workflowId';
import { useSettingsStore } from '../stores/useSettingsStore';
import './Sidebar.css';

// Lazy-loaded components for code splitting
const SettingsModal = lazy(() => import('./SettingsModal'));
const OutputGallery = lazy(() =>
  import('./OutputGallery').then((m) => ({ default: m.OutputGallery }))
);

// =============================================================================
// Types
// =============================================================================

interface Workflow {
  id: string;
  name: string;
  created?: number;
  modified?: number;
  lastAccessed?: number;
  data?: {
    nodes: unknown[];
    edges: unknown[];
  };
}

interface WorkflowOutput {
  id?: string;
  type?: string;
  value?: unknown;
  nodeId?: string;
  timestamp?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  nodes: unknown[];
  edges: unknown[];
}

interface TemplateCategory {
  id: string;
  label: string;
  icon: string;
}

type PopoverType = 'workflows' | 'templates' | 'gallery' | null;
type WorkflowSortBy = 'recent' | 'name' | 'created';

interface TemplateIndicatorStyle {
  width: number;
  transform: string;
  opacity: number;
}

interface SidebarProps {
  onWorkflowLoad: (workflow: Workflow) => void;
  activeWorkflow: Workflow | null;
  hasUnsavedChanges: boolean;
  onSave?: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
  workflowOutputs?: WorkflowOutput[];
  database?: unknown;
  // Workflow actions (still needed for workflow tab in settings)
  onSaveWorkflow?: () => void;
  onLoadWorkflow?: (e: ChangeEvent<HTMLInputElement>) => void;
  onExportWorkflow?: () => void;
  onClearWorkflow?: () => void;
  onLoadTemplate?: (template: Template) => void;
  workflowTemplates?: Template[];
  onGalleryDragStart?: () => void;
  onGalleryDragEnd?: () => void;
  // Update system (still managed by hook in App)
  updateState?: UpdateState | null;
  updateActions?: UpdateActions | null;
  // Editor toolbar visibility toggle (read from store via useSettingsStore)
  showEditorToolbar?: boolean;
  onShowEditorToolbarChange?: (show: boolean) => void;
  // Home navigation
  onGoHome?: () => void;
}

// =============================================================================
// Icon Mapping
// =============================================================================

const templateIconMap: Record<string, IconType> = {
  palette: FaPalette,
  video: FaVideo,
  music: FaMusic,
  balance: FaBalanceScale,
  comment: FaComment,
  star: FaStar,
  seedling: FaSeedling,
  bolt: FaBolt,
  rocket: FaRocket,
};

const getTemplateIcon = (iconName: string, size: number = 40): JSX.Element => {
  const IconComponent = templateIconMap[iconName];
  return IconComponent ? <IconComponent size={size} /> : <FaProjectDiagram size={size} />;
};

const templateCategories: TemplateCategory[] = [
  { id: 'beginner', label: 'Beginner', icon: 'seedling' },
  { id: 'intermediate', label: 'Intermediate', icon: 'bolt' },
  { id: 'advanced', label: 'Advanced', icon: 'rocket' },
];

// =============================================================================
// Sidebar Component
// =============================================================================

const Sidebar: React.FC<SidebarProps> = ({
  onWorkflowLoad,
  activeWorkflow,
  hasUnsavedChanges,
  onSave,
  workflowOutputs = [],
  database = null,
  // Workflow actions (still needed for workflow tab in settings)
  onSaveWorkflow,
  onLoadWorkflow,
  onExportWorkflow,
  onClearWorkflow,
  onLoadTemplate,
  workflowTemplates = [],
  onGalleryDragStart,
  onGalleryDragEnd,
  // Update system (still managed by hook in App)
  updateState = null,
  updateActions = null,
  // Editor toolbar visibility toggle
  showEditorToolbar,
  onShowEditorToolbarChange,
  // Home navigation
  onGoHome,
}) => {
  // Read settings from Zustand store
  const showTemplates = useSettingsStore((s) => s.showTemplates);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showPopover, setShowPopover] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState('beginner');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const workflowsButtonRef = useRef<HTMLButtonElement>(null);
  const galleryButtonRef = useRef<HTMLButtonElement>(null);
  const templatesButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const templateCategoriesRef = useRef<HTMLDivElement>(null);
  const templateCategoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [templateIndicatorStyle, setTemplateIndicatorStyle] = useState<TemplateIndicatorStyle>({
    width: 0,
    transform: 'translateX(0px)',
    opacity: 0,
  });
  const [activePopover, setActivePopover] = useState<PopoverType>(null);
  const [workflowSortBy, setWorkflowSortBy] = useState<WorkflowSortBy>('recent');
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
      opacity: 1,
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

  const loadWorkflows = async (): Promise<void> => {
    setIsLoadingWorkflows(true);
    try {
      const workflowsList = (await invoke('list_workflows')) as Workflow[];
      setWorkflows(workflowsList);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setIsLoadingWorkflows(false);
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

  const handleRename = async (workflowId: string, newName: string): Promise<void> => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    const nextId = toSafeWorkflowId(trimmedName);
    if (workflows.some((workflow) => workflow.id === nextId && workflow.id !== workflowId)) {
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

  const handleDelete = async (workflowId: string): Promise<void> => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      // 1. Save previous state for rollback
      const previousWorkflows = [...workflows];
      const isActiveWorkflow = activeWorkflow?.id === workflowId;

      // 2. Optimistically remove from UI immediately
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));

      try {
        // 3. Call Tauri backend
        await invoke('delete_workflow', { id: workflowId });

        // 4. If we deleted the active workflow, select another one if available
        if (isActiveWorkflow) {
          const remainingWorkflows = previousWorkflows.filter((w) => w.id !== workflowId);
          if (remainingWorkflows.length > 0) {
            await handleLoad(remainingWorkflows[0]);
          }
        }
      } catch (error) {
        // 5. Rollback on error
        console.error('Failed to delete workflow:', error);
        setWorkflows(previousWorkflows);
      }
    }
  };

  const handleLoad = async (workflow: Workflow): Promise<void> => {
    try {
      const loadedWorkflowData = (await invoke('load_workflow', { id: workflow.id })) as {
        data?: unknown;
      };
      // Ensure the loaded workflow has id, name, and data
      const loadedWorkflow: Workflow = {
        id: workflow.id,
        name: workflow.name,
        data: (loadedWorkflowData.data || loadedWorkflowData) as Workflow['data'],
      };
      onWorkflowLoad(loadedWorkflow);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  const handleNewWorkflow = async (name: string): Promise<void> => {
    // 1. Determine a unique name if blank or duplicate
    const baseName = name && name.trim() ? name.trim() : 'Untitled Workflow';
    let uniqueName = baseName;
    let counter = 2;
    const existingIds = workflows.map((wf) => wf.id);
    let uniqueId = toSafeWorkflowId(uniqueName);
    while (existingIds.includes(uniqueId)) {
      uniqueName = `${baseName} ${counter}`;
      uniqueId = toSafeWorkflowId(uniqueName);
      counter++;
    }

    const newWorkflow: Workflow = {
      name: uniqueName,
      id: uniqueId,
      created: Date.now(),
      modified: Date.now(),
      data: {
        nodes: [],
        edges: [],
      },
    };

    // 2. Save previous state for rollback
    const previousWorkflows = [...workflows];

    // 3. Optimistically add to UI immediately
    setWorkflows((prev) => [newWorkflow, ...prev]);

    // 4. Close the popover and reset state immediately for snappy UI
    setShowPopover(false);
    setCreatingWorkflow(false);
    setNewWorkflowName('');

    // 5. Load the newly created workflow immediately
    onWorkflowLoad(newWorkflow);

    try {
      // 6. Save to backend
      await invoke('save_workflow', {
        name: newWorkflow.name,
        data: newWorkflow.data,
      });
    } catch (error) {
      // 7. Rollback on error
      console.error('Failed to create workflow:', error);
      setWorkflows(previousWorkflows);
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
            aria-label="Go to home screen"
          >
            <FaHome aria-hidden="true" />
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
            aria-label="Create new workflow"
          >
            <FaPlus aria-hidden="true" />
          </button>

          {/* Workflows Button */}
          <button
            className={`sidebar-icon-button ${activePopover === 'workflows' ? 'active' : ''}`}
            onClick={() => setActivePopover(activePopover === 'workflows' ? null : 'workflows')}
            ref={workflowsButtonRef}
            title="Workflows"
            aria-label="Open saved workflows"
            aria-expanded={activePopover === 'workflows'}
          >
            <FaProjectDiagram aria-hidden="true" />
          </button>

          {/* Templates Button */}
          {showTemplates && (
            <button
              className={`sidebar-icon-button ${activePopover === 'templates' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'templates' ? null : 'templates')}
              ref={templatesButtonRef}
              title="Workflow Templates"
              aria-label="Open workflow templates"
              aria-expanded={activePopover === 'templates'}
            >
              <FaRocket aria-hidden="true" />
            </button>
          )}

          {/* Output Gallery Button */}
          <button
            className={`sidebar-icon-button ${activePopover === 'gallery' ? 'active' : ''} ${workflowOutputs.length > 0 ? 'has-content' : ''}`}
            onClick={() => setActivePopover(activePopover === 'gallery' ? null : 'gallery')}
            ref={galleryButtonRef}
            title={`Output Gallery (${workflowOutputs.length})`}
            aria-label={`Open output gallery with ${workflowOutputs.length} items`}
            aria-expanded={activePopover === 'gallery'}
          >
            <FaImage aria-hidden="true" />
            {workflowOutputs.length > 0 && (
              <span className="badge" aria-hidden="true">
                {workflowOutputs.length}
              </span>
            )}
          </button>

          {/* Controls Toggle Button */}
          <button
            className={`sidebar-icon-button ${showEditorToolbar ? 'active' : ''}`}
            onClick={() => onShowEditorToolbarChange?.(!showEditorToolbar)}
            title={showEditorToolbar ? 'Hide Editor Toolbar' : 'Show Editor Toolbar'}
            aria-label={showEditorToolbar ? 'Hide editor toolbar' : 'Show editor toolbar'}
            aria-pressed={showEditorToolbar}
          >
            <FaSlidersH aria-hidden="true" />
          </button>

          {/* Spacer to push settings to bottom */}
          <div style={{ flex: 1 }} aria-hidden="true" />

          {/* Settings Button at Bottom */}
          <button
            className={`sidebar-icon-button ${isSettingsModalOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsModalOpen(true)}
            ref={settingsButtonRef}
            title="Settings"
            aria-label="Open settings"
          >
            <FaCog aria-hidden="true" />
          </button>
        </div>

        {/* Workflows Popover */}
        {activePopover === 'workflows' && (
          <Popover
            targetRef={workflowsButtonRef as RefObject<HTMLElement>}
            onClose={() => setActivePopover(null)}
            position="right"
          >
            <div className="sidebar-popover-content workflows-popover">
              <div className="popover-header">
                <h3>Workflows</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={workflowSortBy}
                    onChange={(e) => setWorkflowSortBy(e.target.value as WorkflowSortBy)}
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
                {isLoadingWorkflows ? (
                  <SkeletonWorkflowList count={5} />
                ) : workflows.length === 0 ? (
                  <div className="no-workflows">No workflows saved yet</div>
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
                              onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
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
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.stopPropagation();
                                  setEditingId(workflow.id);
                                  setEditingName(workflow.name);
                                }}
                              >
                                <FaPen />
                              </button>
                              <button
                                className="workflow-button workflow-action-button"
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
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
            targetRef={templatesButtonRef as RefObject<HTMLElement>}
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
                  {templateCategories.map((category) => (
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '12px',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    padding: '4px',
                  }}
                >
                  {workflowTemplates
                    .filter((t) => t.category === selectedTemplateCategory)
                    .map((template) => (
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
                          textAlign: 'center',
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
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-color, #fff)',
                            marginBottom: '6px',
                          }}
                        >
                          {template.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary, #aaa)',
                            marginBottom: '8px',
                            lineHeight: '1.4',
                          }}
                        >
                          {template.description}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: 'var(--text-secondary, #888)',
                          }}
                        >
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

        {/* Settings Modal - now reads settings directly from Zustand store */}
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            updateState={updateState || undefined}
            updateActions={updateActions || undefined}
            workflowActions={{
              onSaveWorkflow,
              onLoadWorkflow,
              onClearWorkflow,
              onExportWorkflow,
            }}
          />
        </Suspense>

        {/* Gallery Popover */}
        {activePopover === 'gallery' && (
          <Popover
            targetRef={galleryButtonRef as RefObject<HTMLElement>}
            onClose={() => setActivePopover(null)}
            position="right"
            isDragging={isGalleryDragging}
          >
            <div className="sidebar-popover-content" style={{ width: '1100px', maxWidth: '90vw' }}>
              <Suspense fallback={<div className="loading-placeholder">Loading gallery...</div>}>
                <OutputGallery
                  outputs={workflowOutputs}
                  onClose={() => setActivePopover(null)}
                  database={database}
                  onDraggingChange={setIsGalleryDragging}
                  onGalleryDragStart={onGalleryDragStart}
                  onGalleryDragEnd={onGalleryDragEnd}
                />
              </Suspense>
            </div>
          </Popover>
        )}

        {showPopover && (
          <Popover
            targetRef={addButtonRef as RefObject<HTMLElement>}
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
                    onChange={(e) => setNewWorkflowName(e.target.value)}
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
