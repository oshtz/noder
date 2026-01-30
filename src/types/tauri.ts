/**
 * Type definitions for Tauri invoke commands
 * Generated based on src-tauri/src/main.rs command signatures
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// =============================================================================
// Common Types
// =============================================================================

/** Position coordinates for floating button */
export interface FloatingButtonPosition {
  x: number;
  y: number;
}

/** Application settings stored in settings.json */
export interface AppSettings {
  replicate_api_key?: string | null;
  fal_api_key?: string | null;
  openai_api_key?: string | null;
  openrouter_api_key?: string | null;
  anthropic_api_key?: string | null;
  gemini_api_key?: string | null;
  ollama_base_url?: string | null;
  lm_studio_base_url?: string | null;
  default_save_location?: string | null;
  show_templates?: boolean | null;
  show_assistant_panel?: boolean | null;
  run_button_unlocked?: boolean | null;
  run_button_position?: FloatingButtonPosition | null;
  default_text_model?: string | null;
  default_image_model?: string | null;
  default_video_model?: string | null;
  default_audio_model?: string | null;
  default_upscaler_model?: string | null;
  edge_type?: string | null;
  // Default providers for each model type
  default_text_provider?: string | null;
  default_image_provider?: string | null;
  default_video_provider?: string | null;
  default_audio_provider?: string | null;
  default_upscaler_provider?: string | null;
}

// =============================================================================
// Workflow Types
// =============================================================================

/** Workflow data structure */
export interface Workflow {
  name: string;
  id: string;
  data: WorkflowData;
}

/** Workflow node and edge data */
export interface WorkflowData {
  nodes: unknown[];
  edges: unknown[];
  [key: string]: unknown;
}

// =============================================================================
// Replicate API Types
// =============================================================================

/** Replicate prediction object */
export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string | null;
  logs?: string | null;
  metrics?: Record<string, unknown> | null;
}

/** Replicate model information */
export interface ReplicateModel {
  owner: string;
  name: string;
  description?: string | null;
  visibility: string;
  github_url?: string | null;
  paper_url?: string | null;
  license_url?: string | null;
  run_count: number;
  cover_image_url?: string | null;
  default_example?: unknown;
  latest_version?: ReplicateModelVersion | null;
}

/** Replicate model version */
export interface ReplicateModelVersion {
  id: string;
  created_at: string;
  cog_version?: string;
  openapi_schema?: Record<string, unknown>;
}

/** Replicate models list response */
export interface ReplicateModelsResponse {
  next?: string | null;
  previous?: string | null;
  results: ReplicateModel[];
}

/** Replicate file upload response */
export interface ReplicateFileUpload {
  id: string;
  name: string;
  content_type: string;
  size: number;
  urls: ReplicateFileUrls;
  created_at: string;
  expires_at?: string | null;
}

/** Replicate file URLs */
export interface ReplicateFileUrls {
  get: string;
}

// =============================================================================
// OpenAI API Types
// =============================================================================

/** OpenAI model information */
export interface OpenAIModel {
  id: string;
  owned_by?: string | null;
}

// =============================================================================
// WhatsApp Types
// =============================================================================

/** WhatsApp connection status */
export interface WhatsAppStatus {
  status: string;
  timestamp: string;
  isAuthenticated: boolean;
  isClientReady: boolean;
  isInitializing: boolean;
}

/** Received WhatsApp message */
export interface WhatsAppReceivedMessage {
  from: string;
  to: string;
  fromMe: boolean;
  content: string;
  timestamp: string;
}

// =============================================================================
// GitHub Types
// =============================================================================

/** GitHub release information (partial - only commonly used fields) */
export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubReleaseAsset[];
}

/** GitHub release asset */
export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

// =============================================================================
// Command Argument Types
// =============================================================================

/** Arguments for save_workflow command */
export interface SaveWorkflowArgs {
  name: string;
  data: WorkflowData;
}

/** Arguments for load_workflow command */
export interface LoadWorkflowArgs {
  id: string;
}

/** Arguments for rename_workflow command */
export interface RenameWorkflowArgs {
  id: string;
  newName: string;
}

/** Arguments for delete_workflow command */
export interface DeleteWorkflowArgs {
  id: string;
}

/** Arguments for replicate_create_prediction command */
export interface ReplicateCreatePredictionArgs {
  model: string;
  input: Record<string, unknown>;
}

/** Arguments for replicate_get_prediction command */
export interface ReplicateGetPredictionArgs {
  predictionId: string;
}

/** Arguments for replicate_cancel_prediction command */
export interface ReplicateCancelPredictionArgs {
  predictionId: string;
}

/** Arguments for replicate_get_model command */
export interface ReplicateGetModelArgs {
  owner: string;
  name: string;
}

/** Arguments for replicate_list_models command */
export interface ReplicateListModelsArgs {
  cursor?: string | null;
  collectionSlug?: string | null;
}

/** Arguments for replicate_upload_file command */
export interface ReplicateUploadFileArgs {
  filePath: string;
  filename: string;
  contentType: string;
}

/** Arguments for replicate_delete_file command */
export interface ReplicateDeleteFileArgs {
  fileId: string;
}

/** Arguments for download_and_save_file command */
export interface DownloadAndSaveFileArgs {
  url: string;
  filename?: string | null;
  destinationFolder?: string | null;
}

