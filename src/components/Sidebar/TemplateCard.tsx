/**
 * TemplateCard - Individual template card in the templates grid.
 */

import React from 'react';
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
  FaProjectDiagram,
} from 'react-icons/fa';
import { IconType } from 'react-icons';
import type { TemplateCardProps } from './types';

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

const getTemplateIcon = (iconName: string, size: number = 40): React.ReactElement => {
  const IconComponent = templateIconMap[iconName];
  return IconComponent ? <IconComponent size={size} /> : <FaProjectDiagram size={size} />;
};

// =============================================================================
// TemplateCard Component
// =============================================================================

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onClick }) => {
  return (
    <div
      onClick={onClick}
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
        <span>*</span>
        <span>{template.edges.length} connections</span>
      </div>
    </div>
  );
};

export default TemplateCard;
