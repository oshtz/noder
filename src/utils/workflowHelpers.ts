/**
 * Workflow helper functions extracted from App.tsx
 */

import { invoke } from '@tauri-apps/api/core';
import type { Node, Edge } from 'reactflow';
import { validateEdges } from './handleValidation';
import { LEGACY_HANDLE_ALIASES } from '../constants/app';
import type { WorkflowTemplate } from './workflowTemplates';
import type { ValidationError } from '../types/components';

// ============================================================================
// Types
// ============================================================================

interface EdgeData {
  isProcessing?: boolean;
  edgeType?: string;
  showSourceGlow?: boolean;
  showTargetGlow?: boolean;
  sourceNodeWidth?: number;
  sourceNodeHeight?: number;
  targetNodeWidth?: number;
  targetNodeHeight?: number;
}

interface OutputPayload {
  type: string;
  value: string;
  metadata?: {
    model?: string;
  };
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Normalizes templates array to ensure valid structure
 */
export const normalizeTemplates = (templates: unknown): WorkflowTemplate[] => {
  if (!Array.isArray(templates)) return [];
  return templates.map((template) => {
    const safeTemplate =
      template && typeof template === 'object'
        ? (template as WorkflowTemplate)
        : ({} as Partial<WorkflowTemplate>);
    return {
      id: safeTemplate.id || `template-${Date.now()}`,
      name: safeTemplate.name || 'Untitled',
      description: safeTemplate.description || '',
      icon: safeTemplate.icon || 'file',
      category: safeTemplate.category || 'beginner',
      nodes: Array.isArray(safeTemplate.nodes) ? safeTemplate.nodes : [],
      edges: Array.isArray(safeTemplate.edges) ? safeTemplate.edges : [],
    };
  });
};

// ============================================================================
// Handle Normalization
// ============================================================================

/**
 * Normalizes handle IDs for legacy workflows
 */
export const normalizeHandleId = (
  nodeId: string,
  handleId: string | null | undefined,
  direction: 'source' | 'target',
  nodesById: Record<string, Node>
): string | null | undefined => {
  if (!handleId) return handleId;
  const node = nodesById?.[nodeId];
  if (!node) return handleId;
  const aliasMap = LEGACY_HANDLE_ALIASES[node.type as string];
  const directionMap = aliasMap?.[direction];
  return directionMap?.[handleId] || handleId;
};

// ============================================================================
// Edge Processing
// ============================================================================

/**
 * Marks edges with glow indicators for first connections
 */
export const markEdgeGlows = <T extends Edge<EdgeData>>(edges: T[]): T[] => {
  const sourceGlowSet = new Set<string>();
  const targetGlowSet = new Set<string>();

  return edges.map((edge) => {
    const sourceKey = `${edge.source}:${edge.sourceHandle}`;
    const targetKey = `${edge.target}:${edge.targetHandle}`;

    const showSourceGlow = !sourceGlowSet.has(sourceKey);
    const showTargetGlow = !targetGlowSet.has(targetKey);

    if (showSourceGlow) sourceGlowSet.add(sourceKey);
    if (showTargetGlow) targetGlowSet.add(targetKey);

    return {
      ...edge,
      data: {
        ...edge.data,
        showSourceGlow,
        showTargetGlow,
      },
    };
  });
};

/**
 * Prepares edges by normalizing handles, validating, and marking glows
 */
export const prepareEdges = (
  rawEdges: Edge[] = [],
  nodes: Node[] = [],
  validationErrorsRef?: React.MutableRefObject<ValidationError[]>
): Edge[] => {
  const nodesById = (nodes || []).reduce(
    (acc, node) => {
      acc[node.id] = node;
      return acc;
    },
    {} as Record<string, Node>
  );

  const normalizedEdges = rawEdges.map((edge) => ({
    ...edge,
    sourceHandle: normalizeHandleId(edge.source, edge.sourceHandle, 'source', nodesById),
    targetHandle: normalizeHandleId(edge.target, edge.targetHandle, 'target', nodesById),
  }));

  const validationResults = validateEdges(normalizedEdges, nodes);
  if (validationErrorsRef) {
    validationErrorsRef.current = [
      ...(validationErrorsRef.current || []),
      ...(validationResults.validationErrors || []),
    ];
  }

  const processedEdges = validationResults.validEdges.map((edge: Edge) => {
    return {
      ...edge,
      id: `e${edge.source}-${edge.sourceHandle}-${edge.target}-${edge.targetHandle}`,
      type: 'custom',
      animated: false,
      data: {
        ...(edge.data as EdgeData),
        isProcessing: false,
      },
    };
  });

  return markEdgeGlows(processedEdges);
};

// ============================================================================
// Output Persistence
// ============================================================================

/**
 * Persists output URL to local storage
 */
export async function persistOutputToLocal(
  url: string,
  outputType: string,
  nodeId: string
): Promise<string> {
  if (!url || outputType === 'text' || !url.startsWith('http')) {
    return url;
  }

  try {
    const ext =
      outputType === 'image'
        ? 'png'
        : outputType === 'video'
          ? 'mp4'
          : outputType === 'audio'
            ? 'mp3'
            : 'bin';
    const filename = `noder-${outputType}-${Date.now()}.${ext}`;

    console.log(`[Persist] Downloading ${outputType} to local storage: ${url.substring(0, 50)}...`);

    const localPath = (await invoke('download_and_save_file', {
      url: url,
      filename: filename,
      destinationFolder: null,
    })) as string;

    console.log(`[Persist] Saved to: ${localPath}`);
    return localPath;
  } catch (error) {
    console.error(`[Persist] Failed to download output for node ${nodeId}:`, error);
    return url;
  }
}

// ============================================================================
// Output Extraction
// ============================================================================

/**
 * Extracts the primary output from a node's output object
 */
export const getPrimaryOutput = (output: unknown): OutputPayload | null => {
  if (!output || typeof output !== 'object') return null;
  const outputObj = output as Record<string, unknown>;
  if (
    outputObj.out &&
    typeof outputObj.out === 'object' &&
    'value' in (outputObj.out as Record<string, unknown>)
  ) {
    return outputObj.out as OutputPayload;
  }
  const fallbackKeys = ['image-out', 'video-out', 'audio-out', 'text-out'];
  for (const key of fallbackKeys) {
    const candidate = outputObj[key];
    if (
      candidate &&
      typeof candidate === 'object' &&
      'value' in (candidate as Record<string, unknown>)
    ) {
      return candidate as OutputPayload;
    }
  }
  return null;
};

// ============================================================================
// File Type Detection
// ============================================================================

/**
 * Checks if a filename is an image file
 */
export const isImageFile = (filename: string): boolean => {
  const lower = filename.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower);
};

/**
 * Gets the output type from a node type
 */
export const getOutputTypeFromNodeType = (nodeType: string): string => {
  if (nodeType === 'upscaler' || nodeType.includes('image')) {
    return 'image';
  }
  if (nodeType.includes('video')) {
    return 'video';
  }
  if (nodeType.includes('audio')) {
    return 'audio';
  }
  return 'text';
};
