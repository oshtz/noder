import { useEffect, useMemo } from 'react';
import { themes } from '../constants/themes';
import { LIGHT_THEMES } from '../constants/app';
import { useSettingsStore } from '../stores/useSettingsStore';

/**
 * Hook that manages theme application.
 * - Reads currentTheme from settings store
 * - Applies theme CSS variables to document root
 * - Adds/removes light-theme class for light themes
 *
 * Note: Theme persistence to localStorage is handled by useSettingsStore.setCurrentTheme
 */
export function useThemeEffect(): { isLightTheme: boolean } {
  // Get current theme from settings store
  const currentTheme = useSettingsStore((s) => s.currentTheme);

  // Apply theme CSS variables
  useEffect(() => {
    const theme = themes[currentTheme] || themes['dark'] || Object.values(themes)[0];
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value as string);
      });
    }
  }, [currentTheme]);

  // Check if current theme is a light theme
  const isLightTheme = useMemo(() => LIGHT_THEMES.includes(currentTheme), [currentTheme]);

  // Add/remove light-theme class
  useEffect(() => {
    if (isLightTheme) {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [isLightTheme]);

  return { isLightTheme };
}
