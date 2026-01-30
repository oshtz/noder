import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantModel, MODEL_CATALOG, type ModelCatalogEntry } from './useAssistantModel';

// Mock openrouterModelCache
vi.mock('../utils/openrouterModelCache', () => ({
  getTextModels: vi.fn(() =>
    Promise.resolve({
      models: [],
      fromCache: false,
    })
  ),
  unsubscribe: vi.fn(),
  toModelCatalogEntry: vi.fn((model) => ({
    id: model.id,
    label: model.name,
    provider: model.provider || 'OpenAI',
    tags: model.tags || ['text'],
    featured: model.featured || false,
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useAssistantModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Silence console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('should initialize with default model', () => {
      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.model).toBe('openai/gpt-5.2');
    });

    it('should initialize with custom default model', () => {
      const { result } = renderHook(() =>
        useAssistantModel({ defaultModel: 'anthropic/claude-3.5-sonnet' })
      );
      expect(result.current.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should initialize with model picker closed', () => {
      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.modelPickerOpen).toBe(false);
    });

    it('should initialize with "All" provider filter', () => {
      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.modelProvider).toBe('All');
    });

    it('should initialize with empty recent models when localStorage is empty', () => {
      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.recentModels).toEqual([]);
    });

    it('should load recent models from localStorage', () => {
      localStorageMock.setItem(
        'assistant-recent-models',
        JSON.stringify(['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'])
      );

      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.recentModels).toEqual(['openai/gpt-4o', 'anthropic/claude-3.5-sonnet']);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorageMock.setItem('assistant-recent-models', 'invalid-json');

      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.recentModels).toEqual([]);
    });

    it('should handle non-array data in localStorage', () => {
      localStorageMock.setItem('assistant-recent-models', JSON.stringify({ key: 'value' }));

      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.recentModels).toEqual([]);
    });

    it('should filter non-string entries from localStorage', () => {
      localStorageMock.setItem(
        'assistant-recent-models',
        JSON.stringify(['valid-model', 123, null, 'another-model', { id: 'object' }])
      );

      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.recentModels).toEqual(['valid-model', 'another-model']);
    });

    it('should initialize modelPickerRef', () => {
      const { result } = renderHook(() => useAssistantModel());
      expect(result.current.modelPickerRef).toBeDefined();
      expect(result.current.modelPickerRef.current).toBe(null);
    });

    it('should initialize isLoadingModels based on loadDynamicModels option', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));
      expect(result.current.isLoadingModels).toBe(false);
    });
  });

  // ===========================================================================
  // Model State Tests
  // ===========================================================================

  describe('model state', () => {
    it('should update model with setModel', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModel('anthropic/claude-3-haiku');
      });

      expect(result.current.model).toBe('anthropic/claude-3-haiku');
    });

    it('should update activeModelId when model changes', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModel('google/gemini-2.0-flash');
      });

      expect(result.current.activeModelId).toBe('google/gemini-2.0-flash');
    });

    it('should trim model for activeModelId', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModel('  openai/gpt-4o  ');
      });

      expect(result.current.activeModelId).toBe('openai/gpt-4o');
    });

    it('should update modelQuery when model changes', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModel('deepseek/deepseek-r1');
      });

      expect(result.current.modelQuery).toBe('deepseek/deepseek-r1');
    });
  });

  // ===========================================================================
  // Model Picker State Tests
  // ===========================================================================

  describe('model picker state', () => {
    it('should open model picker', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModelPickerOpen(true);
      });

      expect(result.current.modelPickerOpen).toBe(true);
    });

    it('should close model picker', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModelPickerOpen(true);
      });

      act(() => {
        result.current.setModelPickerOpen(false);
      });

      expect(result.current.modelPickerOpen).toBe(false);
    });
  });

  // ===========================================================================
  // Provider Filter Tests
  // ===========================================================================

  describe('provider filter', () => {
    it('should update model provider filter', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModelProvider('OpenAI');
      });

      expect(result.current.modelProvider).toBe('OpenAI');
    });

    it('should filter models by provider', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel(''); // Clear search filter
        result.current.setModelProvider('OpenAI');
      });

      const openaiModels = result.current.filteredModels;
      expect(openaiModels.every((m) => m.provider === 'OpenAI')).toBe(true);
    });

    it('should show all models when provider is "All"', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel(''); // Clear search filter
        result.current.setModelProvider('All');
      });

      expect(result.current.filteredModels.length).toBe(MODEL_CATALOG.length);
    });

    it('should include "All" in provider options', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));
      expect(result.current.providerOptions).toContain('All');
    });

    it('should include all unique providers in options', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));
      const options = result.current.providerOptions;

      expect(options).toContain('OpenAI');
      expect(options).toContain('Anthropic');
      expect(options).toContain('Google');
      expect(options).toContain('Meta');
      expect(options).toContain('Mistral');
      expect(options).toContain('DeepSeek');
      expect(options).toContain('Qwen');
      expect(options).toContain('Ollama');
      expect(options).toContain('LM Studio');
    });

    it('providerMatches should return true for "All" provider', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      const entry: ModelCatalogEntry = {
        id: 'test/model',
        label: 'Test Model',
        provider: 'SomeProvider',
        tags: [],
        featured: false,
      };

      expect(result.current.providerMatches(entry)).toBe(true);
    });

    it('providerMatches should return true when entry matches provider filter', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModelProvider('OpenAI');
      });

      const entry: ModelCatalogEntry = {
        id: 'openai/gpt-4',
        label: 'GPT-4',
        provider: 'OpenAI',
        tags: [],
        featured: false,
      };

      expect(result.current.providerMatches(entry)).toBe(true);
    });

    it('providerMatches should return false when entry does not match provider filter', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModelProvider('OpenAI');
      });

      const entry: ModelCatalogEntry = {
        id: 'anthropic/claude',
        label: 'Claude',
        provider: 'Anthropic',
        tags: [],
        featured: false,
      };

      expect(result.current.providerMatches(entry)).toBe(false);
    });
  });

  // ===========================================================================
  // Recent Models Tests
  // ===========================================================================

  describe('recent models', () => {
    it('should remember a model', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('openai/gpt-4o');
      });

      expect(result.current.recentModels).toContain('openai/gpt-4o');
    });

    it('should add new models to the beginning', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('model-1');
        result.current.rememberModel('model-2');
      });

      expect(result.current.recentModels[0]).toBe('model-2');
      expect(result.current.recentModels[1]).toBe('model-1');
    });

    it('should not duplicate existing models', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('model-1');
        result.current.rememberModel('model-2');
        result.current.rememberModel('model-1');
      });

      expect(result.current.recentModels.filter((m) => m === 'model-1').length).toBe(1);
      expect(result.current.recentModels[0]).toBe('model-1');
    });

    it('should limit recent models to maxRecentModels', () => {
      const { result } = renderHook(() => useAssistantModel({ maxRecentModels: 3 }));

      act(() => {
        result.current.rememberModel('model-1');
        result.current.rememberModel('model-2');
        result.current.rememberModel('model-3');
        result.current.rememberModel('model-4');
      });

      expect(result.current.recentModels.length).toBe(3);
      expect(result.current.recentModels).not.toContain('model-1');
    });

    it('should use default max of 6 recent models', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        for (let i = 1; i <= 10; i++) {
          result.current.rememberModel(`model-${i}`);
        }
      });

      expect(result.current.recentModels.length).toBe(6);
    });

    it('should not remember empty model IDs', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('');
      });

      expect(result.current.recentModels.length).toBe(0);
    });

    it('should not remember whitespace-only model IDs', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('   ');
      });

      expect(result.current.recentModels.length).toBe(0);
    });

    it('should trim model IDs before remembering', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('  openai/gpt-4o  ');
      });

      expect(result.current.recentModels[0]).toBe('openai/gpt-4o');
    });

    it('should persist recent models to localStorage', async () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('openai/gpt-4o');
      });

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'assistant-recent-models',
          expect.stringContaining('openai/gpt-4o')
        );
      });
    });
  });

  // ===========================================================================
  // Recent Entries Tests
  // ===========================================================================

  describe('recent entries', () => {
    it('should return ModelCatalogEntry for recent models in catalog', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.rememberModel('openai/gpt-4.1');
      });

      const entry = result.current.recentEntries[0];
      expect(entry.id).toBe('openai/gpt-4.1');
      expect(entry.label).toBe('GPT-4.1');
      expect(entry.provider).toBe('OpenAI');
    });

    it('should create custom entry for models not in catalog', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.rememberModel('custom/my-model');
      });

      const entry = result.current.recentEntries[0];
      expect(entry.id).toBe('custom/my-model');
      expect(entry.label).toBe('custom/my-model');
      expect(entry.provider).toBe('Custom');
      expect(entry.tags).toEqual(['custom']);
      expect(entry.featured).toBe(false);
    });
  });

  // ===========================================================================
  // Handle Select Model Tests
  // ===========================================================================

  describe('handleSelectModel', () => {
    it('should update model when selected', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.handleSelectModel('anthropic/claude-3.5-sonnet');
      });

      expect(result.current.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should close model picker when model is selected', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModelPickerOpen(true);
      });

      act(() => {
        result.current.handleSelectModel('anthropic/claude-3.5-sonnet');
      });

      expect(result.current.modelPickerOpen).toBe(false);
    });

    it('should remember selected model', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.handleSelectModel('google/gemini-2.0-flash');
      });

      expect(result.current.recentModels).toContain('google/gemini-2.0-flash');
    });
  });

  // ===========================================================================
  // Handle Model Input Change Tests
  // ===========================================================================

  describe('handleModelInputChange', () => {
    it('should update model on input change', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.handleModelInputChange('gpt');
      });

      expect(result.current.model).toBe('gpt');
    });

    it('should open model picker on input change', () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.handleModelInputChange('claude');
      });

      expect(result.current.modelPickerOpen).toBe(true);
    });
  });

  // ===========================================================================
  // Filtered Models Tests
  // ===========================================================================

  describe('filtered models', () => {
    it('should filter models by search query', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('gpt');
      });

      const filtered = result.current.filteredModels;
      expect(filtered.every((m) => m.id.toLowerCase().includes('gpt'))).toBe(true);
    });

    it('should search by label', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('Gemini');
      });

      const filtered = result.current.filteredModels;
      expect(filtered.some((m) => m.label.toLowerCase().includes('gemini'))).toBe(true);
    });

    it('should search by provider', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('anthropic');
      });

      const filtered = result.current.filteredModels;
      expect(filtered.some((m) => m.provider === 'Anthropic')).toBe(true);
    });

    it('should search by tags', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('reasoning');
      });

      const filtered = result.current.filteredModels;
      expect(filtered.some((m) => m.tags.includes('reasoning'))).toBe(true);
    });

    it('should combine provider filter and search query', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModelProvider('OpenAI');
        result.current.setModel('gpt');
      });

      const filtered = result.current.filteredModels;
      expect(filtered.every((m) => m.provider === 'OpenAI')).toBe(true);
      expect(filtered.every((m) => m.id.toLowerCase().includes('gpt'))).toBe(true);
    });

    it('should return empty array when no models match', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('nonexistent-model-xyz');
      });

      expect(result.current.filteredModels.length).toBe(0);
    });

    it('should be case insensitive', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('GPT');
      });

      const filteredUpper = result.current.filteredModels;

      act(() => {
        result.current.setModel('gpt');
      });

      const filteredLower = result.current.filteredModels;

      expect(filteredUpper.length).toBe(filteredLower.length);
    });
  });

  // ===========================================================================
  // Featured Models Tests
  // ===========================================================================

  describe('featured models', () => {
    it('should return only featured models', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      const featured = result.current.featuredModels;
      expect(featured.every((m) => m.featured === true)).toBe(true);
    });

    it('should include known featured models', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      const featured = result.current.featuredModels;
      const featuredIds = featured.map((m) => m.id);

      expect(featuredIds).toContain('openrouter/auto');
      expect(featuredIds).toContain('openai/gpt-5.2');
      expect(featuredIds).toContain('anthropic/claude-3.7-sonnet');
    });

    it('should not include non-featured models', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      const featured = result.current.featuredModels;
      const featuredIds = featured.map((m) => m.id);

      expect(featuredIds).not.toContain('anthropic/claude-3-haiku');
      expect(featuredIds).not.toContain('google/gemini-1.5-flash');
    });
  });

  // ===========================================================================
  // Show Custom Option Tests
  // ===========================================================================

  describe('show custom option', () => {
    it('should show custom option when query has no match', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('my-custom-model');
      });

      expect(result.current.showCustomOption).toBe(true);
    });

    it('should not show custom option when query matches existing model', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('openai/gpt-5.2');
      });

      expect(result.current.showCustomOption).toBe(false);
    });

    it('should not show custom option when query is empty', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('');
      });

      expect(result.current.showCustomOption).toBe(false);
    });

    it('should not show custom option when query is whitespace only', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      act(() => {
        result.current.setModel('   ');
      });

      expect(result.current.showCustomOption).toBe(false);
    });
  });

  // ===========================================================================
  // Model Catalog Tests
  // ===========================================================================

  describe('model catalog', () => {
    it('should export MODEL_CATALOG constant', () => {
      expect(MODEL_CATALOG).toBeDefined();
      expect(Array.isArray(MODEL_CATALOG)).toBe(true);
    });

    it('should include OpenAI models', () => {
      const openaiModels = MODEL_CATALOG.filter((m) => m.provider === 'OpenAI');
      expect(openaiModels.length).toBeGreaterThan(0);
    });

    it('should include Anthropic models', () => {
      const anthropicModels = MODEL_CATALOG.filter((m) => m.provider === 'Anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);
    });

    it('should include Google models', () => {
      const googleModels = MODEL_CATALOG.filter((m) => m.provider === 'Google');
      expect(googleModels.length).toBeGreaterThan(0);
    });

    it('should include local provider models (Ollama)', () => {
      const ollamaModels = MODEL_CATALOG.filter((m) => m.provider === 'Ollama');
      expect(ollamaModels.length).toBeGreaterThan(0);
    });

    it('should include LM Studio models', () => {
      const lmStudioModels = MODEL_CATALOG.filter((m) => m.provider === 'LM Studio');
      expect(lmStudioModels.length).toBeGreaterThan(0);
    });

    it('each catalog entry should have required fields', () => {
      MODEL_CATALOG.forEach((entry) => {
        expect(entry.id).toBeDefined();
        expect(entry.label).toBeDefined();
        expect(entry.provider).toBeDefined();
        expect(entry.tags).toBeDefined();
        expect(typeof entry.featured).toBe('boolean');
      });
    });
  });

  // ===========================================================================
  // Dynamic Models Loading Tests
  // ===========================================================================

  describe('dynamic models loading', () => {
    it('should call getTextModels when loadDynamicModels is true', async () => {
      const { getTextModels } = await import('../utils/openrouterModelCache');

      renderHook(() => useAssistantModel({ loadDynamicModels: true }));

      await waitFor(() => {
        expect(getTextModels).toHaveBeenCalled();
      });
    });

    it('should not call getTextModels when loadDynamicModels is false', async () => {
      const { getTextModels } = await import('../utils/openrouterModelCache');
      vi.mocked(getTextModels).mockClear();

      renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      // Give it some time to see if it would be called
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(getTextModels).not.toHaveBeenCalled();
    });

    it('should set isLoadingModels to true during fetch', async () => {
      const { getTextModels } = await import('../utils/openrouterModelCache');

      let resolvePromise: (value: { models: []; fromCache: boolean }) => void;
      vi.mocked(getTextModels).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: true }));

      // Loading should be true initially
      await waitFor(() => {
        expect(result.current.isLoadingModels).toBe(true);
      });

      // Resolve the promise
      act(() => {
        resolvePromise!({ models: [], fromCache: false });
      });

      await waitFor(() => {
        expect(result.current.isLoadingModels).toBe(false);
      });
    });

    it('should handle fetch error gracefully', async () => {
      const { getTextModels } = await import('../utils/openrouterModelCache');
      vi.mocked(getTextModels).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: true }));

      await waitFor(() => {
        expect(result.current.isLoadingModels).toBe(false);
      });

      // Should fallback to static catalog
      expect(result.current.modelCatalog.length).toBeGreaterThan(0);
    });

    it('should merge dynamic models with static local models', async () => {
      const { getTextModels, toModelCatalogEntry } = await import('../utils/openrouterModelCache');

      const dynamicModels = [
        { id: 'dynamic/model-1', name: 'Dynamic Model 1', provider: 'DynamicProvider' },
        { id: 'dynamic/model-2', name: 'Dynamic Model 2', provider: 'DynamicProvider' },
      ];

      vi.mocked(getTextModels).mockResolvedValue({
        models: dynamicModels as any,
        fromCache: false,
      });

      vi.mocked(toModelCatalogEntry).mockImplementation((model: any) => ({
        id: model.id,
        label: model.name,
        provider: model.provider,
        tags: ['dynamic'],
        featured: false,
      }));

      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: true }));

      await waitFor(() => {
        expect(result.current.isLoadingModels).toBe(false);
      });

      // Should include dynamic models
      expect(result.current.modelCatalog.some((m) => m.id === 'dynamic/model-1')).toBe(true);

      // Should still include local providers (Ollama, LM Studio)
      expect(result.current.modelCatalog.some((m) => m.provider === 'Ollama')).toBe(true);
      expect(result.current.modelCatalog.some((m) => m.provider === 'LM Studio')).toBe(true);
    });

    it('should use static catalog when no dynamic models loaded', () => {
      const { result } = renderHook(() => useAssistantModel({ loadDynamicModels: false }));

      expect(result.current.modelCatalog).toEqual(MODEL_CATALOG);
    });

    it('should call unsubscribe on cleanup', async () => {
      const { unsubscribe } = await import('../utils/openrouterModelCache');

      const { unmount } = renderHook(() => useAssistantModel({ loadDynamicModels: true }));

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Outside Click Handler Tests
  // ===========================================================================

  describe('outside click handler', () => {
    it('should close picker when clicking outside and ref is set', async () => {
      const { result } = renderHook(() => useAssistantModel());

      // Create a container element and assign it to the ref
      const containerDiv = document.createElement('div');
      document.body.appendChild(containerDiv);

      act(() => {
        result.current.setModelPickerOpen(true);
        // Manually set the ref to simulate it being attached to a DOM element
        (result.current.modelPickerRef as React.MutableRefObject<HTMLDivElement | null>).current =
          containerDiv;
      });

      // Simulate click outside the container
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);

      act(() => {
        const event = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, 'target', { value: outsideElement });
        document.dispatchEvent(event);
      });

      expect(result.current.modelPickerOpen).toBe(false);

      // Cleanup
      document.body.removeChild(containerDiv);
      document.body.removeChild(outsideElement);
    });

    it('should not close picker when clicking inside the container', async () => {
      const { result } = renderHook(() => useAssistantModel());

      // Create a container element and a child element
      const containerDiv = document.createElement('div');
      const childDiv = document.createElement('div');
      containerDiv.appendChild(childDiv);
      document.body.appendChild(containerDiv);

      act(() => {
        result.current.setModelPickerOpen(true);
        (result.current.modelPickerRef as React.MutableRefObject<HTMLDivElement | null>).current =
          containerDiv;
      });

      // Simulate click inside the container
      act(() => {
        const event = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, 'target', { value: childDiv });
        document.dispatchEvent(event);
      });

      expect(result.current.modelPickerOpen).toBe(true);

      // Cleanup
      document.body.removeChild(containerDiv);
    });

    it('should not add listener when picker is closed', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useAssistantModel());

      // Should not add mousedown listener when picker is closed
      expect(addEventListenerSpy.mock.calls.filter((call) => call[0] === 'mousedown').length).toBe(
        0
      );
    });

    it('should remove listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { result, unmount } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.setModelPickerOpen(true);
      });

      unmount();

      expect(
        removeEventListenerSpy.mock.calls.filter((call) => call[0] === 'mousedown').length
      ).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // LocalStorage Persistence Tests
  // ===========================================================================

  describe('localStorage persistence', () => {
    it('should save recent models to localStorage', async () => {
      const { result } = renderHook(() => useAssistantModel());

      act(() => {
        result.current.rememberModel('openai/gpt-4o');
        result.current.rememberModel('anthropic/claude-3.5-sonnet');
      });

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'assistant-recent-models',
          expect.any(String)
        );
      });

      // Verify the saved data
      const lastCall =
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1];
      const savedData = JSON.parse(lastCall[1]);
      expect(savedData).toContain('anthropic/claude-3.5-sonnet');
      expect(savedData).toContain('openai/gpt-4o');
    });

    it('should respect maxRecentModels when persisting', async () => {
      const { result } = renderHook(() => useAssistantModel({ maxRecentModels: 2 }));

      act(() => {
        result.current.rememberModel('model-1');
        result.current.rememberModel('model-2');
        result.current.rememberModel('model-3');
      });

      await waitFor(() => {
        const lastCall =
          localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1];
        const savedData = JSON.parse(lastCall[1]);
        expect(savedData.length).toBe(2);
      });
    });

    it('should handle localStorage setItem failure gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result } = renderHook(() => useAssistantModel());

      // Should not throw
      act(() => {
        result.current.rememberModel('openai/gpt-4o');
      });

      // State should still be updated even if storage fails
      expect(result.current.recentModels).toContain('openai/gpt-4o');
    });
  });

  // ===========================================================================
  // Return Value Shape Tests
  // ===========================================================================

  describe('return value shape', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useAssistantModel());

      expect(result.current).toHaveProperty('model');
      expect(result.current).toHaveProperty('setModel');
      expect(result.current).toHaveProperty('modelPickerOpen');
      expect(result.current).toHaveProperty('setModelPickerOpen');
      expect(result.current).toHaveProperty('modelProvider');
      expect(result.current).toHaveProperty('setModelProvider');
      expect(result.current).toHaveProperty('recentModels');
      expect(result.current).toHaveProperty('rememberModel');
      expect(result.current).toHaveProperty('handleSelectModel');
      expect(result.current).toHaveProperty('handleModelInputChange');
      expect(result.current).toHaveProperty('providerOptions');
      expect(result.current).toHaveProperty('featuredModels');
      expect(result.current).toHaveProperty('filteredModels');
      expect(result.current).toHaveProperty('recentEntries');
      expect(result.current).toHaveProperty('modelQuery');
      expect(result.current).toHaveProperty('showCustomOption');
      expect(result.current).toHaveProperty('providerMatches');
      expect(result.current).toHaveProperty('activeModelId');
      expect(result.current).toHaveProperty('modelPickerRef');
      expect(result.current).toHaveProperty('isLoadingModels');
      expect(result.current).toHaveProperty('modelCatalog');
    });

    it('should return functions for all setters and handlers', () => {
      const { result } = renderHook(() => useAssistantModel());

      expect(typeof result.current.setModel).toBe('function');
      expect(typeof result.current.setModelPickerOpen).toBe('function');
      expect(typeof result.current.setModelProvider).toBe('function');
      expect(typeof result.current.rememberModel).toBe('function');
      expect(typeof result.current.handleSelectModel).toBe('function');
      expect(typeof result.current.handleModelInputChange).toBe('function');
      expect(typeof result.current.providerMatches).toBe('function');
    });

    it('should return arrays for list properties', () => {
      const { result } = renderHook(() => useAssistantModel());

      expect(Array.isArray(result.current.recentModels)).toBe(true);
      expect(Array.isArray(result.current.providerOptions)).toBe(true);
      expect(Array.isArray(result.current.featuredModels)).toBe(true);
      expect(Array.isArray(result.current.filteredModels)).toBe(true);
      expect(Array.isArray(result.current.recentEntries)).toBe(true);
      expect(Array.isArray(result.current.modelCatalog)).toBe(true);
    });
  });
});
