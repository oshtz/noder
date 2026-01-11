import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge
} from "reactflow";
import { FaMagic, FaRobot } from "react-icons/fa";
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { getCurrentWindow } from '@tauri-apps/api/window'; // Import getCurrentWindow
import CustomEdge from "./components/CustomEdge";
import "reactflow/dist/style.css";
import "./App.css";

import { nodeCreators, nodeDefinitions, nodeTypes as registeredNodeTypes } from "./nodes";
import { getNodeSchema } from "./nodes/nodeSchemas";
import { themes } from "./constants/themes";
import { getValidator, validateEdges } from './utils/handleValidation';
import { buildWorkflowDocument, migrateWorkflowDocument, LOCAL_WORKFLOW_KEY } from './utils/workflowSchema';
import { executeWorkflow } from './utils/workflowExecutor';
import { emit, on } from "./utils/eventBus";
import { toSafeWorkflowId } from "./utils/workflowId";
import NodeSelector from "./components/NodeSelector";
import FloatingProcessButton from "./components/FloatingProcessButton";
import ValidationErrorsPanel from './components/ValidationErrorsPanel';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import ErrorRecoveryPanel from './components/ErrorRecoveryPanel';
import { deleteFileFromReplicate } from './utils/replicateFiles';
import * as db from './utils/database';
import AssistantPanel from "./components/AssistantPanel";
import { createToolExecutor } from "./utils/assistantToolExecutor";
import { buildAssistantSystemPrompt } from "./utils/assistantPrompt";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useDatabase } from "./hooks/useDatabase";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { applyTemplate, workflowTemplates } from "./utils/workflowTemplates";
import { getLayoutedElements, LAYOUT_DIRECTION } from "./utils/layoutEngine";
import HelperLines, { getHelperLines } from "./components/HelperLines";
import EditorToolbar from "./components/EditorToolbar";
import { sortNodesForReactFlow } from "./utils/createNode";

// Create refs that will be accessible globally
window.nodesRef = React.createRef();
window.edgesRef = React.createRef();

const LEGACY_HANDLE_ALIASES = {
  'display-text': {
    source: { out: 'text-out' },
    target: { in: 'text-in' }
  },
  'text': {
    source: { 'text-out': 'out', out: 'out' },
    target: { 'text-in': 'in', in: 'in' }
  },
  'image': {
    source: { 'image-out': 'out', out: 'out' },
    target: { 'image-in': 'in', in: 'in' }
  },
  'upscaler': {
    source: { 'image-out': 'out', out: 'out' },
    target: { 'image-in': 'in', in: 'in' }
  },
  'video': {
    // Map both old generic 'out' and new specific 'video-out' to 'video-out'
    source: { out: 'video-out', 'video-out': 'video-out' },
    // Map old generic 'in' to new specific handles (prompt-in as default)
    // Keep new specific handles as-is
    target: {
      in: 'prompt-in',
      'prompt-in': 'prompt-in',
      'image-in': 'image-in',
      'video-in': 'video-in'
    }
  },
  'audio': {
    source: { 'audio-out': 'out', out: 'out' },
    target: { 'text-in': 'in', 'prompt-in': 'in', in: 'in' }
  },
  'media': {
    source: { out: 'out' },
    target: { in: 'in' }
  }
};

const ASSISTANT_ALLOWED_NODE_TYPES = [
  'text',
  'image',
  'upscaler',
  'video',
  'audio',
  'media',
  'display-text',
  'markdown'
];

const TEMPLATE_STORAGE_KEY = "noder-workflow-templates";
const WORKFLOW_HISTORY_KEY = "noder-workflow-history";
const WORKFLOW_HISTORY_LIMIT = 50;

const normalizeTemplates = (templates) => {
  if (!Array.isArray(templates)) return [];
  return templates.map((template) => {
    const safeTemplate = template && typeof template === 'object' ? template : {};
    return {
      ...safeTemplate,
      nodes: Array.isArray(safeTemplate.nodes) ? safeTemplate.nodes : [],
      edges: Array.isArray(safeTemplate.edges) ? safeTemplate.edges : []
    };
  });
};

const readWorkflowHistory = () => {
  try {
    const raw = localStorage.getItem(WORKFLOW_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[History] Failed to read workflow history:', error);
    return [];
  }
};

const writeWorkflowHistory = (entries) => {
  try {
    localStorage.setItem(WORKFLOW_HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[History] Failed to write workflow history:', error);
  }
};

const normalizeHandleId = (nodeId, handleId, direction, nodesById) => {
  if (!handleId) return handleId;
  const node = nodesById?.[nodeId];
  if (!node) return handleId;
  const aliasMap = LEGACY_HANDLE_ALIASES[node.type];
  const directionMap = aliasMap?.[direction];
  return directionMap?.[handleId] || handleId;
};

/**
 * Mark which edges should show glows at their source/target handles.
 * Only the first edge per handle gets to show the glow to avoid stacking.
 */
const markEdgeGlows = (edges) => {
  const sourceGlowSet = new Set();
  const targetGlowSet = new Set();

  return edges.map(edge => {
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
        showTargetGlow
      }
    };
  });
};

const prepareEdges = (rawEdges = [], nodes = [], validationErrorsRef) => {
  const nodesById = (nodes || []).reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});
  const normalizedEdges = rawEdges.map(edge => ({
    ...edge,
    sourceHandle: normalizeHandleId(edge.source, edge.sourceHandle, 'source', nodesById),
    targetHandle: normalizeHandleId(edge.target, edge.targetHandle, 'target', nodesById)
  }));
  const validationResults = validateEdges(normalizedEdges, nodes);
  if (validationErrorsRef) {
    validationErrorsRef.current = [
      ...(validationErrorsRef.current || []),
      ...(validationResults.validationErrors || [])
    ];
  }

  const processedEdges = validationResults.validEdges.map(edge => {
    return {
      ...edge,
      id: `e${edge.source}-${edge.sourceHandle}-${edge.target}-${edge.targetHandle}`,
      type: 'custom',
      animated: false,
      data: {
        ...edge.data,
        isProcessing: false
      }
    };
  });

  return markEdgeGlows(processedEdges);
};

/**
 * Dynamically build nodeTypes for ReactFlow from registeredNodeTypes
 * (includes both built-in and custom nodes)
 */
const nodeTypes = Object.fromEntries(
  Object.entries(registeredNodeTypes).map(([type, def]) => [type, def.component])
);

// Define edge types outside component to prevent re-renders
const edgeTypes = {
  custom: CustomEdge
};

const PREVIEW_NODE_TYPES = new Set([
  'text',
  'image',
  'upscaler',
  'video',
  'audio'
]);

const UPDATE_REPO = "oshtz/noder";
const UPDATE_DIR_NAME = "noder-updates";
const WINDOWS_UPDATE_ASSET = "noder-portable.exe";
const MAC_UPDATE_ASSET = "noder.app.zip";
const UPDATE_APP_NAME = "noder";

const isTauriRuntime = () =>
  typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

const isUpdateSupported = () => isTauriRuntime() && !import.meta.env.DEV;

const getCurrentVersion = async () => {
  if (!isTauriRuntime()) return null;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
};

const normalizeVersion = (value) => {
  if (!value) return "";
  const trimmed = value.trim().replace(/^v/i, "");
  return trimmed.split("-")[0];
};

const parseVersionParts = (value) =>
  normalizeVersion(value)
    .split(".")
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });

