/**
 * AppearanceTab - Theme and edge style settings.
 */

import React from 'react';
import { themes } from '../../../constants/themes';
import type { EdgeType } from '../../../stores/useSettingsStore';
import type { AppearanceTabProps } from '../types';

// =============================================================================
// Constants
// =============================================================================

const LIGHT_THEMES = [
  'github',
  'cream',
  'solarized-light',
  'paper',
  'snow',
  'sand',
  'rose-pine-dawn',
  'latte',
  'peach',
  'sage',
  'lilac',
  'seafoam',
  'apricot',
  'clay',
  'blossom',
  'honey',
  'mist',
  'matcha',
];

const EDGE_TYPES = [
  { id: 'bezier', label: 'Bezier', description: 'Smooth curved lines' },
  { id: 'smoothstep', label: 'Smooth Step', description: 'Rounded right-angle edges' },
  { id: 'step', label: 'Step', description: 'Sharp right-angle edges' },
  { id: 'straight', label: 'Straight', description: 'Direct straight lines' },
] as const;

// =============================================================================
// Helper Components
// =============================================================================

interface ThemeCardProps {
  themeName: string;
  isActive: boolean;
  onClick: () => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ themeName, isActive, onClick }) => {
  const theme = themes[themeName as keyof typeof themes];
  if (!theme) return null;

  return (
    <button
      className={`theme-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={
        {
          '--theme-bg': theme['--bg-color'],
          '--theme-primary': theme['--primary-color'],
          '--theme-secondary': theme['--bg-secondary'],
          '--theme-text': theme['--text-color'],
        } as React.CSSProperties
      }
    >
      <div className="theme-preview">
        <div className="theme-preview-header" />
        <div className="theme-preview-body">
          <div className="theme-preview-node" />
          <div className="theme-preview-node" />
        </div>
      </div>
      <span className="theme-name">{themeName}</span>
    </button>
  );
};

interface EdgeTypeCardProps {
  type: (typeof EDGE_TYPES)[number];
  isActive: boolean;
  onClick: () => void;
}

const EdgeTypeCard: React.FC<EdgeTypeCardProps> = ({ type, isActive, onClick }) => (
  <button className={`edge-type-card ${isActive ? 'active' : ''}`} onClick={onClick}>
    <div className="edge-type-preview">
      <svg viewBox="0 0 80 40" className="edge-preview-svg">
        {type.id === 'bezier' && (
          <path d="M 10 35 C 30 35, 50 5, 70 5" fill="none" stroke="currentColor" strokeWidth="2" />
        )}
        {type.id === 'smoothstep' && (
          <path
            d="M 10 35 L 10 20 Q 10 12, 18 12 L 62 12 Q 70 12, 70 5 L 70 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        )}
        {type.id === 'step' && (
          <path
            d="M 10 35 L 10 20 L 70 20 L 70 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        )}
        {type.id === 'straight' && (
          <path d="M 10 35 L 70 5" fill="none" stroke="currentColor" strokeWidth="2" />
        )}
        <circle cx="10" cy="35" r="4" fill="currentColor" />
        <circle cx="70" cy="5" r="4" fill="currentColor" />
      </svg>
    </div>
    <span className="edge-type-label">{type.label}</span>
    <span className="edge-type-description">{type.description}</span>
  </button>
);

// =============================================================================
// AppearanceTab Component
// =============================================================================

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  currentTheme,
  edgeType,
  onCurrentThemeChange,
  onEdgeTypeChange,
}) => {
  const themeNames = Object.keys(themes);
  const darkThemes = themeNames.filter((t) => !LIGHT_THEMES.includes(t));
  const lightThemes = themeNames.filter((t) => LIGHT_THEMES.includes(t));

  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">Theme</h3>
        <p className="settings-group-description">Choose a color theme for the interface</p>

        <div className="theme-section">
          <h4 className="theme-category-title">Dark Themes</h4>
          <div className="theme-grid">
            {darkThemes.map((themeName) => (
              <ThemeCard
                key={themeName}
                themeName={themeName}
                isActive={currentTheme === themeName}
                onClick={() => onCurrentThemeChange(themeName)}
              />
            ))}
          </div>
        </div>

        <div className="theme-section">
          <h4 className="theme-category-title">Light Themes</h4>
          <div className="theme-grid">
            {lightThemes.map((themeName) => (
              <ThemeCard
                key={themeName}
                themeName={themeName}
                isActive={currentTheme === themeName}
                onClick={() => onCurrentThemeChange(themeName)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Edge Style</h3>
        <p className="settings-group-description">Choose how connections between nodes are drawn</p>
        <div className="edge-type-grid">
          {EDGE_TYPES.map((type) => (
            <EdgeTypeCard
              key={type.id}
              type={type}
              isActive={edgeType === type.id}
              onClick={() => onEdgeTypeChange(type.id as EdgeType)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppearanceTab;
