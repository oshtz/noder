import { useEffect, useRef } from 'react';

export interface AutoUpdateConfig {
  updateSupported: boolean;
  checkForUpdate: () => Promise<unknown>;
  downloadUpdate: (info: unknown) => Promise<string | null>;
  installUpdate: () => Promise<void>;
}

/**
 * Hook that automatically checks for updates, downloads them, and prompts the user to install.
 * Only runs once on mount when updates are supported.
 */
export function useAutoUpdate({
  updateSupported,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
}: AutoUpdateConfig): void {
  const autoUpdateCheckRef = useRef<boolean>(false);
  const autoUpdatePromptRef = useRef<boolean>(false);

  useEffect(() => {
    if (!updateSupported || autoUpdateCheckRef.current) return;
    autoUpdateCheckRef.current = true;

    let cancelled = false;

    const runAutoUpdate = async (): Promise<void> => {
      const info = await checkForUpdate();
      if (cancelled || !info) return;

      const path = await downloadUpdate(info);
      if (cancelled || !path || autoUpdatePromptRef.current) return;

      autoUpdatePromptRef.current = true;
      const version = (info as { version?: string })?.version || 'new version';
      const shouldInstall = window.confirm(`Update ${version} is ready. Restart to apply it now?`);
      if (shouldInstall) await installUpdate();
    };

    runAutoUpdate();

    return () => {
      cancelled = true;
    };
  }, [checkForUpdate, downloadUpdate, installUpdate, updateSupported]);
}
