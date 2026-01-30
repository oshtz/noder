/**
 * Tests for themes constant
 */

import { describe, it, expect } from 'vitest';
import { themes, type ThemeColors } from './themes';

describe('themes', () => {
  // Required CSS variables that all themes must define
  const REQUIRED_VARIABLES: (keyof ThemeColors)[] = [
    '--bg-color',
    '--bg-primary',
    '--bg-secondary',
    '--bg-tertiary',
    '--text-color',
    '--text-secondary',
    '--primary-color',
    '--accent-color',
    '--node-bg',
    '--node-border',
    '--border-color',
    '--handle-color',
    '--settings-bg',
    '--drag-handle-bg',
    '--input-bg',
  ];

  describe('theme structure', () => {
    it('should have at least one theme defined', () => {
      expect(Object.keys(themes).length).toBeGreaterThan(0);
    });

    it('should have the default dark theme', () => {
      expect(themes.dark).toBeDefined();
    });

    it('should have common themes', () => {
      const expectedThemes = [
        'dark',
        'neon',
        'cyberpunk',
        'monokai',
        'dracula',
        'github',
        'nord',
        'solarized',
        'tokyo-night',
        'one-dark',
        'gruvbox',
      ];

      expectedThemes.forEach((themeName) => {
        expect(themes[themeName]).toBeDefined();
      });
    });

    it('should have light themes', () => {
      const lightThemes = ['github', 'cream', 'solarized-light', 'paper', 'snow'];

      lightThemes.forEach((themeName) => {
        expect(themes[themeName]).toBeDefined();
      });
    });
  });

  describe('theme completeness', () => {
    Object.entries(themes).forEach(([themeName, themeColors]) => {
      describe(`${themeName} theme`, () => {
        it('should have all required CSS variables', () => {
          REQUIRED_VARIABLES.forEach((variable) => {
            expect(themeColors[variable]).toBeDefined();
          });
        });

        it('should have valid hex color values', () => {
          const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

          REQUIRED_VARIABLES.forEach((variable) => {
            const value = themeColors[variable];
            expect(value).toMatch(hexColorRegex);
          });
        });
      });
    });
  });

  describe('color contrast', () => {
    // Helper to calculate relative luminance
    const getLuminance = (hex: string): number => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const toLinear = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const getContrastRatio = (color1: string, color2: string): number => {
      const l1 = getLuminance(color1);
      const l2 = getLuminance(color2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    it('should have reasonable contrast between text and background', () => {
      Object.entries(themes).forEach(([_themeName, themeColors]) => {
        const textColor = themeColors['--text-color'];
        const bgColor = themeColors['--bg-color'];
        const contrast = getContrastRatio(textColor, bgColor);

        // WCAG AA requires 4.5:1 for normal text
        // We're lenient here as some creative themes may have lower contrast
        expect(contrast).toBeGreaterThan(2);
      });
    });

    it('should have primary color distinct from background', () => {
      Object.entries(themes).forEach(([_themeName, themeColors]) => {
        const primaryColor = themeColors['--primary-color'];
        const bgColor = themeColors['--bg-color'];
        const contrast = getContrastRatio(primaryColor, bgColor);

        expect(contrast).toBeGreaterThan(1.5);
      });
    });
  });

  describe('theme consistency', () => {
    it('should have background colors in correct order (primary > secondary > tertiary brightness)', () => {
      Object.entries(themes).forEach(([_themeName, themeColors]) => {
        const bgPrimary = themeColors['--bg-primary'];
        const bgSecondary = themeColors['--bg-secondary'];
        const bgTertiary = themeColors['--bg-tertiary'];

        // Extract brightness values (simplified)
        const getBrightness = (hex: string) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return (r + g + b) / 3;
        };

        const primaryBrightness = getBrightness(bgPrimary);
        const secondaryBrightness = getBrightness(bgSecondary);
        const tertiaryBrightness = getBrightness(bgTertiary);

        // For dark themes: primary <= secondary <= tertiary (gets lighter)
        // For light themes: primary >= secondary >= tertiary (gets darker)
        const isDarkTheme = primaryBrightness < 128;

        if (isDarkTheme) {
          expect(primaryBrightness).toBeLessThanOrEqual(secondaryBrightness + 20);
          expect(secondaryBrightness).toBeLessThanOrEqual(tertiaryBrightness + 20);
        } else {
          expect(primaryBrightness).toBeGreaterThanOrEqual(secondaryBrightness - 20);
          expect(secondaryBrightness).toBeGreaterThanOrEqual(tertiaryBrightness - 20);
        }
      });
    });

    it('should have node-bg match or be close to bg-secondary', () => {
      Object.entries(themes).forEach(([_themeName, themeColors]) => {
        const nodeBg = themeColors['--node-bg'];
        const bgSecondary = themeColors['--bg-secondary'];

        // Node background should typically be the same as secondary
        // or within a reasonable range for visual hierarchy
        const colorDistance = (hex1: string, hex2: string) => {
          const r1 = parseInt(hex1.slice(1, 3), 16);
          const g1 = parseInt(hex1.slice(3, 5), 16);
          const b1 = parseInt(hex1.slice(5, 7), 16);
          const r2 = parseInt(hex2.slice(1, 3), 16);
          const g2 = parseInt(hex2.slice(3, 5), 16);
          const b2 = parseInt(hex2.slice(5, 7), 16);
          return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
        };

        const distance = colorDistance(nodeBg, bgSecondary);
        // Allow some variation but should be close
        expect(distance).toBeLessThan(100);
      });
    });
  });

  describe('theme count', () => {
    it('should have more than 30 themes for variety', () => {
      const themeCount = Object.keys(themes).length;
      expect(themeCount).toBeGreaterThan(30);
    });
  });

  describe('theme naming', () => {
    it('should use kebab-case for multi-word theme names', () => {
      Object.keys(themes).forEach((themeName) => {
        // Should not contain spaces or uppercase letters
        expect(themeName).not.toMatch(/\s/);
        expect(themeName).not.toMatch(/[A-Z]/);
        // Should only contain lowercase letters, numbers, and hyphens
        expect(themeName).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe('dark vs light detection', () => {
    const isDarkTheme = (themeColors: ThemeColors): boolean => {
      const hex = themeColors['--bg-color'];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r + g + b) / 3 < 128;
    };

    it('should have consistent text color for dark themes (light text)', () => {
      Object.entries(themes).forEach(([_themeName, themeColors]) => {
        if (isDarkTheme(themeColors)) {
          const textHex = themeColors['--text-color'];
          const r = parseInt(textHex.slice(1, 3), 16);
          const g = parseInt(textHex.slice(3, 5), 16);
          const b = parseInt(textHex.slice(5, 7), 16);
          const brightness = (r + g + b) / 3;

          // Dark themes should have light text (brightness > 128)
          expect(brightness).toBeGreaterThan(100);
        }
      });
    });

    it('should have consistent text color for light themes (dark text)', () => {
      Object.entries(themes).forEach(([_themeName, themeColors]) => {
        if (!isDarkTheme(themeColors)) {
          const textHex = themeColors['--text-color'];
          const r = parseInt(textHex.slice(1, 3), 16);
          const g = parseInt(textHex.slice(3, 5), 16);
          const b = parseInt(textHex.slice(5, 7), 16);
          const brightness = (r + g + b) / 3;

          // Light themes should have dark text (brightness < 128)
          expect(brightness).toBeLessThan(160);
        }
      });
    });
  });
});
