import { useState, useCallback, useMemo, useEffect } from 'react';
import { invoke, type GitHubRelease as TauriGitHubRelease } from '../types/tauri';

// ============================================================================
// Types
// ============================================================================

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error';

export type Platform = 'darwin' | 'windows' | 'unknown';

export interface UpdateInfo {
  version: string;
  notes: string | null;
  publishedAt: string | null;
  downloadUrl: string;
}

export interface AssetConfig {
  name: string;
  extension: string;
  baseName: string;
}

export interface GitHubAsset {
  name?: string;
  browser_download_url?: string;
}

export interface GitHubRelease {
  tag_name?: string;
  body?: string;
  published_at?: string;
  assets?: GitHubAsset[];
}

export interface UseUpdateSystemReturn {
  // State
  currentVersion: string | null;
  updateStatus: UpdateStatus;
  updateInfo: UpdateInfo | null;
  updatePath: string | null;
  updateError: string | null;
  lastUpdateCheck: number | null;
  updateSupported: boolean;

  // Actions
  checkForUpdate: () => Promise<UpdateInfo | null>;
  downloadUpdate: (infoOverride?: UpdateInfo) => Promise<string | null>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  loadCurrentVersion: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const UPDATE_REPO = 'oshtz/noder';
const UPDATE_DIR_NAME = 'noder-updates';
const WINDOWS_UPDATE_ASSET = 'noder-portable.exe';
const MAC_UPDATE_ASSET = 'noder.app.zip';
const UPDATE_APP_NAME = 'noder';

// ============================================================================
// Helper Functions
// ============================================================================

const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' &&
  !!(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

const isUpdateSupported = (): boolean =>
  isTauriRuntime() && !(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

const getCurrentVersion = async (): Promise<string | null> => {
  if (!isTauriRuntime()) return null;
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
};

const normalizeVersion = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim().replace(/^v/i, '');
  return trimmed.split('-')[0] || '';
};

const parseVersionParts = (value: string): number[] =>
  normalizeVersion(value)
    .split('.')
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });

const compareVersions = (a: string, b: string): number => {
  const aParts = parseVersionParts(a);
  const bParts = parseVersionParts(b);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const aValue = aParts[i] ?? 0;
    const bValue = bParts[i] ?? 0;
    if (aValue > bValue) return 1;
    if (aValue < bValue) return -1;
  }
  return 0;
};

const getPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('win')) return 'windows';
  return 'unknown';
};

