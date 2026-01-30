/**
 * TemplatesPopover - Popover for selecting workflow templates.
 */

import React from 'react';
import { FaSeedling, FaBolt, FaRocket, FaProjectDiagram } from 'react-icons/fa';
import { IconType } from 'react-icons';
import Popover from '../Popover';
import { TemplateCard } from './TemplateCard';
import type { TemplatesPopoverProps, TemplateCategory } from './types';

// =============================================================================
// Constants
// =============================================================================

const templateIconMap: Record<string, IconType> = {
  seedling: FaSeedling,
  bolt: FaBolt,
  rocket: FaRocket,
};

const getTemplateIcon = (iconName: string, size: number = 14): React.ReactElement => {
  const IconComponent = templateIconMap[iconName];
  return IconComponent ? <IconComponent size={size} /> : <FaProjectDiagram size={size} />;
};

const templateCategories: TemplateCategory[] = [
  { id: 'beginner', label: 'Beginner', icon: 'seedling' },
  { id: 'intermediate', label: 'Intermediate', icon: 'bolt' },
  { id: 'advanced', label: 'Advanced', icon: 'rocket' },
];

// =============================================================================
// TemplatesPopover Component
// =============================================================================

export const TemplatesPopover: React.FC<TemplatesPopoverProps> = ({
  templates,
  selectedCategory,
  indicatorStyle,
  categoriesRef,
  categoryButtonRefs,
  targetRef,
  onClose,
  onCategoryChange,
  onLoadTemplate,
}) => {
  const filteredTemplates = templates.filter((t) => t.category === selectedCategory);

  return (
    <Popover targetRef={targetRef} onClose={onClose} position="right">
      <div className="sidebar-popover-content" style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="popover-header">
          <h3>Workflow Templates</h3>
        </div>
        <div className="popover-body">
          {/* Category Buttons */}
          <div className="sidebar-template-categories" ref={categoriesRef}>
            <span
              className="sidebar-template-category-indicator"
              aria-hidden="true"
              style={indicatorStyle}
            />
            {templateCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`sidebar-template-category-button ${
                  selectedCategory === category.id ? 'active' : ''
                }`}
                ref={(node) => {
                  if (node) {
                    categoryButtonRefs.current[category.id] = node;
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
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => {
                  onLoadTemplate(template);
                  onClose();
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Popover>
  );
};

export default TemplatesPopover;
