/**
 * App-specific constants
 */

import type { HandleAliasMap } from '../types/workflow';

// ============================================================================
// Legacy Handle Aliases (for backwards compatibility)
// ============================================================================

export const LEGACY_HANDLE_ALIASES: HandleAliasMap = {
  'display-text': {
    source: { out: 'text-out' },
    target: { in: 'text-in' },
  },
  text: {
    source: { 'text-out': 'out', out: 'out' },
    target: { 'text-in': 'in', in: 'in' },
  },
  image: {
    source: { 'image-out': 'out', out: 'out' },
    target: { 'image-in': 'in', in: 'in' },
  },
  upscaler: {
    source: { 'image-out': 'out', out: 'out' },
    target: { 'image-in': 'in', in: 'in' },
  },
  video: {
    source: { out: 'video-out', 'video-out': 'video-out' },
    target: {
      in: 'in',
      'prompt-in': 'in', // Legacy: map old prompt-in to new unified input
      'image-in': 'in', // Legacy: map old image-in to new unified input
      'video-in': 'in', // Legacy: map old video-in to new unified input
    },
  },
  audio: {
    source: { 'audio-out': 'out', out: 'out' },
    target: { 'text-in': 'in', 'prompt-in': 'in', in: 'in' },
  },
  media: {
    source: { out: 'out' },
    target: { in: 'in' },
  },
  chip: {
    source: { out: 'out' },
    target: {},
  },
};

// ============================================================================
// Assistant Configuration
// ============================================================================

export const ASSISTANT_ALLOWED_NODE_TYPES = [
  'text',
  'image',
  'upscaler',
  'video',
  'audio',
  'media',
  'chip',
  'display-text',
  'markdown',
];

// ============================================================================
// Storage Keys
// ============================================================================

export const TEMPLATE_STORAGE_KEY = 'noder-workflow-templates';

// ============================================================================
// Node Types
// ============================================================================

export const PREVIEW_NODE_TYPES = new Set(['text', 'image', 'upscaler', 'video', 'audio']);

// ============================================================================
// Light Theme List (for theme detection)
// ============================================================================

export const LIGHT_THEMES = [
  'github',
  'cream',
  'solarized-light',
  'paper',
  'snow',
  'sand',
  'rose-pine-dawn',
  'latte',
  'peach',
  'sage',
  'lilac',
  'seafoam',
  'apricot',
  'clay',
  'blossom',
  'honey',
  'mist',
  'matcha',
];
