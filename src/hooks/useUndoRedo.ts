import { useCallback, useRef, useState, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { freeze } from 'immer';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { compare, applyPatch, Operation } from 'fast-json-patch';
import { sortNodesForReactFlow } from '../utils/createNode';

// =============================================================================
// Performance Constants
// =============================================================================

/** Enable performance profiling in development */
const ENABLE_PROFILING = process.env.NODE_ENV === 'development';

/** Threshold in bytes to consider using compression */
const COMPRESSION_THRESHOLD = 100 * 1024; // 100KB

/** Store a full snapshot every N operations */
const FULL_SNAPSHOT_INTERVAL = 10;

// ============================================================================
// Types
// ============================================================================

export interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

/** Full snapshot containing complete state */
interface FullStoredSnapshot {
  type: 'full';
  data: string; // JSON stringified HistorySnapshot
  compressed: boolean;
  timestamp: number;
}

/** Diff snapshot containing JSON Patch operations */
interface DiffStoredSnapshot {
  type: 'diff';
  patch: string; // JSON stringified Operation[]
  compressed: boolean;
  baseIndex: number;
  timestamp: number;
}

type StoredSnapshot = FullStoredSnapshot | DiffStoredSnapshot;

// ============================================================================
// Profiling Utilities
// ============================================================================

/**
 * Performance profiler for undo/redo operations
 */
const profiler = {
  start(label: string): void {
    if (ENABLE_PROFILING) {
      performance.mark(`undo-redo-${label}-start`);
    }
  },
  end(label: string): void {
    if (ENABLE_PROFILING) {
      performance.mark(`undo-redo-${label}-end`);
      try {
        performance.measure(
          `undo-redo-${label}`,
          `undo-redo-${label}-start`,
          `undo-redo-${label}-end`
        );
        const entries = performance.getEntriesByName(`undo-redo-${label}`);
        if (entries.length > 0) {
          const duration = entries[entries.length - 1].duration;
          console.debug(`[UndoRedo] ${label}: ${duration.toFixed(2)}ms`);
        }
      } catch {
        // Ignore measurement errors
      }
    }
  },
  measureSnapshotSize(snapshot: HistorySnapshot): number {
    const jsonString = JSON.stringify(snapshot);
    const sizeBytes = new Blob([jsonString]).size;
    if (ENABLE_PROFILING) {
      console.debug(`[UndoRedo] Snapshot size: ${(sizeBytes / 1024).toFixed(2)}KB`);
    }
    return sizeBytes;
  },
  logStats(full: number, diff: number, bytes: number): void {
    if (ENABLE_PROFILING) {
      console.debug(
        `[UndoRedo] Stats: ${full} full, ${diff} diff, ${(bytes / 1024).toFixed(2)}KB total`
      );
    }
  },
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Strip functions from an object (structuredClone can't clone functions)
 */
const stripFunctions = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripFunctions);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== 'function') {
      result[key] = stripFunctions(value);
    }
  }
  return result;
};

/**
 * Deep clone using structuredClone (faster than JSON.parse/stringify)
 * Falls back to JSON method for environments without structuredClone
 * Strips functions before cloning since structuredClone can't handle them
 */
const deepClone = <T>(obj: T): T => {
  const stripped = stripFunctions(obj) as T;
  if (typeof structuredClone === 'function') {
    return structuredClone(stripped);
  }
  return JSON.parse(JSON.stringify(stripped));
};

/**
 * Compress data if it exceeds the threshold
 */
const maybeCompress = (data: string): { data: string; compressed: boolean } => {
  if (data.length * 2 < COMPRESSION_THRESHOLD) {
    return { data, compressed: false };
  }

  const compressed = compressToUTF16(data);
  if (compressed.length < data.length) {
    return { data: compressed, compressed: true };
  }

  return { data, compressed: false };
};

/**
 * Decompress data if it was compressed
 */
const maybeDecompress = (data: string, compressed: boolean): string => {
  if (!compressed) return data;
  return decompressFromUTF16(data) || data;
};

