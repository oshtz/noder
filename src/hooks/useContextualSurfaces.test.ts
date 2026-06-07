import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useContextualSurfaces } from './useContextualSurfaces';

describe('useContextualSurfaces', () => {
  it('keeps inspector hidden in composition mode', () => {
    const { result } = renderHook(() =>
      useContextualSurfaces({
        selectedNodeId: null,
        failedNodeIds: [],
        outputCount: 0,
        isProcessing: false,
      })
    );

    expect(result.current.showInspector).toBe(false);
    expect(result.current.showOutputTray).toBe(false);
    expect(result.current.mode).toBe('composition');
  });

  it('opens inspector when a node is selected and lets the same node stay dismissed', () => {
    const { result, rerender } = renderHook(
      (selectedNodeId: string | null) =>
        useContextualSurfaces({
          selectedNodeId,
          failedNodeIds: [],
          outputCount: 0,
          isProcessing: false,
        }),
      { initialProps: 'node-1' }
    );

    expect(result.current.showInspector).toBe(true);
    expect(result.current.mode).toBe('inspect');

    act(() => result.current.closeInspector());
    expect(result.current.showInspector).toBe(false);

    rerender('node-1');
    expect(result.current.showInspector).toBe(false);

    rerender('node-2');
    expect(result.current.showInspector).toBe(true);
  });

  it('forces inspector visible for a failed selected node', () => {
    const { result } = renderHook(() =>
      useContextualSurfaces({
        selectedNodeId: 'node-1',
        failedNodeIds: ['node-1'],
        outputCount: 0,
        isProcessing: false,
      })
    );

    act(() => result.current.closeInspector());
    expect(result.current.showInspector).toBe(true);
    expect(result.current.mode).toBe('failure');
  });

  it('opens output tray when output count increases after processing', () => {
    const { result, rerender } = renderHook(
      ({ outputCount, isProcessing }: { outputCount: number; isProcessing: boolean }) =>
        useContextualSurfaces({
          selectedNodeId: null,
          failedNodeIds: [],
          outputCount,
          isProcessing,
        }),
      { initialProps: { outputCount: 1, isProcessing: true } }
    );

    expect(result.current.showOutputTray).toBe(false);

    rerender({ outputCount: 2, isProcessing: false });
    expect(result.current.showOutputTray).toBe(true);
    expect(result.current.mode).toBe('output-review');

    act(() => result.current.closeOutputTray());
    expect(result.current.showOutputTray).toBe(false);
  });

  it('lets users manually open the output tray when outputs exist', () => {
    const { result } = renderHook(() =>
      useContextualSurfaces({
        selectedNodeId: null,
        failedNodeIds: [],
        outputCount: 3,
        isProcessing: false,
      })
    );

    act(() => result.current.openOutputTray());
    expect(result.current.showOutputTray).toBe(true);
  });
});
