import { useEffect, useMemo, useRef, useState } from 'react';

export type ContextualSurfaceMode =
  | 'composition'
  | 'inspect'
  | 'execution'
  | 'output-review'
  | 'failure';

export interface UseContextualSurfacesArgs {
  selectedNodeId: string | null;
  failedNodeIds: string[];
  outputCount: number;
  isProcessing: boolean;
}

export interface UseContextualSurfacesResult {
  mode: ContextualSurfaceMode;
  showInspector: boolean;
  showOutputTray: boolean;
  openInspector: () => void;
  closeInspector: () => void;
  openOutputTray: () => void;
  closeOutputTray: () => void;
}

export function useContextualSurfaces({
  selectedNodeId,
  failedNodeIds,
  outputCount,
  isProcessing,
}: UseContextualSurfacesArgs): UseContextualSurfacesResult {
  const [dismissedInspectorNodeId, setDismissedInspectorNodeId] = useState<string | null>(null);
  const [outputTrayOpen, setOutputTrayOpen] = useState(false);
  const previousOutputCountRef = useRef(outputCount);
  const previousSelectedNodeIdRef = useRef<string | null>(selectedNodeId);

  const failedNodeSet = useMemo(() => new Set(failedNodeIds), [failedNodeIds]);
  const selectedNodeFailed = selectedNodeId ? failedNodeSet.has(selectedNodeId) : false;
  const hasFailures = failedNodeIds.length > 0;

  useEffect(() => {
    if (previousSelectedNodeIdRef.current !== selectedNodeId) {
      setDismissedInspectorNodeId(null);
      previousSelectedNodeIdRef.current = selectedNodeId;
    }
  }, [selectedNodeId]);

  useEffect(() => {
    const previousOutputCount = previousOutputCountRef.current;
    if (!isProcessing && outputCount > previousOutputCount) {
      setOutputTrayOpen(true);
    }
    previousOutputCountRef.current = outputCount;
  }, [isProcessing, outputCount]);

  const showInspector =
    !!selectedNodeId && (selectedNodeFailed || dismissedInspectorNodeId !== selectedNodeId);
  const showOutputTray = outputCount > 0 && outputTrayOpen;

  let mode: ContextualSurfaceMode = 'composition';
  if (hasFailures) mode = 'failure';
  else if (isProcessing) mode = 'execution';
  else if (showOutputTray) mode = 'output-review';
  else if (showInspector) mode = 'inspect';

  return {
    mode,
    showInspector,
    showOutputTray,
    openInspector: () => setDismissedInspectorNodeId(null),
    closeInspector: () => {
      if (!selectedNodeId || selectedNodeFailed) return;
      setDismissedInspectorNodeId(selectedNodeId);
    },
    openOutputTray: () => {
      if (outputCount > 0) setOutputTrayOpen(true);
    },
    closeOutputTray: () => setOutputTrayOpen(false),
  };
}
