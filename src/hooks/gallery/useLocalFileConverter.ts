import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Output, isLocalPath } from '../../components/gallery/types';

interface UseLocalFileConverterReturn {
  convertedSrcs: Record<string, string>;
  loadingImages: Record<string, boolean>;
  convertLocalFile: (filePath: string, outputId?: string) => Promise<string | null>;
  getDisplaySrc: (output: Output) => string;
}

/**
 * Hook for converting local file paths to data URLs for display
 */
export function useLocalFileConverter(): UseLocalFileConverterReturn {
  const [convertedSrcs, setConvertedSrcs] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});

  const pendingLoadsRef = useRef<Set<string>>(new Set());
  const convertedSrcsRef = useRef<Record<string, string>>({});

  const convertLocalFile = useCallback(
    async (filePath: string, outputId?: string): Promise<string | null> => {
      if (!filePath || !isLocalPath(filePath)) return null;

      const cacheKey = outputId || filePath;

      // Use refs for synchronous checks to avoid race conditions with stale closures
      if (convertedSrcsRef.current[cacheKey]) return convertedSrcsRef.current[cacheKey];
      if (pendingLoadsRef.current.has(cacheKey)) return null;

      // Mark as pending immediately using ref (synchronous, no stale closure)
      pendingLoadsRef.current.add(cacheKey);
      setLoadingImages((prev) => ({ ...prev, [cacheKey]: true }));

      try {
        const dataUrl = await invoke<string>('read_file_as_base64', { filePath });
        // Update both ref (for synchronous access) and state (for re-render)
        convertedSrcsRef.current[cacheKey] = dataUrl;
        setConvertedSrcs((prev) => ({ ...prev, [cacheKey]: dataUrl }));
        setLoadingImages((prev) => ({ ...prev, [cacheKey]: false }));
        return dataUrl;
      } catch (error) {
        console.error(`Failed to convert local file: ${filePath}`, error);
        pendingLoadsRef.current.delete(cacheKey);
        setLoadingImages((prev) => ({ ...prev, [cacheKey]: false }));
        return null;
      }
    },
    []
  );

  const getDisplaySrc = useCallback(
    (output: Output): string => {
      const cacheKey = output.id || output.value;
      if (convertedSrcs[cacheKey]) {
        return convertedSrcs[cacheKey];
      }
      return output.value;
    },
    [convertedSrcs]
  );

  return {
    convertedSrcs,
    loadingImages,
    convertLocalFile,
    getDisplaySrc,
  };
}
