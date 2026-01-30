import { describe, expect, it } from 'vitest';
import { HANDLE_TYPES, getHandleColor, areTypesCompatible, getAllTypes } from './handleTypes';

describe('HANDLE_TYPES', () => {
  it('should define all core data types', () => {
    expect(HANDLE_TYPES.TEXT).toBeDefined();
    expect(HANDLE_TYPES.IMAGE).toBeDefined();
    expect(HANDLE_TYPES.VIDEO).toBeDefined();
    expect(HANDLE_TYPES.AUDIO).toBeDefined();
    expect(HANDLE_TYPES.MODEL).toBeDefined();
  });

  it('should have correct structure for each type', () => {
    Object.values(HANDLE_TYPES).forEach((handleType) => {
      expect(handleType).toHaveProperty('type');
      expect(handleType).toHaveProperty('dataType');
      expect(handleType).toHaveProperty('color');
      expect(handleType).toHaveProperty('label');
    });
  });

  it('should have unique colors for each type', () => {
    const colors = Object.values(HANDLE_TYPES).map((t) => t.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });
});

describe('getHandleColor', () => {
  it('should return correct color for text type', () => {
    expect(getHandleColor('text')).toBe('#2196F3');
  });

  it('should return correct color for image type', () => {
    expect(getHandleColor('image')).toBe('#f97316');
  });

  it('should return correct color for video type', () => {
    expect(getHandleColor('video')).toBe('#14b8a6');
  });

  it('should return correct color for audio type', () => {
    expect(getHandleColor('audio')).toBe('#ec4899');
  });

  it('should return correct color for model type', () => {
    expect(getHandleColor('model')).toBe('#a855f7');
  });

  it('should handle legacy string type as text', () => {
    expect(getHandleColor('string')).toBe('#2196F3');
  });

  it('should return fallback color for unknown types', () => {
    expect(getHandleColor('unknown')).toBe('var(--primary-color)');
    expect(getHandleColor('invalid')).toBe('var(--primary-color)');
  });

  it('should handle undefined and null gracefully', () => {
    expect(getHandleColor(undefined)).toBe('var(--primary-color)');
    expect(getHandleColor(null)).toBe('var(--primary-color)');
  });
});

describe('areTypesCompatible', () => {
  describe('exact matches', () => {
    it('should allow same type connections', () => {
      expect(areTypesCompatible('text', 'text')).toBe(true);
      expect(areTypesCompatible('image', 'image')).toBe(true);
      expect(areTypesCompatible('video', 'video')).toBe(true);
      expect(areTypesCompatible('audio', 'audio')).toBe(true);
      expect(areTypesCompatible('model', 'model')).toBe(true);
    });
  });

  describe('any type', () => {
    it('should allow any type as source to connect to any target', () => {
      expect(areTypesCompatible('any', 'text')).toBe(true);
      expect(areTypesCompatible('any', 'image')).toBe(true);
      expect(areTypesCompatible('any', 'video')).toBe(true);
      expect(areTypesCompatible('any', 'audio')).toBe(true);
    });

    it('should allow any source to connect to any type target', () => {
      expect(areTypesCompatible('text', 'any')).toBe(true);
      expect(areTypesCompatible('image', 'any')).toBe(true);
      expect(areTypesCompatible('video', 'any')).toBe(true);
      expect(areTypesCompatible('audio', 'any')).toBe(true);
    });

    it('should allow any to any connection', () => {
      expect(areTypesCompatible('any', 'any')).toBe(true);
    });
  });

  describe('legacy compatibility', () => {
    it('should treat string and text as compatible', () => {
      expect(areTypesCompatible('string', 'text')).toBe(true);
      expect(areTypesCompatible('text', 'string')).toBe(true);
    });
  });

  describe('incompatible types', () => {
    it('should not allow text to image connection', () => {
      expect(areTypesCompatible('text', 'image')).toBe(false);
    });

    it('should not allow image to text connection', () => {
      expect(areTypesCompatible('image', 'text')).toBe(false);
    });

    it('should not allow video to audio connection', () => {
      expect(areTypesCompatible('video', 'audio')).toBe(false);
    });

    it('should not allow audio to video connection', () => {
      expect(areTypesCompatible('audio', 'video')).toBe(false);
    });

    it('should not allow model to text connection', () => {
      expect(areTypesCompatible('model', 'text')).toBe(false);
    });

    it('should not allow cross-media connections', () => {
      expect(areTypesCompatible('image', 'video')).toBe(false);
      expect(areTypesCompatible('video', 'image')).toBe(false);
      expect(areTypesCompatible('image', 'audio')).toBe(false);
      expect(areTypesCompatible('audio', 'image')).toBe(false);
    });
  });
});

describe('getAllTypes', () => {
  it('should return all core types', () => {
    const types = getAllTypes();
    expect(types).toContain('text');
    expect(types).toContain('image');
    expect(types).toContain('video');
    expect(types).toContain('audio');
    expect(types).toContain('model');
  });

  it('should not include legacy string alias', () => {
    const types = getAllTypes();
    expect(types).not.toContain('string');
  });

  it('should return 5 core types', () => {
    expect(getAllTypes().length).toBe(5);
  });
});
