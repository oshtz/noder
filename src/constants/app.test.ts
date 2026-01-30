/**
 * Tests for app constants
 */

import { describe, it, expect } from 'vitest';
import {
  LEGACY_HANDLE_ALIASES,
  ASSISTANT_ALLOWED_NODE_TYPES,
  TEMPLATE_STORAGE_KEY,
  PREVIEW_NODE_TYPES,
  LIGHT_THEMES,
} from './app';

describe('app constants', () => {
  describe('LEGACY_HANDLE_ALIASES', () => {
    it('should be defined', () => {
      expect(LEGACY_HANDLE_ALIASES).toBeDefined();
    });

    it('should have aliases for display-text node', () => {
      expect(LEGACY_HANDLE_ALIASES['display-text']).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES['display-text'].source.out).toBe('text-out');
      expect(LEGACY_HANDLE_ALIASES['display-text'].target.in).toBe('text-in');
    });

    it('should have aliases for text node', () => {
      expect(LEGACY_HANDLE_ALIASES.text).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES.text.source['text-out']).toBe('out');
      expect(LEGACY_HANDLE_ALIASES.text.target['text-in']).toBe('in');
    });

    it('should have aliases for image node', () => {
      expect(LEGACY_HANDLE_ALIASES.image).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES.image.source['image-out']).toBe('out');
      expect(LEGACY_HANDLE_ALIASES.image.target['image-in']).toBe('in');
    });

    it('should have aliases for upscaler node', () => {
      expect(LEGACY_HANDLE_ALIASES.upscaler).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES.upscaler.source['image-out']).toBe('out');
      expect(LEGACY_HANDLE_ALIASES.upscaler.target['image-in']).toBe('in');
    });

    it('should have aliases for video node', () => {
      expect(LEGACY_HANDLE_ALIASES.video).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES.video.source.out).toBe('video-out');
      expect(LEGACY_HANDLE_ALIASES.video.target.in).toBe('in');
      // Legacy handle IDs should map to unified 'in' handle
      expect(LEGACY_HANDLE_ALIASES.video.target['prompt-in']).toBe('in');
      expect(LEGACY_HANDLE_ALIASES.video.target['image-in']).toBe('in');
      expect(LEGACY_HANDLE_ALIASES.video.target['video-in']).toBe('in');
    });

    it('should have aliases for audio node', () => {
      expect(LEGACY_HANDLE_ALIASES.audio).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES.audio.source['audio-out']).toBe('out');
      expect(LEGACY_HANDLE_ALIASES.audio.target['text-in']).toBe('in');
      expect(LEGACY_HANDLE_ALIASES.audio.target['prompt-in']).toBe('in');
    });

    it('should have aliases for media node', () => {
      expect(LEGACY_HANDLE_ALIASES.media).toBeDefined();
      expect(LEGACY_HANDLE_ALIASES.media.source.out).toBe('out');
      expect(LEGACY_HANDLE_ALIASES.media.target.in).toBe('in');
    });

    it('should have all expected node types', () => {
      const expectedTypes = [
        'display-text',
        'text',
        'image',
        'upscaler',
        'video',
        'audio',
        'media',
      ];
      expectedTypes.forEach((type) => {
        expect(LEGACY_HANDLE_ALIASES[type]).toBeDefined();
      });
    });
  });

  describe('ASSISTANT_ALLOWED_NODE_TYPES', () => {
    it('should be an array', () => {
      expect(Array.isArray(ASSISTANT_ALLOWED_NODE_TYPES)).toBe(true);
    });

    it('should contain expected node types', () => {
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('text');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('image');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('upscaler');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('video');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('audio');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('media');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('chip');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('display-text');
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toContain('markdown');
    });

    it('should have 9 node types', () => {
      expect(ASSISTANT_ALLOWED_NODE_TYPES).toHaveLength(9);
    });
  });

  describe('TEMPLATE_STORAGE_KEY', () => {
    it('should be a non-empty string', () => {
      expect(typeof TEMPLATE_STORAGE_KEY).toBe('string');
      expect(TEMPLATE_STORAGE_KEY.length).toBeGreaterThan(0);
    });

    it('should have the expected value', () => {
      expect(TEMPLATE_STORAGE_KEY).toBe('noder-workflow-templates');
    });
  });

  describe('PREVIEW_NODE_TYPES', () => {
    it('should be a Set', () => {
      expect(PREVIEW_NODE_TYPES).toBeInstanceOf(Set);
    });

    it('should contain text node type', () => {
      expect(PREVIEW_NODE_TYPES.has('text')).toBe(true);
    });

    it('should contain image node type', () => {
      expect(PREVIEW_NODE_TYPES.has('image')).toBe(true);
    });

    it('should contain upscaler node type', () => {
      expect(PREVIEW_NODE_TYPES.has('upscaler')).toBe(true);
    });

    it('should contain video node type', () => {
      expect(PREVIEW_NODE_TYPES.has('video')).toBe(true);
    });

    it('should contain audio node type', () => {
      expect(PREVIEW_NODE_TYPES.has('audio')).toBe(true);
    });

    it('should have 5 node types', () => {
      expect(PREVIEW_NODE_TYPES.size).toBe(5);
    });

    it('should not contain non-preview node types', () => {
      expect(PREVIEW_NODE_TYPES.has('display-text')).toBe(false);
      expect(PREVIEW_NODE_TYPES.has('markdown')).toBe(false);
      expect(PREVIEW_NODE_TYPES.has('media')).toBe(false);
      expect(PREVIEW_NODE_TYPES.has('group')).toBe(false);
    });
  });

  describe('LIGHT_THEMES', () => {
    it('should be an array', () => {
      expect(Array.isArray(LIGHT_THEMES)).toBe(true);
    });

    it('should contain github theme', () => {
      expect(LIGHT_THEMES).toContain('github');
    });

    it('should contain cream theme', () => {
      expect(LIGHT_THEMES).toContain('cream');
    });

    it('should contain solarized-light theme', () => {
      expect(LIGHT_THEMES).toContain('solarized-light');
    });

    it('should contain paper theme', () => {
      expect(LIGHT_THEMES).toContain('paper');
    });

    it('should contain snow theme', () => {
      expect(LIGHT_THEMES).toContain('snow');
    });

    it('should contain rose-pine-dawn theme', () => {
      expect(LIGHT_THEMES).toContain('rose-pine-dawn');
    });

    it('should contain latte theme', () => {
      expect(LIGHT_THEMES).toContain('latte');
    });

    it('should contain matcha theme', () => {
      expect(LIGHT_THEMES).toContain('matcha');
    });

    it('should have 18 light themes', () => {
      expect(LIGHT_THEMES).toHaveLength(18);
    });

    it('should not contain dark themes', () => {
      expect(LIGHT_THEMES).not.toContain('dark');
      expect(LIGHT_THEMES).not.toContain('monochrome');
      expect(LIGHT_THEMES).not.toContain('dracula');
      expect(LIGHT_THEMES).not.toContain('monokai');
    });

    it('should have all unique values', () => {
      const uniqueThemes = new Set(LIGHT_THEMES);
      expect(uniqueThemes.size).toBe(LIGHT_THEMES.length);
    });
  });
});
