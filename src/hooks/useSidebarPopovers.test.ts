/**
 * Tests for useSidebarPopovers hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarPopovers, PopoverType } from './useSidebarPopovers';

// Mock ResizeObserver
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.ResizeObserver = mockResizeObserver;

describe('useSidebarPopovers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should initialize with null activePopover', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.activePopover).toBeNull();
    });

    it('should initialize with showNewWorkflowPopover as false', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.showNewWorkflowPopover).toBe(false);
    });

    it('should initialize with creatingWorkflow as false', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.creatingWorkflow).toBe(false);
    });

    it('should initialize with empty newWorkflowName', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.newWorkflowName).toBe('');
    });

    it('should initialize with selectedTemplateCategory as beginner', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.selectedTemplateCategory).toBe('beginner');
    });

    it('should initialize with templateIndicatorStyle with opacity 0', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.templateIndicatorStyle).toEqual({
        width: 0,
        transform: 'translateX(0px)',
        opacity: 0,
      });
    });

    it('should initialize with isGalleryDragging as false', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.isGalleryDragging).toBe(false);
    });

    it('should provide refs for template categories', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      expect(result.current.templateCategoriesRef).toBeDefined();
      expect(result.current.templateCategoryButtonRefs).toBeDefined();
    });
  });

  describe('setActivePopover', () => {
    it('should set active popover to workflows', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setActivePopover('workflows');
      });

      expect(result.current.activePopover).toBe('workflows');
    });

    it('should set active popover to templates', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setActivePopover('templates');
      });

      expect(result.current.activePopover).toBe('templates');
    });

    it('should set active popover to gallery', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setActivePopover('gallery');
      });

      expect(result.current.activePopover).toBe('gallery');
    });

    it('should set active popover to null', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setActivePopover('workflows');
      });

      act(() => {
        result.current.setActivePopover(null);
      });

      expect(result.current.activePopover).toBeNull();
    });
  });

  describe('togglePopover', () => {
    it('should open popover when closed', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.togglePopover('workflows');
      });

      expect(result.current.activePopover).toBe('workflows');
    });

    it('should close popover when already open', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.togglePopover('workflows');
      });

      act(() => {
        result.current.togglePopover('workflows');
      });

      expect(result.current.activePopover).toBeNull();
    });

    it('should switch to different popover', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.togglePopover('workflows');
      });

      act(() => {
        result.current.togglePopover('templates');
      });

      expect(result.current.activePopover).toBe('templates');
    });

    it('should toggle null popover to null', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.togglePopover(null);
      });

      expect(result.current.activePopover).toBeNull();
    });
  });

  describe('closePopover', () => {
    it('should close active popover', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setActivePopover('workflows');
      });

      act(() => {
        result.current.closePopover();
      });

      expect(result.current.activePopover).toBeNull();
    });

    it('should be idempotent when no popover is open', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.closePopover();
      });

      expect(result.current.activePopover).toBeNull();
    });
  });

  describe('new workflow popover state', () => {
    it('should set showNewWorkflowPopover', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setShowNewWorkflowPopover(true);
      });

      expect(result.current.showNewWorkflowPopover).toBe(true);
    });

    it('should set creatingWorkflow', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setCreatingWorkflow(true);
      });

      expect(result.current.creatingWorkflow).toBe(true);
    });

    it('should set newWorkflowName', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setNewWorkflowName('My Workflow');
      });

      expect(result.current.newWorkflowName).toBe('My Workflow');
    });
  });

  describe('resetNewWorkflowPopover', () => {
    it('should reset all new workflow popover state', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      // Set up some state
      act(() => {
        result.current.setShowNewWorkflowPopover(true);
        result.current.setCreatingWorkflow(true);
        result.current.setNewWorkflowName('Test Workflow');
      });

      expect(result.current.showNewWorkflowPopover).toBe(true);
      expect(result.current.creatingWorkflow).toBe(true);
      expect(result.current.newWorkflowName).toBe('Test Workflow');

      // Reset
      act(() => {
        result.current.resetNewWorkflowPopover();
      });

      expect(result.current.showNewWorkflowPopover).toBe(false);
      expect(result.current.creatingWorkflow).toBe(false);
      expect(result.current.newWorkflowName).toBe('');
    });

    it('should be idempotent on already reset state', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.resetNewWorkflowPopover();
      });

      expect(result.current.showNewWorkflowPopover).toBe(false);
      expect(result.current.creatingWorkflow).toBe(false);
      expect(result.current.newWorkflowName).toBe('');
    });
  });

  describe('template category', () => {
    it('should set selected template category', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setSelectedTemplateCategory('advanced');
      });

      expect(result.current.selectedTemplateCategory).toBe('advanced');
    });

    it('should update template indicator when category changes', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setSelectedTemplateCategory('intermediate');
      });

      expect(result.current.selectedTemplateCategory).toBe('intermediate');
    });
  });

  describe('gallery dragging state', () => {
    it('should set isGalleryDragging to true', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setIsGalleryDragging(true);
      });

      expect(result.current.isGalleryDragging).toBe(true);
    });

    it('should set isGalleryDragging to false', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setIsGalleryDragging(true);
      });

      act(() => {
        result.current.setIsGalleryDragging(false);
      });

      expect(result.current.isGalleryDragging).toBe(false);
    });
  });

  describe('updateTemplateIndicator', () => {
    it('should call updateTemplateIndicator without error', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      // Should not throw even without refs set up
      expect(() => {
        act(() => {
          result.current.updateTemplateIndicator();
        });
      }).not.toThrow();
    });

    it('should not update indicator style when refs are not set', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.updateTemplateIndicator();
      });

      // Style should remain at initial values when refs are not set
      expect(result.current.templateIndicatorStyle.opacity).toBe(0);
    });
  });

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() => useSidebarPopovers());

      const firstTogglePopover = result.current.togglePopover;
      const firstClosePopover = result.current.closePopover;
      const firstResetNewWorkflowPopover = result.current.resetNewWorkflowPopover;

      rerender();

      expect(result.current.togglePopover).toBe(firstTogglePopover);
      expect(result.current.closePopover).toBe(firstClosePopover);
      expect(result.current.resetNewWorkflowPopover).toBe(firstResetNewWorkflowPopover);
    });

    it('should maintain stable ref references', () => {
      const { result, rerender } = renderHook(() => useSidebarPopovers());

      const firstTemplateRef = result.current.templateCategoriesRef;
      const firstButtonRefs = result.current.templateCategoryButtonRefs;

      rerender();

      expect(result.current.templateCategoriesRef).toBe(firstTemplateRef);
      expect(result.current.templateCategoryButtonRefs).toBe(firstButtonRefs);
    });
  });

  describe('popover type transitions', () => {
    const popoverTypes: PopoverType[] = ['workflows', 'templates', 'gallery', null];

    it('should handle all popover type transitions', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      popoverTypes.forEach((from) => {
        popoverTypes.forEach((to) => {
          act(() => {
            result.current.setActivePopover(from);
          });
          expect(result.current.activePopover).toBe(from);

          act(() => {
            result.current.setActivePopover(to);
          });
          expect(result.current.activePopover).toBe(to);
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid popover toggles', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.togglePopover('workflows');
        });
      }

      // After even number of toggles, should be null
      expect(result.current.activePopover).toBeNull();
    });

    it('should handle empty string for newWorkflowName', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      act(() => {
        result.current.setNewWorkflowName('');
      });

      expect(result.current.newWorkflowName).toBe('');
    });

    it('should handle special characters in newWorkflowName', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      const specialName = 'Test <script>alert("xss")</script> Workflow';
      act(() => {
        result.current.setNewWorkflowName(specialName);
      });

      expect(result.current.newWorkflowName).toBe(specialName);
    });

    it('should handle unicode in newWorkflowName', () => {
      const { result } = renderHook(() => useSidebarPopovers());

      const unicodeName = 'Workflow \u00e9\u00e8\u00ea\u00eb';
      act(() => {
        result.current.setNewWorkflowName(unicodeName);
      });

      expect(result.current.newWorkflowName).toBe(unicodeName);
    });
  });
});
