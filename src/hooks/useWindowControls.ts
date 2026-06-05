import { useEffect } from 'react';
import { isTauriRuntime } from '../utils/runtime';
import { logger } from '../utils/logger';

/**
 * Hook that sets up window control button handlers for Tauri's custom titlebar.
 * Attaches click handlers to minimize, maximize, and close buttons.
 */
export function useWindowControls(): void {
  useEffect(() => {
    if (!isTauriRuntime()) return undefined;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const wireControls = async (): Promise<void> => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (disposed) return;

        const appWindow = getCurrentWindow();
        const minimizeBtn = document.getElementById('titlebar-minimize');
        const maximizeBtn = document.getElementById('titlebar-maximize');
        const closeBtn = document.getElementById('titlebar-close');

        const minimizeHandler = () => appWindow.minimize();
        const maximizeHandler = () => appWindow.toggleMaximize();
        const closeHandler = () => appWindow.close();

        minimizeBtn?.addEventListener('click', minimizeHandler);
        maximizeBtn?.addEventListener('click', maximizeHandler);
        closeBtn?.addEventListener('click', closeHandler);

        cleanup = () => {
          minimizeBtn?.removeEventListener('click', minimizeHandler);
          maximizeBtn?.removeEventListener('click', maximizeHandler);
          closeBtn?.removeEventListener('click', closeHandler);
        };
      } catch (error) {
        logger.error('Failed to wire window controls:', error);
      }
    };

    void wireControls();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
}
