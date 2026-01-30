/**
 * Event Bus
 *
 * Simple pub/sub event system for inter-component communication.
 * Uses native EventTarget for cross-browser compatibility.
 */

// =============================================================================
// Types
// =============================================================================

/** Event handler function type */
export type EventHandler<T = unknown> = (event: CustomEvent<T>) => void;

/** Unsubscribe function type */
export type Unsubscribe = () => void;

// =============================================================================
// Event Bus
// =============================================================================

const eventBus = new EventTarget();

/**
 * Emit an event
 * @param type - Event type name
 * @param detail - Event payload
 */
export const emit = <T = unknown>(type: string, detail?: T): void => {
  eventBus.dispatchEvent(new CustomEvent(type, { detail }));
};

/**
 * Subscribe to an event
 * @param type - Event type name
 * @param handler - Event handler function
 * @returns Unsubscribe function
 */
export const on = <T = unknown>(type: string, handler: EventHandler<T>): Unsubscribe => {
  const wrappedHandler = handler as EventListener;
  eventBus.addEventListener(type, wrappedHandler);
  return () => eventBus.removeEventListener(type, wrappedHandler);
};

export default eventBus;
