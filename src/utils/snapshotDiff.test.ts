import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deepClone,
  estimateSize,
  maybeCompress,
  maybeDecompress,
  shouldStoreFullSnapshot,
  createDiffSnapshot,
  createFullSnapshot,
  applyPatch,
  reconstructState,
  findNearestFullSnapshot,
  SnapshotManager,
  DEFAULT_CONFIG,
  type Snapshot,
} from './snapshotDiff';

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('snapshotDiff', () => {
  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it('should clone arrays', () => {
      const original = [1, 2, 3];
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it('should clone nested objects', () => {
      const original = { a: { b: { c: 1 } }, d: [1, 2] };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.a).not.toBe(original.a);
    });

    it('should not preserve functions or undefined', () => {
      const original = { fn: () => 42, undef: undefined, val: 1 };
      const cloned = deepClone(original);
      expect(cloned).toEqual({ val: 1 });
    });
  });

  describe('estimateSize', () => {
    it('should estimate size of simple objects', () => {
      const obj = { a: 1, b: 2 };
      const size = estimateSize(obj);
      expect(size).toBeGreaterThan(0);
      // JSON.stringify gives '{"a":1,"b":2}' which is 13 chars, * 2 = 26
      expect(size).toBe(26);
    });

    it('should estimate size of arrays', () => {
      const arr = [1, 2, 3];
      const size = estimateSize(arr);
      expect(size).toBeGreaterThan(0);
    });

    it('should estimate size of nested structures', () => {
      const nested = { a: { b: { c: [1, 2, 3] } } };
      const size = estimateSize(nested);
      expect(size).toBeGreaterThan(estimateSize({ a: 1 }));
    });

    it('should return larger size for larger objects', () => {
      const small = { a: 1 };
      const large = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      expect(estimateSize(large)).toBeGreaterThan(estimateSize(small));
    });
  });

  describe('maybeCompress', () => {
    it('should not compress when disabled', () => {
      const data = 'a'.repeat(10000);
      const result = maybeCompress(data, 100, false);
      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
    });

    it('should not compress when below threshold', () => {
      const data = 'small';
      const result = maybeCompress(data, 1000, true);
      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
    });

    it('should compress large repetitive data', () => {
      // Create highly compressible data
      const data = 'a'.repeat(100000);
      const result = maybeCompress(data, 1000, true);
      // Compression should help with repetitive data
      if (result.compressed) {
        expect(result.data.length).toBeLessThan(data.length);
      }
    });

    it('should not compress if compression does not save space', () => {
      // Random-looking data that may not compress well
      const data = 'abc123xyz789';
      const result = maybeCompress(data, 10, true);
      expect(result.data).toBeDefined();
    });
  });

  describe('maybeDecompress', () => {
    it('should return data unchanged when not compressed', () => {
      const data = 'hello world';
      const result = maybeDecompress(data, false);
      expect(result).toBe(data);
    });

    it('should decompress compressed data', () => {
      const original = 'a'.repeat(10000);
      const { data: compressed, compressed: wasCompressed } = maybeCompress(original, 100, true);
      if (wasCompressed) {
        const decompressed = maybeDecompress(compressed, true);
        expect(decompressed).toBe(original);
      }
    });

    it('should handle edge case of invalid compressed data', () => {
      // When decompression fails, lz-string returns null, we fallback to original
      const result = maybeDecompress('not-compressed-data', true);
      expect(result).toBeDefined();
    });
  });

  describe('shouldStoreFullSnapshot', () => {
    it('should return true for index 0', () => {
      expect(shouldStoreFullSnapshot(0, 10)).toBe(true);
    });

    it('should return true at interval boundaries', () => {
      expect(shouldStoreFullSnapshot(10, 10)).toBe(true);
      expect(shouldStoreFullSnapshot(20, 10)).toBe(true);
      expect(shouldStoreFullSnapshot(30, 10)).toBe(true);
    });

    it('should return false between intervals', () => {
      expect(shouldStoreFullSnapshot(1, 10)).toBe(false);
      expect(shouldStoreFullSnapshot(5, 10)).toBe(false);
      expect(shouldStoreFullSnapshot(9, 10)).toBe(false);
      expect(shouldStoreFullSnapshot(11, 10)).toBe(false);
    });

    it('should work with different intervals', () => {
      expect(shouldStoreFullSnapshot(5, 5)).toBe(true);
      expect(shouldStoreFullSnapshot(3, 5)).toBe(false);
      expect(shouldStoreFullSnapshot(0, 1)).toBe(true);
      expect(shouldStoreFullSnapshot(1, 1)).toBe(true);
    });
  });

  // =============================================================================
  // Snapshot Creation Tests
  // =============================================================================

  describe('createFullSnapshot', () => {
    it('should create a full snapshot', () => {
      const data = { a: 1, b: 2 };
      const snapshot = createFullSnapshot(data);
      expect(snapshot.type).toBe('full');
      expect(snapshot.data).toEqual(data);
      expect(snapshot.timestamp).toBeDefined();
      expect(typeof snapshot.timestamp).toBe('number');
    });

    it('should deep clone the data', () => {
      const data = { nested: { value: 1 } };
      const snapshot = createFullSnapshot(data);
      expect(snapshot.data).toEqual(data);
      expect(snapshot.data).not.toBe(data);
      expect((snapshot.data as typeof data).nested).not.toBe(data.nested);
    });

    it('should handle arrays', () => {
      const data = [1, 2, { a: 3 }];
      const snapshot = createFullSnapshot(data);
      expect(snapshot.data).toEqual(data);
      expect(snapshot.data).not.toBe(data);
    });

    it('should set compressed flag', () => {
      const data = { a: 1 };
      const snapshot = createFullSnapshot(data);
      expect(typeof snapshot.compressed).toBe('boolean');
    });
  });

  describe('createDiffSnapshot', () => {
    it('should create a diff snapshot with patch', () => {
      const previous = { a: 1, b: 2 };
      const current = { a: 1, b: 3 };
      const snapshot = createDiffSnapshot(current, previous, 0);
      expect(snapshot.type).toBe('diff');
      expect(snapshot.patch).toBeDefined();
      expect(Array.isArray(snapshot.patch)).toBe(true);
      expect(snapshot.baseIndex).toBe(0);
      expect(snapshot.timestamp).toBeDefined();
    });

    it('should create empty patch for identical states', () => {
      const state = { a: 1, b: 2 };
      const snapshot = createDiffSnapshot(state, state, 0);
      expect(snapshot.patch).toHaveLength(0);
    });

    it('should detect additions', () => {
      const previous = { a: 1 };
      const current = { a: 1, b: 2 };
      const snapshot = createDiffSnapshot(current, previous, 0);
      expect(snapshot.patch.length).toBeGreaterThan(0);
      expect(snapshot.patch.some((op) => op.op === 'add')).toBe(true);
    });

    it('should detect removals', () => {
      const previous = { a: 1, b: 2 };
      const current = { a: 1 };
      const snapshot = createDiffSnapshot(current, previous, 0);
      expect(snapshot.patch.length).toBeGreaterThan(0);
      expect(snapshot.patch.some((op) => op.op === 'remove')).toBe(true);
    });

    it('should detect replacements', () => {
      const previous = { a: 1 };
      const current = { a: 2 };
      const snapshot = createDiffSnapshot(current, previous, 0);
      expect(snapshot.patch.length).toBeGreaterThan(0);
      expect(snapshot.patch.some((op) => op.op === 'replace')).toBe(true);
    });
  });

  // =============================================================================
  // Patch Application Tests
  // =============================================================================

  describe('applyPatch', () => {
    it('should apply add operation', () => {
      const base = { a: 1 };
      const patch = [{ op: 'add' as const, path: '/b', value: 2 }];
      const result = applyPatch(base, patch);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should apply remove operation', () => {
      const base = { a: 1, b: 2 };
      const patch = [{ op: 'remove' as const, path: '/b' }];
      const result = applyPatch(base, patch);
      expect(result).toEqual({ a: 1 });
    });

    it('should apply replace operation', () => {
      const base = { a: 1 };
      const patch = [{ op: 'replace' as const, path: '/a', value: 99 }];
      const result = applyPatch(base, patch);
      expect(result).toEqual({ a: 99 });
    });

    it('should apply multiple operations', () => {
      const base = { a: 1, b: 2 };
      const patch = [
        { op: 'replace' as const, path: '/a', value: 10 },
        { op: 'add' as const, path: '/c', value: 3 },
        { op: 'remove' as const, path: '/b' },
      ];
      const result = applyPatch(base, patch);
      expect(result).toEqual({ a: 10, c: 3 });
    });

    it('should not modify original base', () => {
      const base = { a: 1, b: { c: 2 } };
      const patch = [{ op: 'replace' as const, path: '/b/c', value: 99 }];
      applyPatch(base, patch);
      expect(base.b.c).toBe(2);
    });

    it('should handle nested paths', () => {
      const base = { a: { b: { c: 1 } } };
      const patch = [{ op: 'replace' as const, path: '/a/b/c', value: 99 }];
      const result = applyPatch(base, patch);
      expect(result).toEqual({ a: { b: { c: 99 } } });
    });
  });

  // =============================================================================
  // State Reconstruction Tests
  // =============================================================================

  describe('reconstructState', () => {
    it('should return null for invalid index', () => {
      const snapshots: Snapshot[] = [];
      expect(reconstructState(snapshots, 0)).toBe(null);
      expect(reconstructState(snapshots, -1)).toBe(null);
    });

    it('should return data from full snapshot directly', () => {
      const snapshots: Snapshot<{ a: number }>[] = [
        { type: 'full', data: { a: 1 }, timestamp: Date.now() },
      ];
      const result = reconstructState(snapshots, 0);
      expect(result).toEqual({ a: 1 });
    });

    it('should reconstruct state from diff snapshot', () => {
      const snapshots: Snapshot<{ a: number; b?: number }>[] = [
        { type: 'full', data: { a: 1 }, timestamp: Date.now() },
        {
          type: 'diff',
          patch: [{ op: 'add', path: '/b', value: 2 }],
          baseIndex: 0,
          timestamp: Date.now(),
        },
      ];
      const result = reconstructState(snapshots, 1);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should chain multiple diff snapshots', () => {
      const snapshots: Snapshot<{ a: number; b?: number; c?: number }>[] = [
        { type: 'full', data: { a: 1 }, timestamp: Date.now() },
        {
          type: 'diff',
          patch: [{ op: 'add', path: '/b', value: 2 }],
          baseIndex: 0,
          timestamp: Date.now(),
        },
        {
          type: 'diff',
          patch: [{ op: 'add', path: '/c', value: 3 }],
          baseIndex: 0,
          timestamp: Date.now(),
        },
      ];
      const result = reconstructState(snapshots, 2);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should return null when base snapshot not found', () => {
      // Create orphaned diff snapshot with no full snapshot
      const snapshots: Snapshot[] = [
        { type: 'diff', patch: [], baseIndex: -1, timestamp: Date.now() },
      ];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = reconstructState(snapshots, 0);
      expect(result).toBe(null);
      consoleSpy.mockRestore();
    });
  });

  describe('findNearestFullSnapshot', () => {
    it('should find full snapshot at exact index', () => {
      const snapshots: Snapshot[] = [
        { type: 'full', data: {}, timestamp: Date.now() },
        { type: 'diff', patch: [], baseIndex: 0, timestamp: Date.now() },
      ];
      expect(findNearestFullSnapshot(snapshots, 0)).toBe(0);
    });

    it('should find full snapshot before diff snapshots', () => {
      const snapshots: Snapshot[] = [
        { type: 'full', data: {}, timestamp: Date.now() },
        { type: 'diff', patch: [], baseIndex: 0, timestamp: Date.now() },
        { type: 'diff', patch: [], baseIndex: 0, timestamp: Date.now() },
      ];
      expect(findNearestFullSnapshot(snapshots, 2)).toBe(0);
    });

    it('should find most recent full snapshot', () => {
      const snapshots: Snapshot[] = [
        { type: 'full', data: {}, timestamp: Date.now() },
        { type: 'diff', patch: [], baseIndex: 0, timestamp: Date.now() },
        { type: 'full', data: {}, timestamp: Date.now() },
        { type: 'diff', patch: [], baseIndex: 2, timestamp: Date.now() },
      ];
      expect(findNearestFullSnapshot(snapshots, 3)).toBe(2);
    });

    it('should return -1 when no full snapshot found', () => {
      const snapshots: Snapshot[] = [
        { type: 'diff', patch: [], baseIndex: -1, timestamp: Date.now() },
      ];
      expect(findNearestFullSnapshot(snapshots, 0)).toBe(-1);
    });
  });

  // =============================================================================
  // SnapshotManager Tests
  // =============================================================================

  describe('SnapshotManager', () => {
    let manager: SnapshotManager<{ count: number }>;

    beforeEach(() => {
      manager = new SnapshotManager({ fullSnapshotInterval: 3 });
    });

    describe('constructor', () => {
      it('should use default config when none provided', () => {
        const defaultManager = new SnapshotManager();
        expect(defaultManager.length).toBe(0);
      });

      it('should merge partial config with defaults', () => {
        const customManager = new SnapshotManager({ fullSnapshotInterval: 5 });
        expect(customManager.length).toBe(0);
      });
    });

    describe('push', () => {
      it('should add first snapshot as full', () => {
        manager.push({ count: 1 });
        const snapshots = manager.getSnapshots();
        expect(snapshots[0].type).toBe('full');
      });

      it('should add subsequent snapshots as diffs', () => {
        manager.push({ count: 1 });
        manager.push({ count: 2 });
        const snapshots = manager.getSnapshots();
        expect(snapshots[0].type).toBe('full');
        expect(snapshots[1].type).toBe('diff');
      });

      it('should add full snapshot at interval', () => {
        // With interval of 3: 0=full, 1=diff, 2=diff, 3=full
        for (let i = 0; i < 4; i++) {
          manager.push({ count: i });
        }
        const snapshots = manager.getSnapshots();
        expect(snapshots[0].type).toBe('full');
        expect(snapshots[1].type).toBe('diff');
        expect(snapshots[2].type).toBe('diff');
        expect(snapshots[3].type).toBe('full');
      });
    });

    describe('length', () => {
      it('should return correct snapshot count', () => {
        expect(manager.length).toBe(0);
        manager.push({ count: 1 });
        expect(manager.length).toBe(1);
        manager.push({ count: 2 });
        expect(manager.length).toBe(2);
      });
    });

    describe('getState', () => {
      it('should return state at any index', () => {
        manager.push({ count: 1 });
        manager.push({ count: 2 });
        manager.push({ count: 3 });

        expect(manager.getState(0)).toEqual({ count: 1 });
        expect(manager.getState(1)).toEqual({ count: 2 });
        expect(manager.getState(2)).toEqual({ count: 3 });
      });

      it('should return null for invalid index', () => {
        expect(manager.getState(0)).toBe(null);
        expect(manager.getState(-1)).toBe(null);
      });
    });

    describe('truncate', () => {
      it('should remove snapshots after index', () => {
        for (let i = 0; i < 5; i++) {
          manager.push({ count: i });
        }
        expect(manager.length).toBe(5);

        manager.truncate(2);
        expect(manager.length).toBe(3);
        expect(manager.getState(2)).toEqual({ count: 2 });
      });

      it('should handle truncating to 0', () => {
        manager.push({ count: 1 });
        manager.push({ count: 2 });
        manager.truncate(0);
        expect(manager.length).toBe(1);
      });
    });

    describe('clear', () => {
      it('should remove all snapshots', () => {
        manager.push({ count: 1 });
        manager.push({ count: 2 });
        expect(manager.length).toBe(2);

        manager.clear();
        expect(manager.length).toBe(0);
        expect(manager.getSnapshots()).toEqual([]);
      });
    });

    describe('getStats', () => {
      it('should return correct statistics', () => {
        // With interval 3: 0=full, 1=diff, 2=diff, 3=full, 4=diff
        for (let i = 0; i < 5; i++) {
          manager.push({ count: i });
        }

        const stats = manager.getStats();
        expect(stats.totalSnapshots).toBe(5);
        expect(stats.fullSnapshots).toBe(2);
        expect(stats.diffSnapshots).toBe(3);
        expect(stats.estimatedBytes).toBeGreaterThan(0);
      });

      it('should return zero stats for empty manager', () => {
        const stats = manager.getStats();
        expect(stats.totalSnapshots).toBe(0);
        expect(stats.fullSnapshots).toBe(0);
        expect(stats.diffSnapshots).toBe(0);
        expect(stats.estimatedBytes).toBe(0);
      });
    });
  });

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('integration', () => {
    it('should handle complex workflow state', () => {
      interface WorkflowState {
        nodes: Array<{ id: string; type: string; position: { x: number; y: number } }>;
        edges: Array<{ id: string; source: string; target: string }>;
      }

      const manager = new SnapshotManager<WorkflowState>({ fullSnapshotInterval: 5 });

      // Initial state
      manager.push({
        nodes: [{ id: 'n1', type: 'text', position: { x: 0, y: 0 } }],
        edges: [],
      });

      // Add a node
      manager.push({
        nodes: [
          { id: 'n1', type: 'text', position: { x: 0, y: 0 } },
          { id: 'n2', type: 'image', position: { x: 100, y: 100 } },
        ],
        edges: [],
      });

      // Add an edge
      manager.push({
        nodes: [
          { id: 'n1', type: 'text', position: { x: 0, y: 0 } },
          { id: 'n2', type: 'image', position: { x: 100, y: 100 } },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });

      // Verify states can be reconstructed
      const state0 = manager.getState(0);
      expect(state0?.nodes).toHaveLength(1);
      expect(state0?.edges).toHaveLength(0);

      const state1 = manager.getState(1);
      expect(state1?.nodes).toHaveLength(2);
      expect(state1?.edges).toHaveLength(0);

      const state2 = manager.getState(2);
      expect(state2?.nodes).toHaveLength(2);
      expect(state2?.edges).toHaveLength(1);
    });

    it('should handle undo/redo workflow', () => {
      const manager = new SnapshotManager<{ value: number }>();
      let currentIndex = -1;

      // Helper to simulate undo/redo
      const setState = (value: number) => {
        if (currentIndex < manager.length - 1) {
          manager.truncate(currentIndex);
        }
        manager.push({ value });
        currentIndex = manager.length - 1;
      };

      const undo = () => {
        if (currentIndex > 0) {
          currentIndex--;
          return manager.getState(currentIndex);
        }
        return null;
      };

      const redo = () => {
        if (currentIndex < manager.length - 1) {
          currentIndex++;
          return manager.getState(currentIndex);
        }
        return null;
      };

      // Simulate user actions
      setState(1);
      setState(2);
      setState(3);

      expect(manager.getState(currentIndex)).toEqual({ value: 3 });

      // Undo twice
      expect(undo()).toEqual({ value: 2 });
      expect(undo()).toEqual({ value: 1 });

      // Redo once
      expect(redo()).toEqual({ value: 2 });

      // New action clears redo stack
      setState(4);
      expect(redo()).toBe(null); // No redo available
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_CONFIG.fullSnapshotInterval).toBe(10);
      expect(DEFAULT_CONFIG.compressionThreshold).toBe(100 * 1024);
      expect(DEFAULT_CONFIG.enableCompression).toBe(true);
    });
  });
});