const getUpdateAssetConfig = (): AssetConfig => {
  const os = getPlatform();
  if (os === 'darwin') {
    return {
      name: MAC_UPDATE_ASSET,
      extension: '.app.zip',
      baseName: UPDATE_APP_NAME,
    };
  }
  if (os === 'windows') {
    return {
      name: WINDOWS_UPDATE_ASSET,
      extension: '.exe',
      baseName: UPDATE_APP_NAME,
    };
  }

  throw new Error('Auto-update is not supported on this platform.');
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing application updates
 * Handles checking for updates, downloading, and installing
 */
export function useUpdateSystem(): UseUpdateSystemReturn {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updatePath, setUpdatePath] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<number | null>(null);

  const updateSupported = useMemo(() => isUpdateSupported(), []);

  const loadCurrentVersion = useCallback(async (): Promise<void> => {
    if (!updateSupported) return;
    try {
      const version = await getCurrentVersion();
      if (version) {
        setCurrentVersion(version);
      }
    } catch (error) {
      console.error('Failed to load app version:', error);
    }
  }, [updateSupported]);

  // Load version on mount
  useEffect(() => {
    loadCurrentVersion();
  }, [loadCurrentVersion]);

  const checkForUpdate = useCallback(async (): Promise<UpdateInfo | null> => {
    if (!updateSupported) return null;
    setUpdateStatus('checking');
    setUpdateError(null);

    try {
      let version = currentVersion;
      if (!version) {
        version = await getCurrentVersion();
        if (version) setCurrentVersion(version);
      }
      if (!version) {
        throw new Error('Current version not available.');
      }

      const release = (await invoke('fetch_github_release', {
        repo: UPDATE_REPO,
      })) as TauriGitHubRelease;
      const latestVersion = normalizeVersion(release?.tag_name || '');
      setLastUpdateCheck(Date.now());

      if (!latestVersion || compareVersions(latestVersion, version) <= 0) {
        setUpdateInfo(null);
        setUpdatePath(null);
        setUpdateStatus('up-to-date');
        return null;
      }

      const assetConfig = getUpdateAssetConfig();
      const assets = Array.isArray(release?.assets) ? release.assets : [];
      const asset =
        assets.find((entry) => entry?.name === assetConfig.name) ??
        assets.find((entry) =>
          entry?.browser_download_url?.toLowerCase().endsWith(assetConfig.extension)
        );

      if (!asset?.browser_download_url) {
        throw new Error('No compatible update asset found for this platform.');
      }

      const info: UpdateInfo = {
        version: latestVersion,
        notes: release?.body ?? null,
        publishedAt: release?.published_at ?? null,
        downloadUrl: asset.browser_download_url,
      };

      setUpdateInfo(info);
      setUpdatePath(null);
      setUpdateStatus('available');
      return info;
    } catch (error) {
      console.error('Update check failed:', error);
      setUpdateError((error as Error)?.message || 'Update check failed.');
      setUpdateStatus('error');
      setLastUpdateCheck(Date.now());
      return null;
    }
  }, [currentVersion, updateSupported]);

  const downloadUpdate = useCallback(
    async (infoOverride?: UpdateInfo): Promise<string | null> => {
      if (!updateSupported) return null;
      const info = infoOverride || updateInfo;
      if (!info?.downloadUrl) {
        setUpdateError('No update available to download.');
        setUpdateStatus('error');
        return null;
      }

      setUpdateStatus('downloading');
      setUpdateError(null);

      try {
        const { extension, baseName } = getUpdateAssetConfig();
        const safeVersion = (info.version || 'unknown').replace(/[^0-9A-Za-z.-]/g, '_');
        const fileName = `${baseName}-${safeVersion}${extension}`;

        const downloadedPath = await invoke('download_update', {
          url: info.downloadUrl,
          fileName,
          dirName: UPDATE_DIR_NAME,
        });

        const os = getPlatform();
        const finalPath =
          os === 'darwin'
            ? await invoke('extract_app_zip', { zipPath: downloadedPath })
            : downloadedPath;

        setUpdatePath(finalPath);
        setUpdateInfo(info);
        setUpdateStatus('ready');
        return finalPath;
      } catch (error) {
        console.error('Update download failed:', error);
        setUpdateError((error as Error)?.message || 'Update download failed.');
        setUpdateStatus('error');
        return null;
      }
    },
    [updateInfo, updateSupported]
  );

  const installUpdate = useCallback(async (): Promise<void> => {
    if (!updateSupported) return;
    if (!updatePath) {
      setUpdateError('No update is ready to install.');
      setUpdateStatus('error');
      return;
    }

    setUpdateStatus('installing');
    setUpdateError(null);

    try {
      await invoke('apply_update', { updatePath });
    } catch (error) {
      console.error('Update install failed:', error);
      setUpdateError((error as Error)?.message || 'Update install failed.');
      setUpdateStatus('error');
    }
  }, [updatePath, updateSupported]);

  const dismissUpdate = useCallback((): void => {
    setUpdateStatus('idle');
    setUpdateInfo(null);
    setUpdatePath(null);
    setUpdateError(null);
  }, []);

  return {
    // State
    currentVersion,
    updateStatus,
    updateInfo,
    updatePath,
    updateError,
    lastUpdateCheck,
    updateSupported,

    // Actions
    checkForUpdate,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
    loadCurrentVersion,
  };
}

export default useUpdateSystem;
