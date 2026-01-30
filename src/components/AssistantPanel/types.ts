/**
 * Types for AssistantPanel components.
 */

import React from 'react';

// =============================================================================
// Message Types
// =============================================================================

interface ToolCallFunction {
  name: string;
  arguments: string;
}

interface ToolCall {
  id: string;
  type: string;
  function: ToolCallFunction;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// =============================================================================
// Model Types
// =============================================================================

export interface ModelCatalogEntry {
  id: string;
  label: string;
  provider: string;
  tags: string[];
  featured: boolean;
}

// =============================================================================
// Tool Types
// =============================================================================

export interface ToolResult {
  error?: string;
  [key: string]: unknown;
}

// =============================================================================
// Component Props
// =============================================================================

export interface AssistantPanelProps {
  /** Optional API key override - if not provided, reads from settings store */
  openRouterApiKey?: string;
  systemPrompt: string;
  executeToolCall: (call: ToolCall) => Promise<ToolResult>;
  defaultModel?: string;
}

export interface ModelPickerPanelProps {
  model: string;
  modelPickerOpen: boolean;
  modelProvider: string;
  providerOptions: string[];
  featuredModels: ModelCatalogEntry[];
  filteredModels: ModelCatalogEntry[];
  recentEntries: ModelCatalogEntry[];
  modelQuery: string;
  showCustomOption: boolean;
  activeModelId: string;
  modelPickerRef: React.RefObject<HTMLDivElement>;
  onModelInputChange: (value: string) => void;
  onModelFocus: () => void;
  onModelKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onModelClear: () => void;
  onProviderChange: (provider: string) => void;
  onModelSelect: (modelId: string) => void;
  providerMatches: (entry: ModelCatalogEntry) => boolean;
}

export interface MessageDisplayProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  activeToolCalls: string[];
  messagesContainerRef: React.RefObject<HTMLDivElement>;
}

export interface MessageComposerProps {
  draft: string;
  isLoading: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}
