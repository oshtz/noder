import React from 'react';
import { X } from 'react-feather';

const ValidationErrorsPanel = ({ errors = [], onDismiss, onClearAll }) => {
  if (!errors.length) return null;

  return (
    <div className="validation-errors-panel">
      <div className="panel-header">
        <h3>Connection Issues ({errors.length})</h3>
        <div className="panel-actions">
          <button 
            onClick={onClearAll} 
            className="panel-button"
            title="Clear all"
          >
            Clear All
          </button>
          <button 
            onClick={() => onDismiss()} 
            className="panel-button"
            title="Close"
          >
            <X size={16}/>
          </button>
        </div>
      </div>
      
      <div className="error-list">
        {errors.map((error, index) => (
          <div key={`${error.edge?.source || 'unknown'}-${error.edge?.target || 'unknown'}-${index}`} className="error-item">
            <div className="error-header">
              <span className="edge-label">
                {error.edge?.source || 'Unknown'} → {error.edge?.target || 'Unknown'}
              </span>
              <button
                onClick={() => onDismiss(index)}
                className="dismiss-button"
              >
                ×
              </button>
            </div>
            <div className="error-details">
              {error.message || `Failed validations: ${error.errors?.join(', ') || 'Unknown error'}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ValidationErrorsPanel;
