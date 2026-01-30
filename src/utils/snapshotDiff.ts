/**
 * Snapshot diffing utilities for undo/redo optimization.
 * Uses JSON Patch (RFC 6902) for efficient state storage.
 */

import { compare, applyPatch as jsonApplyPatch, Operation } from 'fast-json-patch';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

// =============================================================================
// Types
// =============================================================================

export interface FullSnapshot<T = unknown> {
  type: 'full';
  data: T;
  timestamp: number;
  compressed?: boolean;
}

export interface DiffSnapshot {
  type: 'diff';
  /** JSON Patch operations to apply to previous state */
  patch: Operation[];
  /** Index of the base snapshot to apply patch against */
  baseIndex: number;
  timestamp: number;
  compressed?: boolean;
}

export type Snapshot<T = unknown> = FullSnapshot<T> | DiffSnapshot;

export interface SnapshotConfig {
  /** Store a full snapshot every N operations (default: 10) */
  fullSnapshotInterval: number;
  /** Compression threshold in bytes (default: 100KB) */
  compressionThreshold: number;
  /** Enable compression (default: true) */
  enableCompression: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_CONFIG: SnapshotConfig = {
  fullSnapshotInterval: 10,
  compressionThreshold: 100 * 1024, // 100KB
  enableCompression: true,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Deep clone an object using JSON serialization.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Estimate the byte size of an object when serialized.
 */
export function estimateSize(obj: unknown): number {
  return JSON.stringify(obj).length * 2; // UTF-16 approximation
}

/**
 * Compress a string if it exceeds the threshold.
 */
export function maybeCompress(
  data: string,
  threshold: number,
  enabled: boolean
): { data: string; compressed: boolean } {
  if (!enabled || data.length * 2 < threshold) {
    return { data, compressed: false };
  }

  const compressed = compressToUTF16(data);

  // Only use compression if it actually saves space
  if (compressed.length < data.length) {
    return { data: compressed, compressed: true };
  }

  return { data, compressed: false };
}

/**
 * Decompress data if it was compressed.
 */
export function maybeDecompress(data: string, compressed: boolean): string {
  if (!compressed) return data;
  return decompressFromUTF16(data) || data;
}

// =============================================================================
// Snapshot Operations
// =============================================================================

/**
 * Determine if a full snapshot should be stored at the given index.
 */
export function shouldStoreFullSnapshot(index: number, interval: number): boolean {
  return index === 0 || index % interval === 0;
}

/**
 * Create a diff snapshot by comparing current state to previous state.
 */
export function createDiffSnapshot<T>(
  current: T,
  previous: T,
  baseIndex: number,
  config: SnapshotConfig = DEFAULT_CONFIG
): DiffSnapshot {
  const patch = compare(previous as object, current as object);

  // Serialize and potentially compress the patch
  const serialized = JSON.stringify(patch);
  const { data, compressed } = maybeCompress(
    serialized,
    config.compressionThreshold,
    config.enableCompression
  );

  return {
    type: 'diff',
    patch: compressed ? (JSON.parse(maybeDecompress(data, compressed)) as Operation[]) : patch,
    baseIndex,
    timestamp: Date.now(),
    compressed,
  };
}

/**
 * Create a full snapshot of the current state.
 */
export function createFullSnapshot<T>(
  data: T,
  config: SnapshotConfig = DEFAULT_CONFIG
): FullSnapshot<T> {
  // Serialize and potentially compress the data
  const serialized = JSON.stringify(data);
  const { data: compressedData, compressed } = maybeCompress(
    serialized,
    config.compressionThreshold,
    config.enableCompression
  );

  const storedData = compressed
    ? (JSON.parse(maybeDecompress(compressedData, compressed)) as T)
    : data;

  return {
    type: 'full',
    data: deepClone(storedData),
    timestamp: Date.now(),
    compressed,
  };
}

/**
 * Apply a JSON patch to reconstruct state from a base.
 */
export function applyPatch<T>(base: T, patch: Operation[]): T {
  const cloned = deepClone(base);
  const result = jsonApplyPatch(cloned as object, patch);
  return result.newDocument as T;
}

/**
 * Reconstruct state at a given index from a list of snapshots.
 */
export function reconstructState<T>(snapshots: Snapshot<T>[], targetIndex: number): T | null {
  if (targetIndex < 0 || targetIndex >= snapshots.length) {
    return null;
  }

  const target = snapshots[targetIndex];

  // If it's a full snapshot, return it directly
  if (target.type === 'full') {
    return deepClone(target.data);
  }

  // Find the nearest full snapshot before this index
  let baseIndex = target.baseIndex;
  let baseState: T | null = null;

  // Walk back to find the full snapshot
  while (baseIndex >= 0) {
    const baseSnapshot = snapshots[baseIndex];
    if (baseSnapshot.type === 'full') {
      baseState = deepClone(baseSnapshot.data);
      break;
    }
    baseIndex = baseSnapshot.baseIndex;
  }

  if (baseState === null) {
    console.error('Could not find base snapshot for reconstruction');
    return null;
  }

  // Apply patches from base to target
  for (let i = baseIndex + 1; i <= targetIndex; i++) {
    const snapshot = snapshots[i];
    if (snapshot.type === 'diff') {
      baseState = applyPatch(baseState, snapshot.patch);
    }
  }

  return baseState;
}

/**
 * Find the index of the most recent full snapshot before the given index.
 */
export function findNearestFullSnapshot<T>(snapshots: Snapshot<T>[], beforeIndex: number): number {
  for (let i = beforeIndex; i >= 0; i--) {
    if (snapshots[i].type === 'full') {
      return i;
    }
  }
  return -1;
}

// =============================================================================
// Snapshot Manager Class
// =============================================================================

/**
 * Manager for handling snapshot creation and reconstruction.
 */
export class SnapshotManager<T> {
  private snapshots: Snapshot<T>[] = [];
  private config: SnapshotConfig;

  constructor(config: Partial<SnapshotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the current number of snapshots.
   */
  get length(): number {
    return this.snapshots.length;
  }

  /**
   * Get all snapshots.
   */
  getSnapshots(): Snapshot<T>[] {
    return this.snapshots;
  }

  /**
   * Add a new snapshot.
   */
  push(state: T): void {
    const index = this.snapshots.length;

    if (shouldStoreFullSnapshot(index, this.config.fullSnapshotInterval)) {
      this.snapshots.push(createFullSnapshot(state, this.config));
    } else {
      const previousState = this.getState(index - 1);
      if (previousState === null) {
        // Fallback to full snapshot if we can't get previous state
        this.snapshots.push(createFullSnapshot(state, this.config));
      } else {
        const nearestFull = findNearestFullSnapshot(this.snapshots, index - 1);
        this.snapshots.push(createDiffSnapshot(state, previousState, nearestFull, this.config));
      }
    }
  }

  /**
   * Get the state at a specific index.
   */
  getState(index: number): T | null {
    return reconstructState(this.snapshots, index);
  }

  /**
   * Remove all snapshots after the given index.
   */
  truncate(afterIndex: number): void {
    this.snapshots = this.snapshots.slice(0, afterIndex + 1);
  }

  /**
   * Clear all snapshots.
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Get memory usage statistics.
   */
  getStats(): {
    totalSnapshots: number;
    fullSnapshots: number;
    diffSnapshots: number;
    estimatedBytes: number;
  } {
    let fullSnapshots = 0;
    let diffSnapshots = 0;
    let estimatedBytes = 0;

    for (const snapshot of this.snapshots) {
      if (snapshot.type === 'full') {
        fullSnapshots++;
        estimatedBytes += estimateSize(snapshot.data);
      } else {
        diffSnapshots++;
        estimatedBytes += estimateSize(snapshot.patch);
      }
    }

    return {
      totalSnapshots: this.snapshots.length,
      fullSnapshots,
      diffSnapshots,
      estimatedBytes,
    };
  }
}

export default SnapshotManager;