/**
 * Determine if a full snapshot should be stored at the given index
 */
const shouldStoreFullSnapshot = (index: number): boolean => {
  return index === 0 || index % FULL_SNAPSHOT_INTERVAL === 0;
};

export interface UseUndoRedoOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  maxHistory?: number;
  debounceMs?: number;
}

export interface UseUndoRedoReturn {
  undo: () => boolean;
  redo: () => boolean;
  takeSnapshot: (immediate?: boolean) => void;
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  futureLength: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing undo/redo history in the workflow editor
 *
 * Features:
 * - Diff-based snapshot storage for memory efficiency
 * - Compression for large snapshots
 * - Configurable max history size
 * - Debounced snapshots to avoid flooding history during drag operations
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 */
export const useUndoRedo = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  maxHistory = 50,
  debounceMs = 300,
}: UseUndoRedoOptions): UseUndoRedoReturn => {
  // History stacks - stored as optimized snapshots
  const [pastStates, setPastStates] = useState<StoredSnapshot[]>([]);
  const [futureStates, setFutureStates] = useState<StoredSnapshot[]>([]);

  // Track if we're currently applying an undo/redo to prevent snapshot
  const isApplyingRef = useRef<boolean>(false);

  // Debounce timer for position changes
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store the last saved state to detect meaningful changes
  const lastSavedStateRef = useRef<HistorySnapshot | null>(null);

  // Cache the last reconstructed state for efficient diff creation
  const lastReconstructedRef = useRef<HistorySnapshot | null>(null);

  /**
   * Create a snapshot of the current state
   * Uses structuredClone for better performance and Immer's freeze for immutability
   */
  const createSnapshot = useCallback((): HistorySnapshot => {
    profiler.start('createSnapshot');

    const snapshot: HistorySnapshot = {
      nodes: deepClone(nodes),
      edges: deepClone(edges),
      timestamp: Date.now(),
    };

    // Measure snapshot size for profiling
    profiler.measureSnapshotSize(snapshot);

    // Freeze the snapshot to prevent accidental mutations
    const frozen = freeze(snapshot, true);

    profiler.end('createSnapshot');
    return frozen;
  }, [nodes, edges]);

  /**
   * Reconstruct a HistorySnapshot from a stored snapshot
   */
  const reconstructSnapshot = useCallback(
    (storedSnapshots: StoredSnapshot[], index: number): HistorySnapshot | null => {
      if (index < 0 || index >= storedSnapshots.length) {
        return null;
      }

      profiler.start('reconstruct');

      const target = storedSnapshots[index];

      // If it's a full snapshot, decompress and parse it
      if (target.type === 'full') {
        const jsonStr = maybeDecompress(target.data, target.compressed);
        const result = JSON.parse(jsonStr) as HistorySnapshot;
        profiler.end('reconstruct');
        return result;
      }

      // Find the nearest full snapshot and apply patches
      let baseIndex = target.baseIndex;
      while (baseIndex >= 0 && storedSnapshots[baseIndex].type !== 'full') {
        const s = storedSnapshots[baseIndex] as DiffStoredSnapshot;
        baseIndex = s.baseIndex;
      }

      if (baseIndex < 0) {
        console.error('Could not find base snapshot for reconstruction');
        profiler.end('reconstruct');
        return null;
      }

      // Get base state
      const baseSnapshot = storedSnapshots[baseIndex] as FullStoredSnapshot;
      const baseJsonStr = maybeDecompress(baseSnapshot.data, baseSnapshot.compressed);
      let currentState = JSON.parse(baseJsonStr) as HistorySnapshot;

      // Apply patches from base to target
      for (let i = baseIndex + 1; i <= index; i++) {
        const snapshot = storedSnapshots[i];
        if (snapshot.type === 'diff') {
          const patchStr = maybeDecompress(snapshot.patch, snapshot.compressed);
          const patch = JSON.parse(patchStr) as Operation[];
          const patched = applyPatch(deepClone(currentState), patch);
          currentState = patched.newDocument as HistorySnapshot;
        }
      }

      profiler.end('reconstruct');
      return currentState;
    },
    []
  );

  /**
   * Create a stored snapshot (either full or diff)
   */
  const createStoredSnapshot = useCallback(
    (snapshot: HistorySnapshot, existingSnapshots: StoredSnapshot[]): StoredSnapshot => {
      const index = existingSnapshots.length;

      // Always store first snapshot or every Nth as full
      if (shouldStoreFullSnapshot(index)) {
        const jsonStr = JSON.stringify(snapshot);
        const { data, compressed } = maybeCompress(jsonStr);
        return {
          type: 'full',
          data,
          compressed,
          timestamp: snapshot.timestamp,
        };
      }

      // Create a diff from the previous state
      const previousState =
        lastReconstructedRef.current || reconstructSnapshot(existingSnapshots, index - 1);

      if (!previousState) {
        // Fallback to full snapshot if we can't reconstruct
        const jsonStr = JSON.stringify(snapshot);
        const { data, compressed } = maybeCompress(jsonStr);
        return {
          type: 'full',
          data,
          compressed,
          timestamp: snapshot.timestamp,
        };
      }

      // Find nearest full snapshot for base index
      let baseIndex = index - 1;
      while (baseIndex >= 0 && existingSnapshots[baseIndex]?.type !== 'full') {
        const s = existingSnapshots[baseIndex] as DiffStoredSnapshot;
        baseIndex = s.baseIndex;
      }

      // Create JSON patch
      const patch = compare(previousState, snapshot);
      const patchStr = JSON.stringify(patch);
      const { data, compressed } = maybeCompress(patchStr);

      // If diff is larger than a full snapshot, store full instead
      const fullJsonStr = JSON.stringify(snapshot);
      if (patchStr.length > fullJsonStr.length * 0.8) {
        const { data: fullData, compressed: fullCompressed } = maybeCompress(fullJsonStr);
        return {
          type: 'full',
          data: fullData,
          compressed: fullCompressed,
          timestamp: snapshot.timestamp,
        };
      }

      return {
        type: 'diff',
        patch: data,
        compressed,
        baseIndex: baseIndex >= 0 ? baseIndex : 0,
        timestamp: snapshot.timestamp,
      };
    },
    [reconstructSnapshot]
  );

  /**
   * Check if the state has meaningfully changed
   */
  const hasStateChanged = useCallback((snapshot: HistorySnapshot): boolean => {
    if (!lastSavedStateRef.current) return true;

    const last = lastSavedStateRef.current;

    // Check node count
    if (snapshot.nodes.length !== last.nodes.length) return true;
    if (snapshot.edges.length !== last.edges.length) return true;

    // Check node IDs
    const currentIds = new Set(snapshot.nodes.map((n) => n.id));
    const lastIds = new Set(last.nodes.map((n) => n.id));
    if (currentIds.size !== lastIds.size) return true;
    for (const id of currentIds) {
      if (!lastIds.has(id)) return true;
    }

    // Check edge IDs
    const currentEdgeIds = new Set(snapshot.edges.map((e) => e.id));
    const lastEdgeIds = new Set(last.edges.map((e) => e.id));
    if (currentEdgeIds.size !== lastEdgeIds.size) return true;
    for (const id of currentEdgeIds) {
      if (!lastEdgeIds.has(id)) return true;
    }

    // Check node positions (with threshold for position changes)
    for (const node of snapshot.nodes) {
      const lastNode = last.nodes.find((n) => n.id === node.id);
      if (!lastNode) return true;

      const dx = Math.abs((node.position?.x || 0) - (lastNode.position?.x || 0));
      const dy = Math.abs((node.position?.y || 0) - (lastNode.position?.y || 0));

      // Consider it changed if moved more than 5 pixels
      if (dx > 5 || dy > 5) return true;
    }

    return false;
  }, []);

  /**
   * Take a snapshot for undo history
   */
  const takeSnapshot = useCallback(
    (immediate = false): void => {
      if (isApplyingRef.current) return;

      const saveSnapshot = (): void => {
        const snapshot = createSnapshot();

        if (!hasStateChanged(snapshot)) return;

        setPastStates((prev) => {
          const storedSnapshot = createStoredSnapshot(snapshot, prev);
          const newPast = [...prev, storedSnapshot].slice(-maxHistory);

          // Log stats in dev mode
          if (ENABLE_PROFILING) {
            const full = newPast.filter((s) => s.type === 'full').length;
            const diff = newPast.filter((s) => s.type === 'diff').length;
            const bytes = newPast.reduce((acc, s) => {
              if (s.type === 'full') return acc + s.data.length * 2;
              return acc + s.patch.length * 2;
            }, 0);
            profiler.logStats(full, diff, bytes);
          }

          return newPast;
        });

        // Clear future states when new action is taken
        setFutureStates([]);

        lastSavedStateRef.current = snapshot;
        lastReconstructedRef.current = snapshot;
      };

      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        saveSnapshot();
      } else {
        // Debounce for position changes
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(saveSnapshot, debounceMs);
      }
    },
    [createSnapshot, createStoredSnapshot, hasStateChanged, maxHistory, debounceMs]
  );

  /**
   * Undo the last action
   */
  const undo = useCallback((): boolean => {
    if (pastStates.length === 0) return false;

    profiler.start('undo');
    isApplyingRef.current = true;

    // Save current state to future
    const currentSnapshot = createSnapshot();
    const currentStored = createStoredSnapshot(currentSnapshot, []);
    setFutureStates((prev) => [currentStored, ...prev].slice(0, maxHistory));

    // Get previous state
    const previousState = reconstructSnapshot(pastStates, pastStates.length - 1);
    setPastStates((prev) => prev.slice(0, -1));

    // Apply previous state (sort nodes to ensure parents come before children)
    if (previousState) {
      setNodes(sortNodesForReactFlow(previousState.nodes));
      setEdges(previousState.edges);
      lastSavedStateRef.current = previousState;
      lastReconstructedRef.current = previousState;
    }

    profiler.end('undo');

    // Allow new snapshots after a short delay
    setTimeout(() => {
      isApplyingRef.current = false;
    }, 50);

    return true;
  }, [
    pastStates,
    createSnapshot,
    createStoredSnapshot,
    reconstructSnapshot,
    maxHistory,
    setNodes,
    setEdges,
  ]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback((): boolean => {
    if (futureStates.length === 0) return false;

    profiler.start('redo');
    isApplyingRef.current = true;

    // Save current state to past
    const currentSnapshot = createSnapshot();
    setPastStates((prev) => {
      const stored = createStoredSnapshot(currentSnapshot, prev);
      return [...prev, stored].slice(-maxHistory);
    });

    // Get next state
    const nextState = reconstructSnapshot(futureStates, 0);
    setFutureStates((prev) => prev.slice(1));

    // Apply next state (sort nodes to ensure parents come before children)
    if (nextState) {
      setNodes(sortNodesForReactFlow(nextState.nodes));
      setEdges(nextState.edges);
      lastSavedStateRef.current = nextState;
      lastReconstructedRef.current = nextState;
    }

    profiler.end('redo');

    // Allow new snapshots after a short delay
    setTimeout(() => {
      isApplyingRef.current = false;
    }, 50);

    return true;
  }, [
    futureStates,
    createSnapshot,
    createStoredSnapshot,
    reconstructSnapshot,
    maxHistory,
    setNodes,
    setEdges,
  ]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback((): void => {
    setPastStates([]);
    setFutureStates([]);
    lastSavedStateRef.current = null;
    lastReconstructedRef.current = null;
  }, []);

  /**
   * Handle keyboard shortcuts for undo/redo
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Don't trigger when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z OR Ctrl/Cmd + Y - Redo
      if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'y')
      ) {
        event.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    undo,
    redo,
    takeSnapshot,
    clearHistory,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
    historyLength: pastStates.length,
    futureLength: futureStates.length,
  };
};

export default useUndoRedo;
