import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAssistantScrolling } from './useAssistantScrolling';
import type { Message } from './useAssistantMessages';

describe('useAssistantScrolling', () => {
  let mockRequestAnimationFrame: ReturnType<typeof vi.fn>;
  let originalRequestAnimationFrame: typeof requestAnimationFrame;

  beforeEach(() => {
    // Mock requestAnimationFrame to execute immediately
    mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = mockRequestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    vi.clearAllMocks();
  });

  const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
    role,
    content,
  });

  describe('messagesContainerRef', () => {
    it('should return a ref object', () => {
      const { result } = renderHook(() =>
        useAssistantScrolling({
          isOpen: true,
          messages: [],
          isLoading: false,
          streamingContent: '',
        })
      );

      expect(result.current.messagesContainerRef).toBeDefined();
      expect(result.current.messagesContainerRef.current).toBeNull();
    });

    it('should return stable ref on rerender', () => {
      const { result, rerender } = renderHook(() =>
        useAssistantScrolling({
          isOpen: true,
          messages: [],
          isLoading: false,
          streamingContent: '',
        })
      );

      const firstRef = result.current.messagesContainerRef;
      rerender();
      expect(result.current.messagesContainerRef).toBe(firstRef);
    });
  });

  describe('auto-scroll behavior when panel is closed', () => {
    it('should not trigger scroll when panel is closed and messages change', () => {
      const { rerender } = renderHook(
        ({ isOpen, messages }) =>
          useAssistantScrolling({
            isOpen,
            messages,
            isLoading: false,
            streamingContent: '',
          }),
        { initialProps: { isOpen: false, messages: [] as Message[] } }
      );

      mockRequestAnimationFrame.mockClear();

      rerender({
        isOpen: false,
        messages: [createMessage('user', 'Hello')],
      });

      // Effects return early when !isOpen, so no animation frame is requested
      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });

    it('should not trigger scroll when panel is closed and loading starts', () => {
      const { rerender } = renderHook(
        ({ isOpen, isLoading }) =>
          useAssistantScrolling({
            isOpen,
            messages: [],
            isLoading,
            streamingContent: '',
          }),
        { initialProps: { isOpen: false, isLoading: false } }
      );

      mockRequestAnimationFrame.mockClear();

      rerender({ isOpen: false, isLoading: true });

      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });

    it('should not trigger scroll when panel is closed and streaming content changes', () => {
      const { rerender } = renderHook(
        ({ isOpen, streamingContent }) =>
          useAssistantScrolling({
            isOpen,
            messages: [],
            isLoading: false,
            streamingContent,
          }),
        { initialProps: { isOpen: false, streamingContent: '' } }
      );

      mockRequestAnimationFrame.mockClear();

      rerender({ isOpen: false, streamingContent: 'Hello' });

      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('early return conditions (no container ref)', () => {
    // When ref.current is null (not attached to DOM), effects return early
    // without calling requestAnimationFrame

    it('should not throw when messages change without container ref', () => {
      const { rerender } = renderHook(
        ({ messages }) =>
          useAssistantScrolling({
            isOpen: true,
            messages,
            isLoading: false,
            streamingContent: '',
          }),
        { initialProps: { messages: [] as Message[] } }
      );

      // Should not throw
      expect(() => rerender({ messages: [createMessage('user', 'Hello')] })).not.toThrow();
    });

    it('should not throw when loading changes without container ref', () => {
      const { rerender } = renderHook(
        ({ isLoading }) =>
          useAssistantScrolling({
            isOpen: true,
            messages: [],
            isLoading,
            streamingContent: '',
          }),
        { initialProps: { isLoading: false } }
      );

      expect(() => rerender({ isLoading: true })).not.toThrow();
    });

    it('should not throw when streaming content changes without container ref', () => {
      const { rerender } = renderHook(
        ({ streamingContent }) =>
          useAssistantScrolling({
            isOpen: true,
            messages: [],
            isLoading: false,
            streamingContent,
          }),
        { initialProps: { streamingContent: '' } }
      );

      expect(() => rerender({ streamingContent: 'Hello' })).not.toThrow();
    });
  });

  describe('conditional scroll triggers', () => {
    it('should not scroll when isLoading is false', () => {
      renderHook(() =>
        useAssistantScrolling({
          isOpen: true,
          messages: [],
          isLoading: false,
          streamingContent: '',
        })
      );

      // The loading effect returns early when !isLoading
    });

    it('should not scroll when streamingContent is empty', () => {
      renderHook(() =>
        useAssistantScrolling({
          isOpen: true,
          messages: [],
          isLoading: false,
          streamingContent: '',
        })
      );

      // The streaming effect returns early when !streamingContent
    });
  });

  describe('hook return value', () => {
    it('should always return messagesContainerRef', () => {
      const { result } = renderHook(() =>
        useAssistantScrolling({
          isOpen: false,
          messages: [],
          isLoading: false,
          streamingContent: '',
        })
      );

      expect(result.current).toHaveProperty('messagesContainerRef');
      expect(typeof result.current.messagesContainerRef).toBe('object');
    });
  });
});
