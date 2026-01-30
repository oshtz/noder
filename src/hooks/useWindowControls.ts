import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Hook that sets up window control button handlers for Tauri's custom titlebar.
 * Attaches click handlers to minimize, maximize, and close buttons.
 */
export function useWindowControls(): void {
  useEffect(() => {
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

    return () => {
      minimizeBtn?.removeEventListener('click', minimizeHandler);
      maximizeBtn?.removeEventListener('click', maximizeHandler);
      closeBtn?.removeEventListener('click', closeHandler);
    };
  }, []);
}
