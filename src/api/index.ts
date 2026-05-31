/**
 * API Client Module
 *
 * Centralized exports for all API operations.
 * Import from this module for cleaner imports:
 *
 * import { createPrediction, listWorkflows, chatCompletion } from './api';
 */

export * from './workflows';
export * from './settings';
export * from './replicate';

export {
  chatCompletion,
  chatCompletionStream,
  listModels as listOpenRouterModels,
  listTextModels,
  listImageModels,
  extractMessageContent,
  extractToolCalls,
  hasToolCalls,
  getFinishReason,
  getUsage,
} from './openrouter';
export type {
  ChatCompletionChoice,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  MessageRole,
  ModelArchitecture,
  ModelPricing,
  ModelsListResponse,
  OpenRouterModel,
  OutputModality,
  Tool,
  ToolCall,
  ToolFunction,
  UsageStats,
  ListModelsOptions as OpenRouterListModelsOptions,
} from './openrouter';
