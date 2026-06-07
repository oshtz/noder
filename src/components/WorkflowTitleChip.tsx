import React from 'react';
import { FaSave } from 'react-icons/fa';
import './WorkflowUX.css';

interface WorkflowTitleChipProps {
  activeWorkflow: { id: string; name: string } | null;
  hasUnsavedChanges: boolean;
  onSave?: () => void | Promise<void>;
}

const WorkflowTitleChip: React.FC<WorkflowTitleChipProps> = ({
  activeWorkflow,
  hasUnsavedChanges,
  onSave,
}) => {
  const name = activeWorkflow?.name || 'Untitled Workflow';

  return (
    <section className="workflow-title-chip" aria-label="Active workflow">
      <span className="workflow-title-chip-name" title={name}>
        {name}
      </span>
      {hasUnsavedChanges && <span className="workflow-title-chip-status">Unsaved</span>}
      {hasUnsavedChanges && onSave && (
        <button
          type="button"
          className="workflow-title-chip-save"
          onClick={() => void onSave()}
          aria-label="Save workflow"
          title="Save workflow"
        >
          <FaSave aria-hidden="true" />
        </button>
      )}
    </section>
  );
};

export default WorkflowTitleChip;
