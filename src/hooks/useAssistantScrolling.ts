/**
 * Hook for managing assistant panel auto-scrolling.
 * Handles scroll-to-bottom on new messages and streaming.
 */

import { useEffect, useRef } from 'react';
import type { Message } from './useAssistantMessages';

// =============================================================================
// Types
// =============================================================================

interface UseAssistantScrollingOptions {
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
}

interface UseAssistantScrollingReturn {
  /** Ref for the messages container */
  messagesContainerRef: React.RefObject<HTMLDivElement>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing auto-scroll behavior in assistant panel.
 */
export function useAssistantScrolling({
  isOpen,
  messages,
  isLoading,
  streamingContent,
}: UseAssistantScrollingOptions): UseAssistantScrollingReturn {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, isOpen]);

  // Auto-scroll while loading
  useEffect(() => {
    if (!isOpen || !isLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [isLoading, isOpen]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (!isOpen || !streamingContent) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [streamingContent, isOpen]);

  return {
    messagesContainerRef,
  };
}

export default useAssistantScrolling;