/** Arguments for read_file_as_base64 command */
export interface ReadFileAsBase64Args {
  filePath: string;
}

/** Arguments for save_uploaded_file command */
export interface SaveUploadedFileArgs {
  filename: string;
  data: string;
}

/** Arguments for save_settings command */
export interface SaveSettingsArgs {
  settings: AppSettings;
}

/** Arguments for anthropic_request command */
export interface AnthropicRequestArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: string;
  temperature: number;
}

/** Arguments for openai_chat_completion command */
export interface OpenAIChatCompletionArgs {
  model: string;
  systemPrompt: string;
  userContent: string;
  temperature?: number | null;
}

/** Arguments for send_whatsapp_message command */
export interface SendWhatsAppMessageArgs {
  phoneNumber: string;
  message: string;
}

/** Arguments for listen_whatsapp_messages command */
export interface ListenWhatsAppMessagesArgs {
  id: string;
  phoneNumbers: string[];
  command: string;
}

/** Arguments for stop_whatsapp_listener command */
export interface StopWhatsAppListenerArgs {
  id: string;
}

/** Arguments for fetch_github_release command */
export interface FetchGitHubReleaseArgs {
  repo: string;
}

/** Arguments for download_update command */
export interface DownloadUpdateArgs {
  url: string;
  fileName?: string | null;
  dirName?: string | null;
}

/** Arguments for apply_update command */
export interface ApplyUpdateArgs {
  updatePath: string;
}

/** Arguments for extract_app_zip command (macOS only) */
export interface ExtractAppZipArgs {
  zipPath: string;
}

// =============================================================================
// Command Map Type
// =============================================================================

/** Map of command names to their argument and return types */
export interface TauriCommands {
  // Workflow commands
  save_workflow: { args: SaveWorkflowArgs; return: void };
  list_workflows: { args: never; return: Workflow[] };
  load_workflow: { args: LoadWorkflowArgs; return: Workflow };
  rename_workflow: { args: RenameWorkflowArgs; return: void };
  delete_workflow: { args: DeleteWorkflowArgs; return: void };
  create_workflow: { args: never; return: Workflow };

  // Settings commands
  save_settings: { args: SaveSettingsArgs; return: void };
  load_settings: { args: never; return: AppSettings };

  // Replicate commands
  replicate_create_prediction: { args: ReplicateCreatePredictionArgs; return: ReplicatePrediction };
  replicate_get_prediction: { args: ReplicateGetPredictionArgs; return: ReplicatePrediction };
  replicate_cancel_prediction: { args: ReplicateCancelPredictionArgs; return: ReplicatePrediction };
  replicate_get_model: { args: ReplicateGetModelArgs; return: ReplicateModel };
  replicate_list_models: { args: ReplicateListModelsArgs; return: ReplicateModelsResponse };
  replicate_upload_file: { args: ReplicateUploadFileArgs; return: ReplicateFileUpload };
  replicate_delete_file: { args: ReplicateDeleteFileArgs; return: void };

  // File commands
  download_and_save_file: { args: DownloadAndSaveFileArgs; return: string };
  read_file_as_base64: { args: ReadFileAsBase64Args; return: string };
  save_uploaded_file: { args: SaveUploadedFileArgs; return: string };

  // OpenAI commands
  openai_list_models: { args: never; return: OpenAIModel[] };
  openai_chat_completion: { args: OpenAIChatCompletionArgs; return: string };

  // Anthropic commands
  anthropic_request: { args: AnthropicRequestArgs; return: string };

  // WhatsApp commands
  send_whatsapp_message: { args: SendWhatsAppMessageArgs; return: void };
  get_whatsapp_status: { args: never; return: WhatsAppStatus };
  init_whatsapp: { args: never; return: void };
  listen_whatsapp_messages: { args: ListenWhatsAppMessagesArgs; return: void };
  stop_whatsapp_listener: { args: StopWhatsAppListenerArgs; return: void };

  // Update commands
  fetch_github_release: { args: FetchGitHubReleaseArgs; return: GitHubRelease };
  download_update: { args: DownloadUpdateArgs; return: string };
  apply_update: { args: ApplyUpdateArgs; return: void };
  extract_app_zip: { args: ExtractAppZipArgs; return: string };
}

// =============================================================================
// Typed Invoke Function
// =============================================================================

/**
 * Type-safe wrapper around Tauri's invoke function.
 * Provides compile-time checking of command names, arguments, and return types.
 *
 * @example
 * // Correctly typed - knows return type is Workflow[]
 * const workflows = await invoke('list_workflows');
 *
 * @example
 * // Correctly typed - requires name and data args
 * await invoke('save_workflow', { name: 'My Workflow', data: workflowData });
 *
 * @example
 * // Type error - 'invalid_command' is not a valid command
 * await invoke('invalid_command');
 */
export async function invoke<K extends keyof TauriCommands>(
  command: K,
  ...args: TauriCommands[K]['args'] extends never ? [] : [TauriCommands[K]['args']]
): Promise<TauriCommands[K]['return']> {
  if (args.length === 0) {
    return tauriInvoke(command) as Promise<TauriCommands[K]['return']>;
  }
  return tauriInvoke(command, args[0] as Record<string, unknown>) as Promise<
    TauriCommands[K]['return']
  >;
}

// =============================================================================
// Re-export original invoke for non-typed usage
// =============================================================================

export { tauriInvoke as invokeUntyped };
