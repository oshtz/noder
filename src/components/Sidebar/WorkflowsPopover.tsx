/**
 * WorkflowsPopover - Popover for managing workflows.
 */

import React from 'react';
import { FaSave } from 'react-icons/fa';
import Popover from '../Popover';
import { SkeletonWorkflowList } from '../Skeleton';
import { WorkflowItem } from './WorkflowItem';
import type { WorkflowsPopoverProps, WorkflowSortBy } from './types';

export const WorkflowsPopover: React.FC<WorkflowsPopoverProps> = ({
  workflows,
  sortedWorkflows,
  isLoading,
  activeWorkflow,
  hasUnsavedChanges,
  sortBy,
  editingId,
  editingName,
  targetRef,
  onClose,
  onSave,
  onSortByChange,
  onLoad,
  onStartEditing,
  onCancelEditing,
  onRename,
  onDelete,
  onEditingNameChange,
}) => {
  return (
    <Popover targetRef={targetRef} onClose={onClose} position="right">
      <div className="sidebar-popover-content workflows-popover">
        <div className="popover-header">
          <h3>Workflows</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as WorkflowSortBy)}
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
                onSave?.();
              }}
              title={hasUnsavedChanges ? 'Save Changes' : 'No changes to save'}
              disabled={!hasUnsavedChanges}
            >
              <FaSave />
            </button>
          </div>
        </div>
        <div className="popover-body">
          {isLoading ? (
            <SkeletonWorkflowList count={5} />
          ) : workflows.length === 0 ? (
            <div className="no-workflows">No workflows saved yet</div>
          ) : (
            <div className="workflows-list">
              {sortedWorkflows.map((workflow) => (
                <WorkflowItem
                  key={workflow.id}
                  workflow={workflow}
                  isActive={activeWorkflow?.id === workflow.id}
                  isEditing={editingId === workflow.id}
                  editingName={editingName}
                  onLoad={onLoad}
                  onStartEditing={onStartEditing}
                  onCancelEditing={onCancelEditing}
                  onRename={onRename}
                  onDelete={onDelete}
                  onEditingNameChange={onEditingNameChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
};

export default WorkflowsPopover;
