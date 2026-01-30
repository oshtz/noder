/**
 * WorkflowItem - Individual workflow item in the workflows list.
 */

import React, { KeyboardEvent, MouseEvent } from 'react';
import { FaPen, FaTrash, FaCheck } from 'react-icons/fa';
import type { WorkflowItemProps } from './types';

export const WorkflowItem: React.FC<WorkflowItemProps> = ({
  workflow,
  isActive,
  isEditing,
  editingName,
  onLoad,
  onStartEditing,
  onCancelEditing,
  onRename,
  onDelete,
  onEditingNameChange,
}) => {
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onRename(workflow.id, editingName);
    }
  };

  const handleBlur = () => {
    if (editingName.trim() && editingName !== workflow.name) {
      setTimeout(() => {
        onRename(workflow.id, editingName);
      }, 200);
    } else {
      onCancelEditing();
    }
  };

  const handleEditClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onStartEditing(workflow);
  };

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete(workflow.id);
  };

  if (isEditing) {
    return (
      <div className={`workflow-item ${isActive ? 'active' : ''}`}>
        <div className="workflow-edit">
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onBlur={handleBlur}
            autoFocus
          />
          <button className="workflow-button" onClick={() => onRename(workflow.id, editingName)}>
            <FaCheck />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`workflow-item ${isActive ? 'active' : ''}`}>
      <div className="workflow-content" onClick={() => onLoad(workflow)}>
        <span className="workflow-name">{workflow.name}</span>
        <div className={`workflow-actions${isActive ? ' always-visible' : ''}`}>
          <button className="workflow-button workflow-action-button" onClick={handleEditClick}>
            <FaPen />
          </button>
          <button className="workflow-button workflow-action-button" onClick={handleDeleteClick}>
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowItem;