const compareVersions = (a, b) => {
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

const getUpdateAssetConfig = async () => {
  const os = await platform();
  if (os === "darwin") {
    return {
      name: MAC_UPDATE_ASSET,
      extension: ".app.zip",
      baseName: UPDATE_APP_NAME
    };
  }
  if (os === "windows") {
    return {
      name: WINDOWS_UPDATE_ASSET,
      extension: ".exe",
      baseName: UPDATE_APP_NAME
    };
  }

  throw new Error("Auto-update is not supported on this platform.");
};

/**
 * Download a remote URL to local storage for persistence
 * Returns the local file path if successful, or the original URL if download fails
 */
async function persistOutputToLocal(url, outputType, nodeId) {
  // Skip if not a URL (already local) or if it's text content
  if (!url || outputType === 'text' || !url.startsWith('http')) {
    return url;
  }

  try {
    // Generate a filename based on the output type and timestamp
    const ext = outputType === 'image' ? 'png'
      : outputType === 'video' ? 'mp4'
      : outputType === 'audio' ? 'mp3'
      : 'bin';
    const filename = `noder-${outputType}-${Date.now()}.${ext}`;

    console.log(`[Persist] Downloading ${outputType} to local storage: ${url.substring(0, 50)}...`);

    const localPath = await invoke('download_and_save_file', {
      url: url,
      filename: filename,
      destinationFolder: null // Use default location (Downloads/noder)
    });

    console.log(`[Persist] Saved to: ${localPath}`);
    return localPath;
  } catch (error) {
    console.error(`[Persist] Failed to download output for node ${nodeId}:`, error);
    // Return original URL as fallback - at least it works for the current session
    return url;
  }
}

const getPrimaryOutput = (output) => {
  if (!output || typeof output !== 'object') return null;
  if (output.out && typeof output.out === 'object' && 'value' in output.out) {
    return output.out;
  }
  const fallbackKeys = ['image-out', 'video-out', 'audio-out', 'text-out'];
  for (const key of fallbackKeys) {
    const candidate = output[key];
    if (candidate && typeof candidate === 'object' && 'value' in candidate) {
      return candidate;
    }
  }
  return null;
};

function App() {
  // Initialize database hook
  const database = useDatabase();

  const initialWorkflow = useMemo(() => {
    try {
      const storedDoc = localStorage.getItem(LOCAL_WORKFLOW_KEY);
      if (storedDoc) {
        return migrateWorkflowDocument(JSON.parse(storedDoc));
      }
    } catch (error) {
      console.error('Failed to parse stored workflow document:', error);
    }

    const savedNodes = localStorage.getItem("noder-nodes");
    const savedEdges = localStorage.getItem("noder-edges");
    const parsedNodes = savedNodes ? JSON.parse(savedNodes) : [];
    const parsedEdges = savedEdges ? JSON.parse(savedEdges) : [];

    return migrateWorkflowDocument({
      nodes: parsedNodes,
      edges: parsedEdges,
      metadata: { name: "Local Draft" }
    });
  }, []);

  const initialValidationErrorsRef = React.useRef([]);
  const saveCurrentWorkflowRef = useRef(null);
  const activeWorkflowRef = useRef(null);
  const hasUnsavedChangesRef = useRef(false);
  const isClosingRef = useRef(false);
  const nodeTimingsRef = useRef({});
  const executionStateRef = useRef({
    nodeOutputs: {},
    scopeNodeIds: [],
    failedNodeIds: []
  });
  // Ref to store takeSnapshot function to avoid circular dependency
  const takeSnapshotRef = useRef(null);

  // Sort nodes to ensure parent/group nodes come before children (React Flow requirement)
  const [nodes, setNodes] = useState(() => sortNodesForReactFlow(initialWorkflow.nodes || []));

  const [edges, setEdges] = useState(() => {
    try {
      return prepareEdges(initialWorkflow.edges || [], initialWorkflow.nodes || [], initialValidationErrorsRef);
    } catch (error) {
      console.error('Error loading edges:', error);
      return [];
    }
  });

  const [openaiApiKey, setOpenAIApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [replicateApiKey, setReplicateApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState('http://localhost:1234');
  const [defaultSaveLocation, setDefaultSaveLocation] = useState('Downloads/noder');
  const [showTemplates, setShowTemplates] = useState(true);
  const [showAssistantPanel, setShowAssistantPanel] = useState(true);
  const [showEditorToolbar, setShowEditorToolbar] = useState(true);
  const [runButtonUnlocked, setRunButtonUnlocked] = useState(false);
  const [runButtonPosition, setRunButtonPosition] = useState(null);
  // Default models for node types
  const [defaultTextModel, setDefaultTextModel] = useState('google/gemini-2.5-flash');
  const [defaultImageModel, setDefaultImageModel] = useState('black-forest-labs/flux-schnell');
  const [defaultVideoModel, setDefaultVideoModel] = useState('wan-video/wan-2.5-t2v-fast');
  const [defaultAudioModel, setDefaultAudioModel] = useState('google/lyria-2');
  const [defaultUpscalerModel, setDefaultUpscalerModel] = useState('recraft-ai/recraft-crisp-upscale');
  // Edge appearance setting
  const [edgeType, setEdgeType] = useState('bezier');
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("noder-theme") || "monochrome";
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState(() => initialValidationErrorsRef.current || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openWorkflows, setOpenWorkflows] = useState([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workflowMetadata, setWorkflowMetadata] = useState(() => initialWorkflow.metadata);
  const [workflowOutputs, setWorkflowOutputs] = useState(() => initialWorkflow.outputs || []);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showWelcome, setShowWelcome] = useState(() => {
    // Show welcome screen if there are no nodes and no saved workflow
    const hasNodes = initialWorkflow.nodes && initialWorkflow.nodes.length > 0;
    const hasWorkflow = localStorage.getItem(LOCAL_WORKFLOW_KEY);
    return !hasNodes && !hasWorkflow;
  });
  const [hideEmptyHint, setHideEmptyHint] = useState(false);
  const [welcomePinned, setWelcomePinned] = useState(false);
  const [workflowTemplatesState, setWorkflowTemplatesState] = useState(() => {
    try {
      const storedTemplates = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (storedTemplates) {
        return normalizeTemplates(JSON.parse(storedTemplates));
      }
    } catch (error) {
      console.error('Failed to parse stored workflow templates:', error);
    }

    return normalizeTemplates(workflowTemplates);
  });
  const [connectingNodeId, setConnectingNodeId] = useState(null);
  const [connectingHandleId, setConnectingHandleId] = useState(null);
  const [connectingHandleType, setConnectingHandleType] = useState(null);
  const [failedNodes, setFailedNodes] = useState([]);
  const [showErrorRecovery, setShowErrorRecovery] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("idle");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updatePath, setUpdatePath] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [lastUpdateCheck, setLastUpdateCheck] = useState(null);

  // Load outputs from database when initialized
  useEffect(() => {
    const loadFromDatabase = async () => {
      console.log('[App] Loading outputs from database...');
      try {
        const outputs = await db.getOutputs({ limit: 100 });
        console.log('[App] Loaded outputs from database:', outputs?.length || 0, 'items');
        if (outputs && outputs.length > 0) {
          console.log('[App] First output:', outputs[0]);
          setWorkflowOutputs(outputs);
        }
      } catch (err) {
        console.error('[App] Failed to load outputs from database:', err);
      }
    };

    // Load immediately on mount - database will auto-initialize
    loadFromDatabase();
  }, []);

  // Load settings from Tauri on mount
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const settings = await invoke('load_settings');
        if (settings.openai_api_key) setOpenAIApiKey(settings.openai_api_key);
        if (settings.openrouter_api_key) setOpenRouterApiKey(settings.openrouter_api_key);
        if (settings.anthropic_api_key) setAnthropicApiKey(settings.anthropic_api_key);
        if (settings.replicate_api_key) setReplicateApiKey(settings.replicate_api_key);
        if (settings.gemini_api_key) setGeminiApiKey(settings.gemini_api_key);
        if (settings.ollama_base_url) setOllamaBaseUrl(settings.ollama_base_url);
        if (settings.lm_studio_base_url) setLmStudioBaseUrl(settings.lm_studio_base_url);
        if (settings.default_save_location) setDefaultSaveLocation(settings.default_save_location);
        if (settings.show_templates !== undefined) setShowTemplates(settings.show_templates);
        if (settings.show_assistant_panel !== undefined) setShowAssistantPanel(settings.show_assistant_panel);
        if (settings.run_button_unlocked !== undefined) setRunButtonUnlocked(settings.run_button_unlocked);
        if (settings.run_button_position !== undefined) setRunButtonPosition(settings.run_button_position);
        // Load default models
        if (settings.default_text_model) setDefaultTextModel(settings.default_text_model);
        if (settings.default_image_model) setDefaultImageModel(settings.default_image_model);
        if (settings.default_video_model) setDefaultVideoModel(settings.default_video_model);
        if (settings.default_audio_model) setDefaultAudioModel(settings.default_audio_model);
        if (settings.default_upscaler_model) setDefaultUpscalerModel(settings.default_upscaler_model);
        // Edge appearance
        if (settings.edge_type) setEdgeType(settings.edge_type);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadAppSettings();
  }, []);

  // Save settings to Tauri when they change
  useEffect(() => {
    const saveAppSettings = async () => {
      try {
        await invoke('save_settings', {
          settings: {
            openai_api_key: openaiApiKey || null,
            openrouter_api_key: openRouterApiKey || null,
            anthropic_api_key: anthropicApiKey || null,
            replicate_api_key: replicateApiKey || null,
            gemini_api_key: geminiApiKey || null,
            ollama_base_url: ollamaBaseUrl || 'http://localhost:11434',
            lm_studio_base_url: lmStudioBaseUrl || 'http://localhost:1234',
            default_save_location: defaultSaveLocation || 'Downloads/noder',
            show_templates: showTemplates,
            show_assistant_panel: showAssistantPanel,
            run_button_unlocked: runButtonUnlocked,
            run_button_position: runButtonPosition,
            // Default models
            default_text_model: defaultTextModel || null,
            default_image_model: defaultImageModel || null,
            default_video_model: defaultVideoModel || null,
            default_audio_model: defaultAudioModel || null,
            default_upscaler_model: defaultUpscalerModel || null,
            // Edge appearance
            edge_type: edgeType || 'bezier'
          }
        });
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    };

    // Debounce the save operation to avoid excessive writes
    const timeoutId = setTimeout(saveAppSettings, 500);
    return () => clearTimeout(timeoutId);
  }, [
    openaiApiKey,
    openRouterApiKey,
    anthropicApiKey,
    replicateApiKey,
    geminiApiKey,
    ollamaBaseUrl,
    lmStudioBaseUrl,
    defaultSaveLocation,
    showTemplates,
    showAssistantPanel,
    runButtonUnlocked,
    runButtonPosition,
    defaultTextModel,
    defaultImageModel,
    defaultVideoModel,
    defaultAudioModel,
    defaultUpscalerModel,
    edgeType
  ]);

  // Update all edges when edgeType setting changes
  useEffect(() => {
    setEdges(eds => eds.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        edgeType
      }
    })));
  }, [edgeType]);

  const updateSupported = useMemo(() => isUpdateSupported(), []);

  const loadCurrentVersion = useCallback(async () => {
    if (!updateSupported) return;
    try {
      const version = await getCurrentVersion();
      if (version) {
        setCurrentVersion(version);
      }
    } catch (error) {
      console.error("Failed to load app version:", error);
    }
  }, [updateSupported]);

  const checkForUpdate = useCallback(async () => {
    if (!updateSupported) return null;
    setUpdateStatus("checking");
    setUpdateError(null);

    try {
      let version = currentVersion;
      if (!version) {
        version = await getCurrentVersion();
        if (version) setCurrentVersion(version);
      }
      if (!version) {
        throw new Error("Current version not available.");
      }

      const release = await invoke("fetch_github_release", {
        repo: UPDATE_REPO
      });
      const latestVersion = normalizeVersion(release?.tag_name || "");
      setLastUpdateCheck(Date.now());

      if (!latestVersion || compareVersions(latestVersion, version) <= 0) {
        setUpdateInfo(null);
        setUpdatePath(null);
        setUpdateStatus("up-to-date");
        return null;
      }

      const assetConfig = await getUpdateAssetConfig();
      const assets = Array.isArray(release?.assets) ? release.assets : [];
      const asset =
        assets.find((entry) => entry?.name === assetConfig.name) ??
        assets.find((entry) =>
          entry?.browser_download_url
            ?.toLowerCase()
            .endsWith(assetConfig.extension)
        );

      if (!asset?.browser_download_url) {
        throw new Error("No compatible update asset found for this platform.");
      }

      const info = {
        version: latestVersion,
        notes: release?.body ?? null,
        publishedAt: release?.published_at ?? null,
        downloadUrl: asset.browser_download_url
      };

      setUpdateInfo(info);
      setUpdatePath(null);
      setUpdateStatus("available");
      return info;
    } catch (error) {
      console.error("Update check failed:", error);
      setUpdateError(error?.message || "Update check failed.");
      setUpdateStatus("error");
      setLastUpdateCheck(Date.now());
      return null;
    }
  }, [currentVersion, updateSupported]);

  const downloadUpdate = useCallback(
    async (infoOverride) => {
      if (!updateSupported) return null;
      const info = infoOverride || updateInfo;
      if (!info?.downloadUrl) {
        setUpdateError("No update available to download.");
        setUpdateStatus("error");
        return null;
      }

      setUpdateStatus("downloading");
      setUpdateError(null);

      try {
        const { extension, baseName } = await getUpdateAssetConfig();
        const safeVersion = (info.version || "unknown").replace(
          /[^0-9A-Za-z.-]/g,
          "_"
        );
        const fileName = `${baseName}-${safeVersion}${extension}`;

        const downloadedPath = await invoke("download_update", {
          url: info.downloadUrl,
          fileName,
          dirName: UPDATE_DIR_NAME
        });

        const os = await platform();
        const finalPath =
          os === "darwin"
            ? await invoke("extract_app_zip", { zipPath: downloadedPath })
            : downloadedPath;

        setUpdatePath(finalPath);
        setUpdateInfo(info);
        setUpdateStatus("ready");
        return finalPath;
      } catch (error) {
        console.error("Update download failed:", error);
        setUpdateError(error?.message || "Update download failed.");
        setUpdateStatus("error");
        return null;
      }
    },
    [updateInfo, updateSupported]
  );

  const installUpdate = useCallback(async () => {
    if (!updateSupported) return;
    if (!updatePath) {
      setUpdateError("No update is ready to install.");
      setUpdateStatus("error");
      return;
    }

    setUpdateStatus("installing");
    setUpdateError(null);

    try {
      await invoke("apply_update", { updatePath });
    } catch (error) {
      console.error("Update install failed:", error);
      setUpdateError(error?.message || "Update install failed.");
      setUpdateStatus("error");
    }
  }, [updatePath, updateSupported]);

  useEffect(() => {
    loadCurrentVersion();
  }, [loadCurrentVersion]);

  const autoUpdateCheckRef = useRef(false);
  const autoUpdatePromptRef = useRef(false);

  useEffect(() => {
    if (!updateSupported || autoUpdateCheckRef.current) {
      return;
    }

    autoUpdateCheckRef.current = true;
    let cancelled = false;

    const runAutoUpdate = async () => {
      await loadCurrentVersion();
      const info = await checkForUpdate();
      if (cancelled || !info) return;

      const path = await downloadUpdate(info);
      if (cancelled || !path || autoUpdatePromptRef.current) return;

      autoUpdatePromptRef.current = true;
      const shouldInstall = window.confirm(
        `Update ${info.version} is ready. Restart to apply it now?`
      );
      if (shouldInstall) {
        await installUpdate();
      }
    };

    runAutoUpdate();

    return () => {
      cancelled = true;
    };
  }, [checkForUpdate, downloadUpdate, installUpdate, loadCurrentVersion, updateSupported]);

  useEffect(() => {
    let needsHydration = false;
    const hydratedNodes = nodes.map((node, index) => {
      const hasOnRemove = typeof node.data?.onRemove === 'function';
      const hasExecution = node.data?.executionOrder !== undefined && node.data.executionOrder !== null;

      if (hasOnRemove && hasExecution) {
        return node;
      }

      needsHydration = true;
      return {
        ...node,
        data: {
          ...node.data,
          executionOrder: node.data?.executionOrder ?? index + 1,
          onRemove: (nodeId) => {
            setNodes((curr) => curr.filter((n) => n.id !== nodeId));
            setEdges((eds) => markEdgeGlows(eds.filter((e) => e.source !== nodeId && e.target !== nodeId)));
          }
        }
      };
    });

    if (needsHydration) {
      setNodes(hydratedNodes);
    }
  }, [nodes]);

  // Add useEffect for titlebar controls
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const minimizeButton = document.getElementById('titlebar-minimize');
    const maximizeButton = document.getElementById('titlebar-maximize');
    const closeButton = document.getElementById('titlebar-close');

    const minimizeHandler = () => appWindow.minimize();
    const maximizeHandler = () => appWindow.toggleMaximize();
    const closeHandler = () => appWindow.close();

    minimizeButton?.addEventListener('click', minimizeHandler);
    maximizeButton?.addEventListener('click', maximizeHandler);
    closeButton?.addEventListener('click', closeHandler);

    // Cleanup function to remove event listeners
    return () => {
      minimizeButton?.removeEventListener('click', minimizeHandler);
      maximizeButton?.removeEventListener('click', maximizeHandler);
      closeButton?.removeEventListener('click', closeHandler);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const moveNodeOrder = useCallback((nodeId, direction) => {
    setNodes((nds) => {
      // Sort nodes by execution order first
      const sortedNodes = [...nds].sort((a, b) => (a.data.executionOrder || 0) - (b.data.executionOrder || 0));
      
      // Find the index of the node we want to move
      const nodeIndex = sortedNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return nds;

      // Move the node up or down in the array
      let newIndex = nodeIndex;
      if (direction === 'up' && nodeIndex > 0) {
        newIndex = nodeIndex - 1;
      } else if (direction === 'down' && nodeIndex < sortedNodes.length - 1) {
        newIndex = nodeIndex + 1;
      }
      if (newIndex !== nodeIndex) {
        // Swap nodes in the array
        const temp = sortedNodes[nodeIndex];
        sortedNodes[nodeIndex] = sortedNodes[newIndex];
        sortedNodes[newIndex] = temp;
      }

      // Reassign executionOrder to be sequential and unique
      const reindexed = sortedNodes.map((node, idx) => ({
        ...node,
        data: {
          ...node.data,
          executionOrder: idx + 1
        }
      }));

      return reindexed;
    });
  }, []);

  const handleDismissError = (index) => {
    if (typeof index === 'number') {
      setValidationErrors(prev => prev.filter((_, i) => i !== index));
    } else {
      setValidationErrors([]);
    }
  };

  const handleClearAllErrors = () => {
    setValidationErrors([]);
  };

  useEffect(() => {
    localStorage.setItem("noder-theme", currentTheme);
  }, [currentTheme]);

  // Apply theme
  useEffect(() => {
    const theme = themes[currentTheme];
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    } else {
      // Fallback to a default theme if the current theme doesn't exist
      const defaultTheme = themes['dark'] || Object.values(themes)[0];
      if (defaultTheme) {
        Object.entries(defaultTheme).forEach(([key, value]) => {
          document.documentElement.style.setProperty(key, value);
        });
      }
    }
  }, [currentTheme]);

  // Save nodes and edges to localStorage whenever they change
  useEffect(() => {
    if (nodes.length > 0) {
      // Sanitize nodes before saving - remove large data like base64 images
      const sanitizedNodes = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          // Exclude convertedSrc (base64 data) from being saved to localStorage
          convertedSrc: undefined
        }
      }));
      
      try {
        localStorage.setItem("noder-nodes", JSON.stringify(sanitizedNodes));
      } catch (error) {
        console.error('Failed to save nodes to localStorage:', error);
        // If still too large, try to save without any output data
        try {
          const minimalNodes = nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              convertedSrc: undefined,
              output: undefined
            }
          }));
          localStorage.setItem("noder-nodes", JSON.stringify(minimalNodes));
        } catch (e) {
          console.error('Failed to save even minimal nodes:', e);
        }
      }
    }
  }, [nodes]);

  useEffect(() => {
    if (edges.length > 0) {
      // Ensure we save the full edge data including style and color info
      localStorage.setItem("noder-edges", JSON.stringify(edges.map(edge => ({
        ...edge,
        // Preserve style and data explicitly to ensure they're saved
        style: edge.style || {},
        data: {
          ...edge.data,
          handleColor: edge.style?.stroke || edge.data?.handleColor || '#555'
        }
      }))));
    }
  }, [edges]);

  // Persist a versioned workflow document alongside legacy keys
  useEffect(() => {
    const workflowName = activeWorkflow?.name || workflowMetadata?.name || "Local Draft";
    
    // Sanitize nodes before saving
    const sanitizedNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        convertedSrc: undefined // Exclude base64 data
      }
    }));
    
    const document = buildWorkflowDocument({
      id: activeWorkflow?.id || workflowMetadata?.id,
      name: workflowName,
      nodes: sanitizedNodes,
      edges,
      metadata: workflowMetadata
    });

    try {
      localStorage.setItem(LOCAL_WORKFLOW_KEY, JSON.stringify(document));
    } catch (error) {
      console.error('Failed to persist local workflow document:', error);
    }
  }, [nodes, edges, workflowMetadata, activeWorkflow]);

  // Update refs whenever nodes/edges change
  useEffect(() => {
    window.nodesRef.current = nodes;
    window.edgesRef.current = edges;
  }, [nodes, edges]);

  // Update nodes and edges in window object for node components to access
  useEffect(() => {
    window.nodes = nodes;
    window.edges = edges;
  }, [nodes, edges]);

  useEffect(() => {
    if (showWelcome && nodes.length > 0 && !welcomePinned) {
      setShowWelcome(false);
    }
  }, [nodes.length, showWelcome, welcomePinned]);

  const handleRemoveNode = useCallback(async (nodeId) => {
    // Find the node being removed (for cleanup purposes outside setNodes)
    const nodeToRemove = nodes.find(n => n.id === nodeId);
    
    // Cleanup Replicate file if it's a media node with an uploaded file
    if (nodeToRemove && nodeToRemove.type === 'media' && nodeToRemove.data.replicateFileId) {
      try {
        console.log(`[App] Cleaning up Replicate file for removed node ${nodeId}`);
        await deleteFileFromReplicate(nodeToRemove.data.replicateFileId);
      } catch (error) {
        console.warn(`[App] Failed to cleanup file for node ${nodeId}:`, error);
      }
    }
    
  setNodes((nds) => {
    // Find the node being removed from current state (not stale closure)
    const removingNode = nds.find(n => n.id === nodeId);
    const isGroupNode = removingNode?.type === 'group';
    
    return nds
      .filter((node) => node.id !== nodeId)
      .map((node) => {
        // If this node was a child of the removed group, remove the parent reference
        if (isGroupNode && (node.parentNode === nodeId || node.parentId === nodeId)) {
          const { parentNode, parentId, extent, ...cleanNode } = node;
          // Restore absolute position (child positions are relative to parent)
          return {
            ...cleanNode,
            position: {
              x: node.position.x + (removingNode?.position?.x || 0),
              y: node.position.y + (removingNode?.position?.y || 0) - 40 // Account for header
            }
          };
        }
        return node;
      });
  });
  setEdges((eds) => markEdgeGlows(eds.filter((edge) =>
    edge.source !== nodeId && edge.target !== nodeId
  )));
  emit('deleteElements', { nodeId });
}, [nodes]);

  const handleAddNode = useCallback((type, position = { x: 100, y: 100 }) => {
    // Hide welcome screen when first node is added
    if (showWelcome) {
      setShowWelcome(false);
      setWelcomePinned(false);
    }
    
    const nodeId = `${type}-${Date.now()}`;
    const createNodeFn = nodeCreators[type];
    if (!createNodeFn) {
      console.error(`No creator function found for node type: ${type}`);
      return null;
    }
    
    // Get the highest execution order
    const highestOrder = nodes.reduce((max, node) =>
      Math.max(max, node.data.executionOrder || 0), 0);

    // Get the appropriate default model based on node type
    const defaultModelMap = {
      text: defaultTextModel,
      image: defaultImageModel,
      video: defaultVideoModel,
      audio: defaultAudioModel,
      upscaler: defaultUpscalerModel
    };

    const newNode = createNodeFn({
      id: nodeId,
      handleRemoveNode: handleRemoveNode,
      position: position,
      defaultModel: defaultModelMap[type],
      data: {
        executionOrder: highestOrder + 1
      }
    });
    setNodes((nds) => nds.concat(newNode));
    
    // Return the node ID so it can be used for auto-connection
    return nodeId;
  }, [handleRemoveNode, nodes, showWelcome, defaultImageModel, defaultVideoModel, defaultAudioModel, defaultUpscalerModel]);

  // Ref to store gallery drag data (bypasses issues with native drag-drop through portals)
  const galleryDragDataRef = useRef(null);

  // Create media node from gallery output at specified position
  const createMediaNodeFromGallery = useCallback((dragData, dropX, dropY) => {
    // Get the ReactFlow wrapper element
    const flowWrapper = document.querySelector('.react-flow');
    if (!flowWrapper) {
      console.error('[Gallery Drag] ReactFlow wrapper not found');
      return;
    }

    // Check if the drop position is within the ReactFlow canvas
    const bounds = flowWrapper.getBoundingClientRect();
    if (dropX < bounds.left || dropX > bounds.right ||
        dropY < bounds.top || dropY > bounds.bottom) {
      console.log('[Gallery Drag] Drop outside canvas bounds');
      return;
    }

    if (!reactFlowInstance) {
      console.error('[Gallery Drag] ReactFlow instance not available');
      return;
    }

    // Get drop position in flow coordinates
    const viewport = reactFlowInstance.getViewport();
    const x = (dropX - bounds.left - viewport.x) / viewport.zoom;
    const y = (dropY - bounds.top - viewport.y) / viewport.zoom;

    console.log('[Gallery Drag] Creating node at:', { x, y });

    // Create a media node with the gallery output
    const nodeId = handleAddNode('media', { x, y });
    console.log('[Gallery Drag] Created node:', nodeId);

    // Update node data with the output
    setTimeout(() => {
      setNodes(nds => nds.map(n =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                mediaPath: dragData.value,
                mediaType: dragData.type,
                ...(dragData.prompt ? { prompt: dragData.prompt } : {}),
                ...(dragData.model ? { model: dragData.model } : {})
              }
            }
          : n
      ));
      console.log('[Gallery Drag] Node data updated');
    }, 50);
  }, [reactFlowInstance, handleAddNode, setNodes]);

  // Handle gallery drag start - store the data and set up mouse tracking
  const handleGalleryDragStart = useCallback((dragData, startX, startY) => {
    console.log('[Gallery Drag] Start - storing data:', dragData, 'at:', startX, startY);
    galleryDragDataRef.current = {
      data: dragData,
      startX,
      startY
    };

    // Use mouseup on document to detect where the user releases
    const handleMouseUp = (e) => {
      const stored = galleryDragDataRef.current;
      galleryDragDataRef.current = null;
      document.removeEventListener('mouseup', handleMouseUp);

      if (!stored) return;

      const distance = Math.sqrt(
        Math.pow(e.clientX - stored.startX, 2) + Math.pow(e.clientY - stored.startY, 2)
      );

      console.log('[Gallery Drag] MouseUp at:', e.clientX, e.clientY, 'distance:', distance);

      // Require some movement to distinguish from clicks
      if (distance < 30) {
        console.log('[Gallery Drag] Not enough movement, ignoring');
        return;
      }

      createMediaNodeFromGallery(stored.data, e.clientX, e.clientY);
    };

    // Small delay to avoid capturing the initial mousedown as mouseup
    setTimeout(() => {
      document.addEventListener('mouseup', handleMouseUp, { once: true });
    }, 50);
  }, [createMediaNodeFromGallery]);

  // Handle gallery drag end - no longer needed for main logic, but keep for cleanup
  const handleGalleryDragEnd = useCallback((clientX, clientY) => {
    console.log('[Gallery Drag] DragEnd event at:', clientX, clientY);
    // The mouseup handler handles the actual drop logic
  }, []);

  // Global drop handler for gallery items (fallback for native drag-drop)
  useEffect(() => {
    const handleGlobalDragOver = (e) => {
      // Check if this is a gallery drag by looking at the data
      if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleGlobalDrop = async (e) => {
      // Try to parse gallery data
      let jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) {
        jsonData = e.dataTransfer.getData('text/plain');
      }

      if (!jsonData) return;

      try {
        const dragData = JSON.parse(jsonData);
        if (dragData.type !== 'gallery-output' || !dragData.output) return;

        e.preventDefault();
        e.stopPropagation();

        console.log('[Global Drop] Gallery output detected:', dragData.output);
        const { output } = dragData;

        if (!reactFlowInstance) {
          console.error('[Global Drop] ReactFlow instance not available');
          return;
        }

        // Get the ReactFlow wrapper element
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) {
          console.error('[Global Drop] ReactFlow wrapper not found');
          return;
        }

        // Get drop position in flow coordinates
        const bounds = flowWrapper.getBoundingClientRect();
        const viewport = reactFlowInstance.getViewport();
        const x = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
        const y = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

        console.log('[Global Drop] Drop position:', { x, y });

        // Create a media node with the gallery output
        const nodeId = handleAddNode('media', { x, y });
        console.log('[Global Drop] Created node:', nodeId);

        // Update node data with the output
        setTimeout(() => {
          setNodes(nds => nds.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    mediaPath: output.value,
                    mediaType: output.type,
                    ...(output.prompt ? { prompt: output.prompt } : {}),
                    ...(output.model ? { model: output.model } : {})
                  }
                }
              : n
          ));
          console.log('[Global Drop] Node data updated');
        }, 50);
      } catch (err) {
        // Not gallery JSON data, ignore
      }
    };

    // Add to document to catch drops anywhere (popover uses portal so needs document-level)
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [reactFlowInstance, handleAddNode, setNodes]);

  useEffect(() => {
    if (nodes.length > 0 && hideEmptyHint) {
      setHideEmptyHint(false);
    }
  }, [nodes.length, hideEmptyHint]);

  const handleNodesChange = useCallback((changes) => {
    // Check for changes that should trigger undo snapshot
    const hasStructuralChange = changes.some(c => 
      c.type === 'add' || c.type === 'remove'
    );
    
    setNodes((nds) => {
      // First apply the changes
      let updatedNodes = applyNodeChanges(changes, nds);
      
      // Check if any group nodes were removed
      const removedGroupIds = changes
        .filter(c => c.type === 'remove')
        .map(c => c.id)
        .filter(id => {
          const node = nds.find(n => n.id === id);
          return node?.type === 'group';
        });
      
      // If groups were removed, clean up orphaned parentNode references
      if (removedGroupIds.length > 0) {
        updatedNodes = updatedNodes.map(node => {
          const parentId = node.parentNode || node.parentId;
          if (parentId && removedGroupIds.includes(parentId)) {
            // Find the removed group to get its position for coordinate restoration
            const removedGroup = nds.find(n => n.id === parentId);
            const { parentNode, parentId: pId, extent, ...cleanNode } = node;
            return {
              ...cleanNode,
              position: {
                x: node.position.x + (removedGroup?.position?.x || 0),
                y: node.position.y + (removedGroup?.position?.y || 0) - 40
              }
            };
          }
          return node;
        });
      }
      
      return updatedNodes;
    });
    
    // Track selection changes and dimension changes
    changes.forEach(change => {
      if (change.type === 'select') {
        if (change.selected) {
          setSelectedNodeId(change.id);
        } else if (selectedNodeId === change.id) {
          setSelectedNodeId(null);
        }
      }
      
      // Update edge data when node dimensions change
      if (change.type === 'dimensions' && change.dimensions) {
        setEdges((eds) => eds.map(edge => {
          const needsUpdate = edge.source === change.id || edge.target === change.id;
          if (!needsUpdate) return edge;
          
          // Get updated node dimensions
          const updatedNodes = applyNodeChanges(changes, nodes);
          const sourceNode = updatedNodes.find(n => n.id === edge.source);
          const targetNode = updatedNodes.find(n => n.id === edge.target);
          
          return {
            ...edge,
            data: {
              ...edge.data,
              sourceNodeWidth: sourceNode?.width || sourceNode?.style?.width || 200,
              sourceNodeHeight: sourceNode?.height || sourceNode?.style?.height || 200,
              targetNodeWidth: targetNode?.width || targetNode?.style?.width || 200,
              targetNodeHeight: targetNode?.height || targetNode?.style?.height || 200,
            }
          };
        }));
      }
    });
    
    // Take snapshot for undo on structural changes
    if (hasStructuralChange) {
      takeSnapshotRef.current?.(true);
    }
  }, [selectedNodeId, nodes]);

  const handleEdgesChange = useCallback((changes) => {
    // Detect edge removals and dispatch deleteEdge events
    const hasRemovals = changes.some(change => change.type === 'remove');
    const hasAdditions = changes.some(change => change.type === 'add');
    
    changes.forEach(change => {
      if (change.type === 'remove') {
        emit('deleteEdge', { edgeId: change.id });
      }
    });

    // Take snapshot for undo on structural changes
    if (hasRemovals || hasAdditions) {
      takeSnapshotRef.current?.(true);
    }

    setEdges((eds) => {
      const updatedEdges = applyEdgeChanges(changes, eds);
      // Recompute glow flags when edges are removed to avoid stale flags
      return hasRemovals ? markEdgeGlows(updatedEdges) : updatedEdges;
    });
    emit('edgesChange', { changes });
    if (hasRemovals) {
      emit('deleteElements', { changes });
    }
  }, []);

  // Handle connection start - capture the connection information
  const onConnectStart = useCallback((event, { nodeId, handleId, handleType }) => {
    console.log('[onConnectStart] Starting connection from:', { nodeId, handleId, handleType });
    
    // Get the actual data type from the handle definition
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (sourceNode) {
      console.log('[onConnectStart] Source node:', sourceNode);
      console.log('[onConnectStart] Source node data.handles:', sourceNode.data?.handles);
      
      // Try to get from node data first
      let handles = sourceNode.data?.handles || [];
      let handle = handles.find(h => h.id === handleId);
      
      // If not found or no dataType, try to get from node definition's defaultData
      if (!handle || !handle.dataType) {
        const nodeDef = registeredNodeTypes[sourceNode.type];
        console.log('[onConnectStart] Node definition:', nodeDef);
        handles = nodeDef?.defaultData?.handles || [];
        handle = handles.find(h => h.id === handleId);
      }
      
      const dataType = handle?.dataType;
      console.log('[onConnectStart] Found handle:', handle);
      console.log('[onConnectStart] Handle data type:', dataType);
      
      setConnectingNodeId(nodeId);
      setConnectingHandleId(handleId);
      setConnectingHandleType(dataType || handleType); // Use dataType if available
    } else {
      setConnectingNodeId(nodeId);
      setConnectingHandleId(handleId);
      setConnectingHandleType(handleType);
    }
  }, [nodes]);

  // Handle connection end - when user drops a connection on empty space
  const onConnectEnd = useCallback((event) => {
    console.log('[onConnectEnd] Event:', event);
    console.log('[onConnectEnd] Connecting from:', { connectingNodeId, connectingHandleId, connectingHandleType });
    
    // Only proceed if we have connection information from onConnectStart
    if (!connectingNodeId || !connectingHandleId) {
      console.log('[onConnectEnd] No connection information available');
      setConnectingNodeId(null);
      setConnectingHandleId(null);
      setConnectingHandleType(null);
      return;
    }
    
    // Check if the connection ended on the pane (empty space) or other valid targets
    const targetIsPane = event.target.classList.contains('react-flow__pane');
    const targetIsRenderer = event.target.classList.contains('react-flow__renderer');
    const targetIsEdgeLayer = event.target.classList.contains('react-flow__edges');
    
    console.log('[onConnectEnd] Target classes:', event.target.className);
    console.log('[onConnectEnd] Is pane/renderer/edges:', targetIsPane, targetIsRenderer, targetIsEdgeLayer);
    
    if (!targetIsPane && !targetIsRenderer && !targetIsEdgeLayer) {
      console.log('[onConnectEnd] Not dropped on empty space');
      setConnectingNodeId(null);
      setConnectingHandleId(null);
      setConnectingHandleType(null);
      return;
    }
    
    // Get the source node
    const sourceNode = nodes.find(n => n.id === connectingNodeId);
    if (!sourceNode) {
      console.log('[onConnectEnd] Source node not found');
      setConnectingNodeId(null);
      setConnectingHandleId(null);
      setConnectingHandleType(null);
      return;
    }
    
    console.log('[onConnectEnd] Source node:', sourceNode.id);
    console.log('[onConnectEnd] Source handle:', connectingHandleId);
    console.log('[onConnectEnd] Handle type:', connectingHandleType);
    
    // Get screen position where the connection was dropped
    const screenX = event.clientX;
    const screenY = event.clientY;
    
    // Get the ReactFlow wrapper bounds to calculate relative position
    const flowWrapper = document.querySelector('.react-flow__renderer');
    const bounds = flowWrapper?.getBoundingClientRect();
    
    if (bounds) {
      const relativeX = screenX - bounds.left;
      const relativeY = screenY - bounds.top;
      
      console.log('[onConnectEnd] Opening NodeSelector at:', { screenX, screenY, relativeX, relativeY });
      
      // Dispatch event to open NodeSelector with connection context
      emit("openNodeSelector", {
        position: { x: screenX, y: screenY },
        clickPosition: { x: relativeX, y: relativeY },
        connectionContext: {
          sourceNode: sourceNode.id,
          sourceHandle: connectingHandleId,
          handleType: connectingHandleType
        }
      });
    }
    
    // Clear connection state
    setConnectingNodeId(null);
    setConnectingHandleId(null);
    setConnectingHandleType(null);
  }, [nodes, connectingNodeId, connectingHandleId, connectingHandleType]);

  const onConnect = useCallback((params) => {
    // Create new edge with unified styling
    const newEdge = {
      ...params,
      id: `e${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}`,
      type: 'custom',
      animated: false,
      data: {
        isProcessing: false,
        edgeType
      }
    };

    // Validate the new edge
    const validationResults = validateEdges([newEdge], nodes);
    if (validationResults.validationErrors.length > 0) {
      setValidationErrors(prev => [...prev, ...validationResults.validationErrors]);
      return;
    }

    // Add the edge, allowing multiple connections to the same input handle
    setEdges(eds => {
      // Add the new edge without filtering existing connections
      const updatedEdges = addEdge(newEdge, eds);
      // Recompute glow flags to avoid stacking
      return markEdgeGlows(updatedEdges);
    });

    // Dispatch a custom event for the new connection
    emit("nodeConnection", {
      source: params.source,
      target: params.target,
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle
    });
    emit("connect", { params });
  }, [nodes, edgeType]);

  // Add edge deletion handler and auto-connect handler
  React.useEffect(() => {
    const handleDeleteEdge = (event) => {
      const { edgeId } = event.detail;
      setEdges(edges => markEdgeGlows(edges.filter(edge => edge.id !== edgeId)));
    };

    const handleMoveNodeOrder = (event) => {
      const { nodeId, direction } = event.detail;
      moveNodeOrder(nodeId, direction);
    };

    const handleNodeProcessingComplete = (event) => {
      const { nodeId } = event.detail;
      setNodes(nds => nds.map(n => ({
        ...n,
        className: n.id === nodeId
          ? (n.className || 'react-flow__node-resizable').replace(' processing', '')
          : n.className
      })));
    };

    const handleNodeDataUpdated = (event) => {
      const { nodeId, updates } = event.detail;
      console.log('[App] Node data updated:', { nodeId, updates });
      setNodes(nds => nds.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...updates } }
          : n
      ));
    };

    const handleAutoConnect = (event) => {
      const { source, sourceHandle, target, handleType } = event.detail;
      
      console.log('[handleAutoConnect] Attempting auto-connect:', { source, sourceHandle, target, handleType });
      
      // Find appropriate target handle based on handle type
      const targetNode = nodes.find(n => n.id === target);
      if (!targetNode) {
        console.log('[handleAutoConnect] Target node not found:', target);
        return;
      }
      
      console.log('[handleAutoConnect] Target node found:', targetNode);
      
      // Get the node definition to find compatible input handles
      const targetNodeDef = registeredNodeTypes[targetNode.type];
      if (!targetNodeDef) {
        console.log('[handleAutoConnect] Node definition not found for type:', targetNode.type);
        return;
      }
      
      // Get handles from the node's data or the definition
      const handles = targetNode.data?.handles || targetNodeDef.handles || [];
      console.log('[handleAutoConnect] Available handles:', handles);
      
      // Find the first compatible input handle
      const compatibleHandle = handles.find(h => {
        const isInput = h.type === 'input' || h.type === 'target';
        const isCompatible = h.dataType === handleType;
        console.log('[handleAutoConnect] Checking handle:', h.id, { isInput, isCompatible, handleDataType: h.dataType, requiredType: handleType });
        return isInput && isCompatible;
      });
      
      if (compatibleHandle) {
        console.log('[handleAutoConnect] Compatible handle found:', compatibleHandle.id);
        // Create the connection
        onConnect({
          source: source,
          sourceHandle: sourceHandle,
          target: target,
          targetHandle: compatibleHandle.id
        });
      } else {
        console.log('[handleAutoConnect] No compatible handle found');
      }
    };

    const offDeleteEdge = on('deleteEdge', handleDeleteEdge);
    const offMoveNodeOrder = on('moveNodeOrder', handleMoveNodeOrder);
    const offNodeProcessingComplete = on('nodeProcessingComplete', handleNodeProcessingComplete);
    const offAutoConnect = on('autoConnect', handleAutoConnect);
    const offNodeDataUpdated = on('nodeDataUpdated', handleNodeDataUpdated);
    
    return () => {
      offDeleteEdge();
      offMoveNodeOrder();
      offNodeProcessingComplete();
      offAutoConnect();
      offNodeDataUpdated();
    };
  }, [moveNodeOrder, nodes, onConnect]);

  // Helper to detect image files
  const isImageFile = useCallback((filename) => {
    const lower = filename.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower);
  }, []);

  // Handle node drag start - take snapshot for undo
  const handleNodeDragStart = useCallback((event, node) => {
    takeSnapshotRef.current?.(true);
  }, []);

  // Handle node drag - show helper lines for alignment
  const handleNodeDrag = useCallback((event, node) => {
    const { horizontal, vertical, snapPosition } = getHelperLines(node, nodes);
    setHelperLines({ horizontal, vertical });
    
    // Apply snap position if available
    if (snapPosition) {
      setNodes(nds => nds.map(n => 
        n.id === node.id 
          ? { ...n, position: snapPosition }
          : n
      ));
    }
  }, [nodes, setNodes]);

  // Handle node drag stop - hide helper lines
  const handleNodeDragStop = useCallback((event, node) => {
    setHelperLines({ horizontal: null, vertical: null });
  }, []);

  // Handle image drop on canvas (browser drag-drop)
  const handleImageDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Drop] Drop event triggered on canvas');
    console.log('[Drop] dataTransfer types:', e.dataTransfer.types);

    // Check if it's a gallery output being dragged
    try {
      // Try both application/json and text/plain
      let jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) {
        jsonData = e.dataTransfer.getData('text/plain');
      }
      console.log('[Drop] JSON data:', jsonData?.substring(0, 200));
      
      if (jsonData) {
        const dragData = JSON.parse(jsonData);
        console.log('[Drop] Parsed drag data:', dragData);
        
        if (dragData.type === 'gallery-output' && dragData.output) {
          console.log('[Drop] Gallery output detected:', dragData.output);
          const { output } = dragData;
          
          if (!reactFlowInstance) {
            console.error('[Drop] ReactFlow instance not available');
            return;
          }
          
          // Get the ReactFlow wrapper element
          const flowWrapper = document.querySelector('.react-flow__renderer');
          if (!flowWrapper) {
            console.error('[Drop] ReactFlow wrapper not found');
            return;
          }
          
          // Get drop position in flow coordinates
          const bounds = flowWrapper.getBoundingClientRect();
          const viewport = reactFlowInstance.getViewport();
          const x = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
          const y = (e.clientY - bounds.top - viewport.y) / viewport.zoom;
          
          console.log('[Drop] Drop position:', { x, y, viewport, clientX: e.clientX, clientY: e.clientY, bounds });

          // Create a media node with the gallery output
          const nodeId = handleAddNode('media', { x, y });
          console.log('[Drop] Created node:', nodeId);

          // Update node data with the output
          setTimeout(() => {
            setNodes(nds => nds.map(n =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      mediaPath: output.value,
                      mediaType: output.type,
                      // Copy metadata if available
                      ...(output.prompt ? { prompt: output.prompt } : {}),
                      ...(output.model ? { model: output.model } : {})
                    }
                  }
                : n
            ));
            console.log('[Drop] Node data updated');
          }, 50);
          
          console.log('[Gallery Drop] Successfully created media node from gallery output:', { nodeId, output });
          return;
        } else {
          console.log('[Drop] Not a gallery output type');
        }
      } else {
        console.log('[Drop] No JSON data in dataTransfer');
      }
    } catch (err) {
      // Not JSON data, continue with file handling
      console.log('[Gallery Drop] Error parsing JSON or not a gallery item:', err);
    }

    const files = Array.from(e.dataTransfer?.files || []);
    const imageFiles = files.filter(file =>
      file.type.startsWith('image/') || isImageFile(file.name)
    );

    if (imageFiles.length === 0) return;

    // Get drop position in flow coordinates
    const bounds = e.currentTarget.getBoundingClientRect();
    const viewport = reactFlowInstance.getViewport();
    const baseX = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
    const baseY = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const base64Data = event.target.result;
          const savedPath = await invoke('save_uploaded_file', {
            filename: file.name,
            data: base64Data
          });

          // Offset each node slightly if multiple files
          const position = {
            x: baseX + (i * 50),
            y: baseY + (i * 50)
          };

          const nodeId = handleAddNode('media', position);

          // Update node data with media path
          setTimeout(() => {
            setNodes(nds => nds.map(n =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, mediaPath: savedPath, mediaType: 'image' }}
                : n
            ));
          }, 50);
        } catch (error) {
          console.error('Error saving dropped image:', error);
        }
      };

      reader.readAsDataURL(file);
    }
  }, [reactFlowInstance, handleAddNode, isImageFile, setNodes]);

  // Track mouse position on canvas for paste
  const lastMousePositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const flowWrapper = document.querySelector('.flow-wrapper');
    if (!flowWrapper) return;

    const handleMouseMove = (e) => {
      const bounds = flowWrapper.getBoundingClientRect();
      lastMousePositionRef.current = {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top
      };
    };

    flowWrapper.addEventListener('mousemove', handleMouseMove);
    return () => flowWrapper.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Handle paste for clipboard images
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const base64Data = event.target.result;
              const ext = item.type.split('/')[1] || 'png';
              const filename = `pasted-image-${Date.now()}.${ext}`;

              const savedPath = await invoke('save_uploaded_file', {
                filename,
                data: base64Data
              });

              // Create node at last mouse position on canvas
              const viewport = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
              const mousePos = lastMousePositionRef.current;
              const flowX = (mousePos.x - viewport.x) / viewport.zoom;
              const flowY = (mousePos.y - viewport.y) / viewport.zoom;

              const nodeId = handleAddNode('media', { x: flowX, y: flowY });

              setTimeout(() => {
                setNodes(nds => nds.map(n =>
                  n.id === nodeId
                    ? { ...n, data: { ...n.data, mediaPath: savedPath, mediaType: 'image' }}
                    : n
                ));
              }, 50);
            } catch (error) {
              console.error('Error saving pasted image:', error);
            }
          };

          reader.readAsDataURL(blob);
          break; // Only handle first image
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [reactFlowInstance, handleAddNode, setNodes]);

  const prepareWorkflowData = useCallback((id, name) => {
    const processedNodes = nodes.map((node, index) => ({
      ...node,
      data: {
        ...node.data,
        executionOrder: node.data.executionOrder ?? index + 1,
        convertedSrc: undefined
      }
    }));

    const processedEdges = edges.map(edge => ({
      ...edge,
      type: 'custom',
      animated: false,
      data: {
        ...edge.data,
        isProcessing: false
      }
    }));

    const viewport = reactFlowInstance ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };

    return {
      id: id || name,
      name: name || id,
      nodes: processedNodes,
      edges: processedEdges,
      viewport,
      metadata: {
        ...workflowMetadata,
        name: name || id || workflowMetadata?.name
      }
    };
  }, [edges, nodes, reactFlowInstance, workflowMetadata]);

  const getExecutionScope = useCallback((targetNodeIds) => {
    if (!Array.isArray(targetNodeIds) || targetNodeIds.length === 0) {
      return { nodes: nodes, edges: edges };
    }

    const incoming = new Map();
    edges.forEach(edge => {
      if (!incoming.has(edge.target)) {
        incoming.set(edge.target, []);
      }
      incoming.get(edge.target).push(edge.source);
    });

    const neededIds = new Set();
    const stack = [...targetNodeIds];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (neededIds.has(currentId)) continue;
      neededIds.add(currentId);
      const parents = incoming.get(currentId) || [];
      parents.forEach(parentId => {
        if (!neededIds.has(parentId)) {
          stack.push(parentId);
        }
      });
    }

    return {
      nodes: nodes.filter(node => neededIds.has(node.id)),
      edges: edges.filter(edge => neededIds.has(edge.source) && neededIds.has(edge.target))
    };
  }, [edges, nodes]);

  const appendWorkflowHistory = useCallback((entry) => {
    const history = readWorkflowHistory();
    const next = [entry, ...history].slice(0, WORKFLOW_HISTORY_LIMIT);
    writeWorkflowHistory(next);
  }, []);

  const runWorkflow = async (options = {}) => {
    // Prevent multiple workflow executions
    if (isProcessing) {
      console.log('[Workflow] Workflow is already running');
      return;
    }

    const {
      targetNodeIds = null,
      trigger = 'manual',
      resume = false,
      retryNodeIds = null,
      retryFailed = false,
      skipFailed = false,
      continueOnError = false
    } = options;

    if (!resume) {
      executionStateRef.current = {
        nodeOutputs: {},
        scopeNodeIds: [],
        failedNodeIds: []
      };
    }

    const hasResumeState = resume && executionStateRef.current?.nodeOutputs;
    const resumeScopeIds = hasResumeState && Array.isArray(executionStateRef.current.scopeNodeIds)
      && executionStateRef.current.scopeNodeIds.length > 0
      ? new Set(executionStateRef.current.scopeNodeIds)
      : null;

    const scopeFromTarget = resumeScopeIds ? null : getExecutionScope(targetNodeIds);
    const scopedNodes = resumeScopeIds
      ? nodes.filter(node => resumeScopeIds.has(node.id))
      : scopeFromTarget.nodes;
    const scopedEdges = resumeScopeIds
      ? edges.filter(edge => resumeScopeIds.has(edge.source) && resumeScopeIds.has(edge.target))
      : scopeFromTarget.edges;

    const scopedNodeIdSet = new Set(scopedNodes.map(node => node.id));
    const initialNodeOutputs = {};
    if (hasResumeState) {
      Object.entries(executionStateRef.current.nodeOutputs || {}).forEach(([nodeId, output]) => {
        if (scopedNodeIdSet.has(nodeId)) {
          initialNodeOutputs[nodeId] = output;
        }
      });
    }

    const failedNodeIdSet = new Set(
      hasResumeState && Array.isArray(executionStateRef.current.failedNodeIds)
        ? executionStateRef.current.failedNodeIds
        : []
    );

    failedNodeIdSet.forEach(nodeId => {
      delete initialNodeOutputs[nodeId];
    });

    const getDownstreamNodeIds = (startIds, scopeEdges) => {
      const adjacency = new Map();
      scopeEdges.forEach(edge => {
        if (!adjacency.has(edge.source)) {
          adjacency.set(edge.source, []);
        }
        adjacency.get(edge.source).push(edge.target);
      });

      const visited = new Set();
      const stack = Array.from(startIds);
      while (stack.length > 0) {
        const current = stack.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach((nextId) => {
          if (!visited.has(nextId)) {
            stack.push(nextId);
          }
        });
      }
      return visited;
    };

    const retryNodeIdSet = new Set();
    if (Array.isArray(retryNodeIds)) {
      retryNodeIds.forEach(nodeId => {
        if (nodeId) retryNodeIdSet.add(nodeId);
      });
    }
    if (retryFailed) {
      failedNodeIdSet.forEach(nodeId => retryNodeIdSet.add(nodeId));
    }

    if (retryNodeIdSet.size > 0) {
      const downstreamIds = getDownstreamNodeIds(retryNodeIdSet, scopedEdges);
      downstreamIds.forEach(nodeId => retryNodeIdSet.add(nodeId));
      retryNodeIdSet.forEach(nodeId => {
        delete initialNodeOutputs[nodeId];
      });
    }

    const effectiveSkipNodeIds = skipFailed ? Array.from(failedNodeIdSet) : [];
    const allowPartial = continueOnError || skipFailed;

    if (scopedNodes.length === 0) {
      console.warn('[Workflow] No nodes to execute for the requested scope');
      return;
    }

    const startedAt = Date.now();
    const workflowId = `workflow-${Date.now()}`;
    setCurrentWorkflowId(workflowId);
    nodeTimingsRef.current = {};

    let workflowResult = null;
    let workflowError = null;
    const runFailedNodeIds = new Set();

    try {
      setIsProcessing(true);
      console.log('[Workflow] Starting DAG-based workflow execution');

      // Clear any previous processing states
      setNodes(nds => nds.map(n => ({
        ...n,
        className: (n.className || 'react-flow__node-resizable').replace(' processing', '').replace(' error', ''),
        data: { ...n.data, error: null }
      })));

      // Execute workflow using DAG-based executor
      workflowResult = await executeWorkflow({
        nodes: scopedNodes,
        edges: scopedEdges,
        context: {
          openaiApiKey,
          anthropicApiKey,
          replicateApiKey
        },
        initialNodeOutputs,
        skipNodeIds: effectiveSkipNodeIds,
        continueOnError: allowPartial,
        onNodeStart: (node) => {
          console.log(`[Workflow] Starting node: ${node.id} (${node.type})`);
          nodeTimingsRef.current[node.id] = Date.now();
          // Only add processing class and isProcessing data to the starting node
          setNodes(nds => nds.map(n => {
            if (n.id !== node.id) return n;
            return {
              ...n,
              className: `${(n.className || 'react-flow__node-resizable').replace(' processing', '')} processing`,
              data: { ...n.data, isProcessing: true }
            };
          }));

          // Add animation to edges connected to this node (preserve existing processing states)
          setEdges(eds => eds.map(e => ({
            ...e,
            data: {
              ...e.data,
              isProcessing: e.data?.isProcessing || e.source === node.id || e.target === node.id
            }
          })));
        },
        onNodeComplete: (node, output) => {
          console.log(`[Workflow] Completed node: ${node.id}`, output);
          const outputPayload = getPrimaryOutput(output);
          const nodeStartedAt = nodeTimingsRef.current[node.id];
          const runDurationMs = nodeStartedAt ? Date.now() - nodeStartedAt : null;
          setNodes(nds => nds.map(n => {
            // Only update the completed node, leave others untouched
            if (n.id !== node.id) return n;

            const nextClassName = (n.className || 'react-flow__node-resizable').replace(' processing', '');
            const nextData = { ...n.data, isProcessing: false };
            if (outputPayload && PREVIEW_NODE_TYPES.has(n.type)) {
              nextData.output = outputPayload.value;
              if (outputPayload.metadata?.model) {
                nextData.metadata = outputPayload.metadata.model.split('/').pop();
              }
            }
            if (runDurationMs !== null) {
              nextData.lastRunDurationMs = runDurationMs;
              nextData.lastRunAt = Date.now();
            }

            return {
              ...n,
              className: nextClassName,
              data: nextData
            };
          }));

          // Collect outputs for the gallery
          if (outputPayload && PREVIEW_NODE_TYPES.has(node.type)) {
            const outputType = node.type === 'upscaler' || node.type.includes('image') ? 'image'
              : node.type.includes('video') ? 'video'
              : node.type.includes('audio') ? 'audio'
              : 'text';

            // Persist media outputs to local storage for long-term access
            // This downloads the file from temporary URLs (like Replicate) to local disk
            const persistAndSaveOutput = async () => {
              console.log('[Persist] Starting persist for node:', node.id, 'type:', outputType);
              console.log('[Persist] Original value:', outputPayload.value?.substring(0, 100));

              try {
                const localValue = await persistOutputToLocal(
                  outputPayload.value,
                  outputType,
                  node.id
                );
                console.log('[Persist] Local value after persist:', localValue?.substring(0, 100));

                const outputData = {
                  type: outputType,
                  value: localValue, // Use local path instead of temporary URL
                  originalUrl: outputPayload.value, // Keep original URL for reference
                  nodeId: node.id,
                  nodeType: node.type,
                  prompt: node.data?.prompt || node.data?.text || '',
                  model: outputPayload.metadata?.model || node.data?.model || '',
                  timestamp: Date.now(),
                  workflowId: currentWorkflowId
                };

                // Save to database with local file path
                // Use direct import to avoid closure issues with hook state
                try {
                  const savedId = await db.saveOutput(outputData);
                  console.log('[Persist] Output saved to database. ID:', savedId, 'path:', localValue);
                } catch (dbErr) {
                  console.error('[Persist] Database save failed:', dbErr);
                }

                // Also keep in memory for the current session
                setWorkflowOutputs(prev => [...prev, outputData]);
                console.log('[Persist] Output added to memory state');
              } catch (err) {
                console.error('Failed to persist and save output:', err);

                // Fallback: save with original URL if persistence fails
                const fallbackData = {
                  type: outputType,
                  value: outputPayload.value,
                  nodeId: node.id,
                  nodeType: node.type,
                  prompt: node.data?.prompt || node.data?.text || '',
                  model: outputPayload.metadata?.model || node.data?.model || '',
                  timestamp: Date.now(),
                  workflowId: currentWorkflowId
                };

                try {
                  await db.saveOutput(fallbackData);
                } catch (e) {
                  console.error('Failed to save fallback output:', e);
                }
                setWorkflowOutputs(prev => [...prev, fallbackData]);
              }
            };

            // Run persist and save asynchronously (don't block workflow progress)
            persistAndSaveOutput();
          }

          // Stop animating edges connected to this node only
          setEdges(eds => eds.map(e => {
            if (e.source !== node.id && e.target !== node.id) return e;
            return {
              ...e,
              data: {
                ...e.data,
                isProcessing: false
              }
            };
          }));
        },
        onNodeError: (node, error) => {
          console.error(`[Workflow] Error in node ${node.id}:`, error);
          const nodeStartedAt = nodeTimingsRef.current[node.id];
          const runDurationMs = nodeStartedAt ? Date.now() - nodeStartedAt : null;

          runFailedNodeIds.add(node.id);
          
          // Track failed node
          setFailedNodes(prev => {
            const existing = prev.find(n => n.id === node.id);
            if (existing) return prev;
            return [...prev, { id: node.id, error: error.message, node }];
          });
          
          // Show error recovery panel
          setShowErrorRecovery(true);
          
          // Only update the errored node, leave others untouched
          setNodes(nds => nds.map(n => {
            if (n.id !== node.id) return n;
            return {
              ...n,
              className: `${(n.className || 'react-flow__node-resizable').replace(' processing', '')} error`,
              data: {
                ...n.data,
                isProcessing: false,
                error: error.message,
                ...(runDurationMs !== null ? { lastRunDurationMs: runDurationMs, lastRunAt: Date.now() } : {})
              }
            };
          }));

          // Stop animating edges connected to the errored node
          setEdges(eds => eds.map(e => {
            if (e.source !== node.id && e.target !== node.id) return e;
            return {
              ...e,
              data: {
                ...e.data,
                isProcessing: false
              }
            };
          }));
        },
        onProgress: (progress) => {
          console.log(`[Workflow] Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
        }
      });

      if (workflowResult.success) {
        console.log('[Workflow] Workflow completed successfully', workflowResult);
        console.log('[Workflow] All nodes processed successfully');
      } else if (!allowPartial) {
        throw new Error(workflowResult.error || 'Workflow execution failed');
      } else {
        console.log('[Workflow] Workflow completed with errors', workflowResult);
      }
    } catch (error) {
      console.error('[Workflow] Error during workflow execution:', error);
      workflowError = error;
      setValidationErrors(prev => [...prev, {
        message: `Workflow error: ${error.message}`,
        type: 'error'
      }]);
    } finally {
      if (workflowResult && workflowResult.success === false) {
        executionStateRef.current = {
          nodeOutputs: workflowResult.nodeOutputs || {},
          scopeNodeIds: Array.from(scopedNodeIdSet),
          failedNodeIds: Array.from(runFailedNodeIds)
        };
      } else {
        executionStateRef.current = {
          nodeOutputs: {},
          scopeNodeIds: [],
          failedNodeIds: []
        };
      }

      const workflowName = activeWorkflow?.name || workflowMetadata?.name || 'Local Draft';
      const historyEntry = {
        id: `run-${Date.now()}`,
        workflowId: activeWorkflow?.id || workflowMetadata?.id || null,
        workflowName,
        startedAt,
        finishedAt: Date.now(),
        durationMs: workflowResult?.duration ?? (Date.now() - startedAt),
        success: workflowResult?.success === true,
        nodeCount: scopedNodes.length,
        completedCount: workflowResult?.completedCount ?? 0,
        outputCount: workflowResult?.nodeOutputs ? Object.keys(workflowResult.nodeOutputs).length : 0,
        error: workflowResult?.success === false ? workflowResult.error : workflowError?.message || null,
        trigger,
        scope: Array.isArray(targetNodeIds) && targetNodeIds.length > 0 ? targetNodeIds : 'full'
      };

      appendWorkflowHistory(historyEntry);
      setIsProcessing(false);
      setCurrentWorkflowId(null);
      console.log('[Workflow] Execution completed');
    }
  };

  // Enable Tauri native file drag-drop for images and workflows
  useDragAndDrop(setNodes, setEdges, handleRemoveNode, runWorkflow, reactFlowInstance);

  // Enable undo/redo functionality
  const { undo, redo, takeSnapshot, canUndo, canRedo } = useUndoRedo({
    nodes,
    edges,
    setNodes,
    setEdges,
    maxHistory: 50
  });
  
  // Update ref so callbacks can access takeSnapshot without circular dependency
  takeSnapshotRef.current = takeSnapshot;

  // Helper lines state for alignment guides
  const [helperLines, setHelperLines] = useState({ horizontal: null, vertical: null });

  // Auto-layout function
  const autoLayout = useCallback((direction = LAYOUT_DIRECTION.TOP_BOTTOM) => {
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, {
      direction,
      nodeSpacing: 80,
      rankSpacing: 120
    });
    
    // Take snapshot before layout for undo
    takeSnapshot(true);
    
    setNodes(layoutedNodes);
    
    // Fit view after layout
    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.2 });
    }, 50);
  }, [nodes, edges, setNodes, reactFlowInstance, takeSnapshot]);

  // Group selected nodes into a group node
  const groupSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected && n.type !== 'group');
    if (selectedNodes.length < 2) {
      console.log('[Group] Need at least 2 nodes to create a group');
      return;
    }
    
    // Take snapshot for undo
    takeSnapshot(true);
    
    // Calculate bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(node => {
      const width = node.width || node.style?.width || 280;
      const height = node.height || node.style?.height || 200;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    });
    
    // Add padding around the group
    const padding = 40;
    const groupId = `group-${Date.now()}`;
    const groupPosition = { x: minX - padding, y: minY - padding };
    const groupWidth = maxX - minX + padding * 2;
    const groupHeight = maxY - minY + padding * 2 + 40; // Extra for header
    
    // Create group node
    const groupNode = {
      id: groupId,
      type: 'group',
      position: groupPosition,
      data: {
        label: 'Group',
        childCount: selectedNodes.length,
        onRemove: handleRemoveNode
      },
      style: {
        width: groupWidth,
        height: groupHeight,
        zIndex: -1
      }
    };
    
    // Update selected nodes to be children of the group
    const updatedNodes = nodes.map(node => {
      if (selectedNodes.some(s => s.id === node.id)) {
        return {
          ...node,
          parentNode: groupId,
          extent: 'parent',
          position: {
            x: node.position.x - groupPosition.x,
            y: node.position.y - groupPosition.y + 40 // Account for header
          },
          selected: false
        };
      }
      return { ...node, selected: false };
    });
    
    // Add group node at the beginning (so it renders behind)
    setNodes([groupNode, ...updatedNodes]);
    
    console.log('[Group] Created group with', selectedNodes.length, 'nodes');
  }, [nodes, setNodes, takeSnapshot, handleRemoveNode]);

  // Ungroup a group node (release children)
  const ungroupNode = useCallback((groupId) => {
    const groupNode = nodes.find(n => n.id === groupId && n.type === 'group');
    if (!groupNode) return;
    
    // Take snapshot for undo
    takeSnapshot(true);
    
    // Find children of this group
    const childNodes = nodes.filter(n => n.parentNode === groupId);
    
    // Update children to remove parent relationship and restore absolute positions
    const updatedNodes = nodes
      .filter(n => n.id !== groupId) // Remove group node
      .map(node => {
        if (node.parentNode === groupId) {
          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
            position: {
              x: node.position.x + groupNode.position.x,
              y: node.position.y + groupNode.position.y - 40
            }
          };
        }
        return node;
      });
    
    setNodes(updatedNodes);
    
    console.log('[Group] Ungrouped', childNodes.length, 'nodes');
  }, [nodes, setNodes, takeSnapshot]);

  // Enable keyboard shortcuts (Delete, Duplicate, Copy/Paste, Group, Run Workflow)
  useKeyboardShortcuts({
    nodes,
    edges,
    setNodes,
    setEdges,
    handleRemoveNode,
    reactFlowInstance,
    onGroupSelection: groupSelectedNodes,
    onUngroupSelection: ungroupNode,
    onRunWorkflow: runWorkflow,
    isProcessing
  });

  const saveWorkflow = async () => {
    const workflowName = prompt('Enter a name for this workflow:');
    if (!workflowName) return;
    const trimmedName = workflowName.trim();
    if (!trimmedName) return;
    const workflowId = toSafeWorkflowId(trimmedName);

    try {
      const workflowData = prepareWorkflowData(workflowId, trimmedName);
      const document = buildWorkflowDocument(workflowData);

      await invoke('save_workflow', {
        name: trimmedName,
        data: document
      });
      setWorkflowMetadata(document.metadata);
      const savedWorkflow = {
        name: trimmedName,
        id: workflowId,
        data: document
      };
      setActiveWorkflow(savedWorkflow);
      setOpenWorkflows(prev => {
        const existingIndex = prev.findIndex(w => w.id === savedWorkflow.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = savedWorkflow;
          return updated;
        }
        return [...prev, savedWorkflow];
      });
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const exportWorkflow = () => {
    try {
      const workflowName = activeWorkflow?.name || workflowMetadata?.name || 'workflow';
      const workflowData = prepareWorkflowData(
        activeWorkflow?.id || workflowMetadata?.id,
        workflowName
      );
      const document = buildWorkflowDocument(workflowData);
      
      // Create a blob with the workflow data
      const jsonString = JSON.stringify(document, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workflowName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('[Export] Workflow exported successfully:', workflowName);
    } catch (error) {
      console.error('[Export] Failed to export workflow:', error);
      alert('Failed to export workflow. Please try again.');
    }
  };

  const loadWorkflow = async (workflow) => {
    if (activeWorkflow && workflow.id === activeWorkflow.id) return;
    
    // Hide welcome screen when loading a workflow
    if (showWelcome) {
      setShowWelcome(false);
      setWelcomePinned(false);
    }
    
    // Auto-save current workflow before switching
    if (activeWorkflow) {
      await saveCurrentWorkflow();
    }

    const migrated = migrateWorkflowDocument(workflow);
    const normalizedWorkflow = {
      ...workflow,
      id: migrated.id || workflow.id || workflow.name,
      name: workflow.name || workflow.id || migrated.name || migrated.metadata?.name,
      data: migrated
    };

    // Load the selected workflow
    const migrationErrorsRef = { current: [] };
    const processedEdges = prepareEdges(migrated.edges || [], migrated.nodes || [], migrationErrorsRef);
    // Sort nodes to ensure parent/group nodes come before children (React Flow requirement)
    setNodes(sortNodesForReactFlow(migrated.nodes || []));
    setEdges(processedEdges);
    setValidationErrors(migrationErrorsRef.current || []);
    setWorkflowMetadata({
      ...migrated.metadata,
      name: migrated.metadata?.name || workflow.name || workflow.id || migrated.name
    });
    setActiveWorkflow(normalizedWorkflow);
    setOpenWorkflows(prev => {
      const existingIndex = prev.findIndex(w => w.id === normalizedWorkflow.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = normalizedWorkflow;
        return updated;
      }
      return [...prev, normalizedWorkflow];
    });
    setHasUnsavedChanges(false);
    
    // Restore viewport (zoom and position) if available
    if (migrated.viewport && reactFlowInstance) {
      // Use smooth animation to transition to the saved viewport
      reactFlowInstance.setViewport(
        migrated.viewport,
        { duration: 800 } // 800ms smooth animation
      );
    }
  };

  const saveCurrentWorkflow = useCallback(async () => {
    if (!activeWorkflow) return null;

    try {
      const workflowData = prepareWorkflowData(activeWorkflow.id, activeWorkflow.name);
      const document = buildWorkflowDocument(workflowData);

      await invoke('save_workflow', {
        name: activeWorkflow.name,
        data: document
      });
      setWorkflowMetadata(document.metadata);
      setActiveWorkflow(prev => {
        if (prev && prev.id === activeWorkflow.id) {
          return { ...prev, data: document };
        }
        return prev;
      });

      setOpenWorkflows(prev => {
        const existingIndex = prev.findIndex(w => w.id === activeWorkflow.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = { ...prev[existingIndex], ...activeWorkflow, data: document };
          return updated;
        }
        return [...prev, { ...activeWorkflow, data: document }];
      });

      setHasUnsavedChanges(false);
      return document;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return null;
    }
  }, [activeWorkflow, prepareWorkflowData]);

  // Track changes to nodes and edges
  useEffect(() => {
    if (!activeWorkflow) return;
    
    const savedEntry = openWorkflows.find(w => w.id === activeWorkflow.id || w.name === activeWorkflow.name);
    if (!savedEntry?.data) return;

    const currentDocument = buildWorkflowDocument(prepareWorkflowData(activeWorkflow.id, activeWorkflow.name));
    const normalizeForComparison = (doc) => JSON.stringify({
      id: doc?.id,
      name: doc?.name,
      schema: doc?.schema,
      version: doc?.version,
      nodes: doc?.nodes || [],
      edges: doc?.edges || [],
      metadata: { ...(doc?.metadata || {}), updatedAt: undefined },
      viewport: doc?.viewport,
      outputs: doc?.outputs || []
    });

    const hasChanges = normalizeForComparison(currentDocument) !== normalizeForComparison(savedEntry.data);
    setHasUnsavedChanges(hasChanges);
  }, [activeWorkflow, openWorkflows, prepareWorkflowData]);

  useEffect(() => {
    saveCurrentWorkflowRef.current = saveCurrentWorkflow;
  }, [saveCurrentWorkflow]);

  useEffect(() => {
    activeWorkflowRef.current = activeWorkflow;
  }, [activeWorkflow]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Keep workflow metadata name aligned with the active workflow name for consistent saves
  useEffect(() => {
    if (activeWorkflow?.name) {
      setWorkflowMetadata(prev => ({
        ...prev,
        name: activeWorkflow.name
      }));
    }
  }, [activeWorkflow]);

  // Add window close handler
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let removeCloseListener;

    const registerCloseHandler = async () => {
      try {
        removeCloseListener = await appWindow.onCloseRequested(async (event) => {
          if (isClosingRef.current) return;
          isClosingRef.current = true;
          try {
            event.preventDefault();
            await saveCurrentWorkflowRef.current?.();
          } catch (error) {
            console.error('Failed to save workflow before close:', error);
          } finally {
            if (removeCloseListener) {
              removeCloseListener();
              removeCloseListener = null;
            }
            appWindow.close();
          }
        });
      } catch (error) {
        console.error('Failed to register close handler:', error);
      }
    };

    registerCloseHandler();

    const handleBeforeUnload = (e) => {
      // Best effort to persist the active workflow when the window is about to unload
      if (activeWorkflowRef.current) {
        saveCurrentWorkflowRef.current?.();
      }

      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        e.returnValue = message;
        return message;
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      if (removeCloseListener) {
        removeCloseListener();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Ensure there's always an active workflow
  useEffect(() => {
    const ensureActiveWorkflow = async () => {
      // If there's already an active workflow, we're good
      if (activeWorkflow) return;
      
      try {
        // Get the list of workflows
        const workflowsList = await invoke('list_workflows');
        
        // If there are no workflows, we can't select one
        if (!workflowsList || workflowsList.length === 0) return;
        
        // Load the first workflow
        const firstWorkflow = workflowsList[0];
        const loadedWorkflowData = await invoke('load_workflow', { id: firstWorkflow.id });
        
        // Set as active workflow
        const loadedWorkflow = {
          id: firstWorkflow.id,
          name: firstWorkflow.name,
          data: loadedWorkflowData.data || loadedWorkflowData
        };
        
        setActiveWorkflow(loadedWorkflow);
        setNodes(loadedWorkflow.data.nodes || []);
        setEdges(loadedWorkflow.data.edges || []);
        setWorkflowMetadata({
          ...(loadedWorkflow.data.metadata || workflowMetadata),
          name: loadedWorkflow.name || loadedWorkflow.id
        });
        setOpenWorkflows(prev => {
          const existingIndex = prev.findIndex(w => w.id === loadedWorkflow.id);
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = loadedWorkflow;
            return updated;
          }
          return [...prev, loadedWorkflow];
        });
        
        // Restore viewport if available
        if (loadedWorkflow.data.viewport && reactFlowInstance) {
          reactFlowInstance.setViewport(
            loadedWorkflow.data.viewport,
            { duration: 800 } // 800ms smooth animation
          );
        }
      } catch (error) {
        console.error('Failed to ensure active workflow:', error);
      }
    };
    
    ensureActiveWorkflow();
  }, [activeWorkflow, reactFlowInstance, workflowMetadata]);

  // Determine if the current theme is a light theme
  const isLightTheme = useMemo(() => {
    const lightThemes = [
      'github', 'cream', 'solarized-light', 'paper', 'snow', 'sand', 'rose-pine-dawn', 'latte',
      'peach', 'sage', 'lilac', 'seafoam', 'apricot', 'clay', 'blossom', 'honey', 'mist', 'matcha'
    ];
    return lightThemes.includes(currentTheme);
  }, [currentTheme]);

  // Apply theme-specific styles directly to document
  useEffect(() => {
    if (isLightTheme) {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [isLightTheme]);

  const openNodeSelectorAt = useCallback((event) => {
    const flowWrapper = document.querySelector('.react-flow__renderer');
    if (!flowWrapper) return;

    const bounds = flowWrapper.getBoundingClientRect();
    let x = bounds.left + bounds.width / 2;
    let y = bounds.top + bounds.height / 2;

    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = Math.min(Math.max(rect.left + rect.width / 2, bounds.left + 24), bounds.right - 24);
      y = Math.min(Math.max(rect.bottom + 12, bounds.top + 24), bounds.bottom - 24);
    }

    emit("openNodeSelector", {
      position: { x, y },
      clickPosition: { x: x - bounds.left, y: y - bounds.top },
      connectionContext: null
    });
  }, []);

  const handleCreateWorkflowFromWelcome = useCallback(async (requestedName) => {
    setShowWelcome(false);
    setWelcomePinned(false);

    let existingIds = [];
    try {
      const workflowsList = await invoke('list_workflows');
      existingIds = Array.isArray(workflowsList) ? workflowsList.map((wf) => wf.id) : [];
    } catch (error) {
      console.error('Failed to list workflows:', error);
    }

    const trimmedName = typeof requestedName === 'string' ? requestedName.trim() : '';
    const baseName = trimmedName || "Untitled Workflow";
    let uniqueName = baseName;
    let uniqueId = toSafeWorkflowId(uniqueName);
    let counter = 2;
    while (existingIds.includes(uniqueId)) {
      uniqueName = `${baseName} ${counter}`;
      uniqueId = toSafeWorkflowId(uniqueName);
      counter += 1;
    }

    const document = buildWorkflowDocument({
      id: uniqueId,
      name: uniqueName,
      nodes: [],
      edges: []
    });

    const newWorkflow = {
      id: uniqueId,
      name: uniqueName,
      data: document
    };

    try {
      await invoke('save_workflow', {
        name: newWorkflow.name,
        data: document
      });
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }

    await loadWorkflow(newWorkflow);

    if (reactFlowInstance) {
      reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 });
    }
  }, [loadWorkflow, reactFlowInstance]);

  const handleBuildWithAI = useCallback(() => {
    setShowWelcome(false);
    setWelcomePinned(false);
    setHideEmptyHint(true);
    emit("assistantOpen");
  }, []);

  const handleStartFromScratch = useCallback((event) => {
    setShowWelcome(false);
    setWelcomePinned(false);
    setHideEmptyHint(true);
    openNodeSelectorAt(event);
  }, [openNodeSelectorAt]);

  const handleLoadWorkflowFromWelcome = async (workflow) => {
    setShowWelcome(false);
    setWelcomePinned(false);
    
    // If a workflow object is passed, load it directly
    if (workflow && workflow.id) {
      try {
        const loadedWorkflowData = await invoke('load_workflow', { id: workflow.id });
        await loadWorkflow({
          id: workflow.id,
          name: workflow.name,
          data: loadedWorkflowData.data || loadedWorkflowData
        });
      } catch (error) {
        console.error('Failed to load workflow from welcome screen:', error);
        // Fallback to opening sidebar
        setSidebarOpen(true);
      }
    } else {
      // No workflow specified, just open sidebar
      setSidebarOpen(true);
    }
  };

  const handleLoadTemplate = useCallback((template) => {
    console.log('[Template] Loading template:', template.name);
    
    // Hide welcome screen
    setShowWelcome(false);
    setWelcomePinned(false);
    
    // Clear existing workflow
    setNodes([]);
    setEdges([]);
    
    // Apply template using the utility function
    const { nodes: templateNodes, edges: templateEdges } = applyTemplate(template, handleRemoveNode);
    
    // Set the new nodes and edges
    setTimeout(() => {
      setNodes(templateNodes);
      setEdges(templateEdges);
      
      // Fit view to show all nodes
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
        }, 100);
      }
    }, 50);
    
    console.log('[Template] Template loaded successfully');
  }, [handleRemoveNode, reactFlowInstance]);

  // Error recovery handlers
  const handleRetryNode = useCallback((nodeId) => {
    console.log('[ErrorRecovery] Retrying node:', nodeId);
    
    // Remove from failed nodes list
    setFailedNodes(prev => {
      const next = prev.filter(n => n.id !== nodeId);
      if (next.length === 0) {
        setShowErrorRecovery(false);
      }
      return next;
    });
    
    // Clear error state from the node
    setNodes(nds => nds.map(n => ({
      ...n,
      className: n.id === nodeId
        ? (n.className || 'react-flow__node-resizable').replace(' error', '')
        : n.className,
      data: n.id === nodeId
        ? { ...n.data, error: null }
        : n.data
    })));

    runWorkflow({ trigger: 'retry-node', resume: true, retryNodeIds: [nodeId] });
  }, [runWorkflow]);

  const handleRetryAll = useCallback(() => {
    console.log('[ErrorRecovery] Retrying all failed nodes');
    
    // Clear all failed nodes
    setFailedNodes([]);
    
    // Clear error state from all nodes
    setNodes(nds => nds.map(n => ({
      ...n,
      className: (n.className || 'react-flow__node-resizable').replace(' error', ''),
      data: { ...n.data, error: null }
    })));
    
    // Hide the panel
    setShowErrorRecovery(false);
    
    runWorkflow({ trigger: 'retry-all', resume: true, retryFailed: true });
  }, [runWorkflow]);

  const handleSkipErrors = useCallback(() => {
    console.log('[ErrorRecovery] Skipping errors');
    
    // Clear failed nodes list
    setFailedNodes([]);

    // Clear error state from all nodes
    setNodes(nds => nds.map(n => ({
      ...n,
      className: (n.className || 'react-flow__node-resizable').replace(' error', ''),
      data: { ...n.data, error: null }
    })));
    
    // Hide the panel
    setShowErrorRecovery(false);

    runWorkflow({ trigger: 'skip-errors', resume: true, skipFailed: true, continueOnError: true });
  }, []);

  const handleCloseErrorRecovery = useCallback(() => {
    setShowErrorRecovery(false);
  }, []);

  const assistantNodeDefinitions = useMemo(
    () => nodeDefinitions.filter((node) => ASSISTANT_ALLOWED_NODE_TYPES.includes(node.type)),
    []
  );

  const assistantNodeSchemas = useMemo(() => {
    const entries = assistantNodeDefinitions
      .map((node) => {
        const schema = getNodeSchema(node.type);
        return schema ? [node.type, schema] : null;
      })
      .filter(Boolean);
    return Object.fromEntries(entries);
  }, [assistantNodeDefinitions]);

  const assistantNodeTypes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(registeredNodeTypes).filter(([type]) =>
          ASSISTANT_ALLOWED_NODE_TYPES.includes(type)
        )
      ),
    []
  );

  const assistantSystemPrompt = useMemo(
    () =>
      buildAssistantSystemPrompt({
        nodeDefinitions: assistantNodeDefinitions,
        nodeTypes: assistantNodeTypes,
        nodeSchemas: assistantNodeSchemas,
        workflowTemplates: workflowTemplatesState
      }),
    [
      assistantNodeDefinitions,
      assistantNodeSchemas,
      assistantNodeTypes,
      workflowTemplatesState
    ]
  );

  const toolExecutor = useMemo(
    () =>
      createToolExecutor({
        getNodes: () => window.nodesRef?.current || nodes,
        getEdges: () => window.edgesRef?.current || edges,
        setNodes,
        setEdges,
        handleRemoveNode,
        setValidationErrors,
        runWorkflow,
        allowedNodeTypes: ASSISTANT_ALLOWED_NODE_TYPES,
        focusCanvas: () => {
          if (!reactFlowInstance) return;
          setTimeout(() => {
            reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
          }, 0);
        }
      }),
    [edges, handleRemoveNode, nodes, reactFlowInstance, runWorkflow, setEdges, setNodes]
  );

  const executeToolCall = useCallback(
    (toolCall) => toolExecutor.executeToolCall(toolCall),
    [toolExecutor]
  );

  // Compute toolbar state
  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const hasSelection = selectedNodes.length >= 2;
  const hasGroupSelected = useMemo(
    () => selectedNodes.some(n => n.type === 'group'),
    [selectedNodes]
  );

  // Handler for ungrouping selected group
  const handleUngroupSelected = useCallback(() => {
    const selectedGroup = selectedNodes.find(n => n.type === 'group');
    if (selectedGroup) {
      ungroupNode(selectedGroup.id);
    }
  }, [selectedNodes, ungroupNode]);

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Portal root for node settings popovers */}
      <div id="global-node-settings-portal" />
      
        {showWelcome && (
          <WelcomeScreen
            onBuildWithAI={handleBuildWithAI}
            onStartFromScratch={handleCreateWorkflowFromWelcome}
            onLoadWorkflow={handleLoadWorkflowFromWelcome}
            onLoadTemplate={handleLoadTemplate}
            showAssistantPanel={showAssistantPanel}
            templates={workflowTemplatesState}
          />
        )}
      <Sidebar
            onWorkflowLoad={loadWorkflow}
            activeWorkflow={activeWorkflow}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={saveCurrentWorkflow}
            isOpen={sidebarOpen}
            onToggle={setSidebarOpen}
            workflowOutputs={workflowOutputs}
            database={database}
            workflowTemplates={workflowTemplatesState}
            onLoadTemplate={handleLoadTemplate}
            onGalleryDragStart={handleGalleryDragStart}
            onGalleryDragEnd={handleGalleryDragEnd}
            updateState={{
              supported: updateSupported,
              currentVersion,
              updateStatus,
              updateInfo,
              updatePath,
              updateError,
              lastUpdateCheck
            }}
            updateActions={{
              onCheck: checkForUpdate,
              onDownload: downloadUpdate,
              onInstall: installUpdate
            }}

            // Settings props
            onThemeChange={setCurrentTheme}
            currentTheme={currentTheme}
            openaiApiKey={openaiApiKey}
            onOpenAIApiKeyChange={(newKey) => setOpenAIApiKey(newKey)}
            openRouterApiKey={openRouterApiKey}
            onOpenRouterApiKeyChange={(newKey) => setOpenRouterApiKey(newKey)}
            anthropicApiKey={anthropicApiKey}
            onAnthropicApiKeyChange={(newKey) => setAnthropicApiKey(newKey)}
            replicateApiKey={replicateApiKey}
            onReplicateApiKeyChange={(newKey) => setReplicateApiKey(newKey)}
            geminiApiKey={geminiApiKey}
            onGeminiApiKeyChange={(newKey) => setGeminiApiKey(newKey)}
            ollamaBaseUrl={ollamaBaseUrl}
            onOllamaBaseUrlChange={(newUrl) => setOllamaBaseUrl(newUrl)}
            lmStudioBaseUrl={lmStudioBaseUrl}
            onLmStudioBaseUrlChange={(newUrl) => setLmStudioBaseUrl(newUrl)}
              defaultSaveLocation={defaultSaveLocation}
              onDefaultSaveLocationChange={(newLocation) => setDefaultSaveLocation(newLocation)}
              showTemplates={showTemplates}
              onShowTemplatesChange={setShowTemplates}
              showAssistantPanel={showAssistantPanel}
              onShowAssistantPanelChange={setShowAssistantPanel}
              runButtonUnlocked={runButtonUnlocked}
              onRunButtonUnlockedChange={setRunButtonUnlocked}
              runButtonPosition={runButtonPosition}
              onRunButtonPositionReset={() => setRunButtonPosition(null)}
              onSaveWorkflow={saveWorkflow}
              onLoadWorkflow={loadWorkflow}
              onExportWorkflow={exportWorkflow}
            onClearWorkflow={() => {
              if (window.confirm("Are you sure you want to clear the current workflow?")) {
                setNodes([]);
                setEdges([]);
                localStorage.removeItem("noder-nodes");
                localStorage.removeItem("noder-edges");
                localStorage.removeItem(LOCAL_WORKFLOW_KEY);
              }
            }}
            // Default model settings
            defaultTextModel={defaultTextModel}
            onDefaultTextModelChange={setDefaultTextModel}
            defaultImageModel={defaultImageModel}
            onDefaultImageModelChange={setDefaultImageModel}
            defaultVideoModel={defaultVideoModel}
            onDefaultVideoModelChange={setDefaultVideoModel}
            defaultAudioModel={defaultAudioModel}
            onDefaultAudioModelChange={setDefaultAudioModel}
            defaultUpscalerModel={defaultUpscalerModel}
            onDefaultUpscalerModelChange={setDefaultUpscalerModel}
            // Edge appearance
            edgeType={edgeType}
            onEdgeTypeChange={setEdgeType}
            // Editor toolbar visibility toggle
            showEditorToolbar={showEditorToolbar}
            onShowEditorToolbarChange={setShowEditorToolbar}
            // Home navigation
            onGoHome={() => {
              setWelcomePinned(true);
              setShowWelcome(true);
            }}
          />
      <div className="flow-wrapper">
        <ReactFlow
          nodes={sortNodesForReactFlow(nodes)}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setReactFlowInstance}
          fitView
          defaultEdgeOptions={{
            type: 'custom',
            animated: false
          }}
          isValidConnection={(params) => {
            const validations = ['type-mismatch', 'unique-handles', 'data-flow', 'data-type-match'];
            return validations.every(validationName => 
              getValidator(validationName)({
                ...params,
                sourceHandleType: 'output',
                targetHandleType: 'input'
              })
            );
          }}
          onDrop={handleImageDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodesFocusable={false}
          nodesConnectable={true}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          panOnScroll={false}
          zoomOnDoubleClick={false}
          snapToGrid={false}
          nodeDragThreshold={1}
          selectNodesOnDrag={true}
          noDragClassName="nodrag"
        >
          <Background />
          <Controls />
          {/* Helper lines for node alignment */}
          <HelperLines 
            horizontal={helperLines.horizontal} 
            vertical={helperLines.vertical} 
          />
          {/* Editor Toolbar */}
          {showEditorToolbar && (
            <EditorToolbar
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onAutoLayout={autoLayout}
              onGroupSelected={groupSelectedNodes}
              onUngroupSelected={handleUngroupSelected}
              hasSelection={hasSelection}
              hasGroupSelected={hasGroupSelected}
            />
          )}
          <MiniMap
            className="app-minimap"
            position="bottom-left"
            nodeColor="var(--primary-color)"
            nodeStrokeColor="var(--node-border)"
            nodeBorderRadius={3}
            nodeStrokeWidth={1}
            maskColor="rgba(0, 0, 0, 0.35)"
            style={{ margin: 16, left: 64, bottom: 0 }}
            pannable
            zoomable
          />
          {validationErrors.length > 0 && (
            <ValidationErrorsPanel 
              errors={validationErrors}
              onDismiss={handleDismissError}
              onClearAll={handleClearAllErrors}
            />
          )}
          <NodeSelector 
            nodeDefinitions={nodeDefinitions}
            onAddNode={handleAddNode}
            screenToFlowPosition={(pos) => {
              const { x, y } = pos;
              if (!reactFlowInstance) {
                return { x, y };
              }
              const { zoom, x: panX, y: panY } = reactFlowInstance.getViewport();
              return {
                x: (x - panX) / zoom,
                y: (y - panY) / zoom
              };
            }}
          />
        </ReactFlow>
        {!showWelcome && nodes.length === 0 && !hideEmptyHint && (
          <div className="empty-workflow-overlay">
            <div className="empty-workflow-card" role="status" aria-live="polite">
              <div className="empty-workflow-eyebrow">Empty workflow</div>
              <h2 className="empty-workflow-title">How do you want to start?</h2>
              <p className="empty-workflow-subtitle">
                Pick a path to begin, then add your first node.
              </p>
              <div className="empty-workflow-actions">
                {showAssistantPanel && (
                  <button
                    type="button"
                    className="empty-workflow-button is-primary"
                    onClick={handleBuildWithAI}
                  >
                    <span className="empty-workflow-button-icon" aria-hidden="true">
                      <FaRobot />
                    </span>
                    <span className="empty-workflow-button-copy">
                      <span className="empty-workflow-button-title">Build with AI</span>
                      <span className="empty-workflow-button-description">
                        Open noder.bot and describe your workflow.
                      </span>
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="empty-workflow-button"
                  onClick={handleStartFromScratch}
                >
                  <span className="empty-workflow-button-icon" aria-hidden="true">
                    <FaMagic />
                  </span>
                  <span className="empty-workflow-button-copy">
                    <span className="empty-workflow-button-title">Start from scratch</span>
                    <span className="empty-workflow-button-description">
                      Open the node menu and choose your first block.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        <FloatingProcessButton
          onClick={runWorkflow}
          isProcessing={isProcessing}
          isUnlocked={runButtonUnlocked}
          position={runButtonPosition}
          onPositionChange={setRunButtonPosition}
        />
        {showAssistantPanel && (
          <AssistantPanel
            openRouterApiKey={openRouterApiKey}
            systemPrompt={assistantSystemPrompt}
            executeToolCall={executeToolCall}
          />
        )}
        {showErrorRecovery && failedNodes.length > 0 && (
          <ErrorRecoveryPanel
            failedNodes={failedNodes}
          onRetry={handleRetryNode}
          onRetryAll={handleRetryAll}
          onSkip={handleSkipErrors}
          onClose={handleCloseErrorRecovery}
        />
      )}
    </div>
  );
}

export default App;
