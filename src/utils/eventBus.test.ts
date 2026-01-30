/**
 * Tests for eventBus utilities
 *
 * NOTE: This test uses vi.unmock to restore the real implementation
 * because the test-setup.js file mocks eventBus globally.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// Unmock the eventBus module to test the real implementation
vi.unmock('./eventBus');

// Import after unmocking
import { emit, on } from './eventBus';

describe('eventBus', () => {
  // Track unsubscribe functions to clean up after each test
  const unsubscribers: (() => void)[] = [];

  // Use unique event names per test to avoid interference
  let testId = 0;
  const getEventName = (base: string) => `${base}_${++testId}_${Date.now()}`;

  afterEach(() => {
    // Clean up all subscriptions after each test
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers.length = 0;
  });

  describe('emit', () => {
    it('emits an event that can be received', () => {
      const eventName = getEventName('test');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      emit(eventName);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits an event with detail payload', () => {
      const eventName = getEventName('payload');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      emit(eventName, { message: 'hello', count: 42 });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ message: 'hello', count: 42 });
    });

    it('emits to multiple handlers', () => {
      const eventName = getEventName('multi');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      unsubscribers.push(on(eventName, handler1));
      unsubscribers.push(on(eventName, handler2));

      emit(eventName, 'data');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('does not emit to handlers of different events', () => {
      const eventA = getEventName('eventA');
      const eventB = getEventName('eventB');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      unsubscribers.push(on(eventA, handler1));
      unsubscribers.push(on(eventB, handler2));

      emit(eventA, 'data');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('handles undefined detail', () => {
      const eventName = getEventName('nodetail');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      emit(eventName);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      // CustomEvent converts undefined detail to null
      expect(event.detail).toBeNull();
    });

    it('handles null detail', () => {
      const eventName = getEventName('nulldetail');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      emit(eventName, null);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toBeNull();
    });

    it('handles complex nested detail objects', () => {
      const eventName = getEventName('complex');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      const complexData = {
        nodes: [
          { id: 'node-1', data: { title: 'Test' } },
          { id: 'node-2', data: { title: 'Test 2' } },
        ],
        metadata: {
          timestamp: 1234567890,
          nested: { deep: { value: 'deep-value' } },
        },
      };

      emit(eventName, complexData);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual(complexData);
    });

    it('handles array detail', () => {
      const eventName = getEventName('array');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      emit(eventName, [1, 2, 3, 'four']);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual([1, 2, 3, 'four']);
    });
  });

  describe('on', () => {
    it('returns an unsubscribe function', () => {
      const eventName = getEventName('unsubtest');
      const handler = vi.fn();
      const unsubscribe = on(eventName, handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribers.push(unsubscribe);
    });

    it('unsubscribe stops receiving events', () => {
      const eventName = getEventName('unsub');
      const handler = vi.fn();
      const unsubscribe = on(eventName, handler);

      emit(eventName, 'first');
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      emit(eventName, 'second');
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('unsubscribe only affects the specific handler', () => {
      const eventName = getEventName('partialunsub');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsubscribe1 = on(eventName, handler1);
      unsubscribers.push(on(eventName, handler2));

      emit(eventName, 'first');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsubscribe1();

      emit(eventName, 'second');
      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(2); // Now 2
    });

    it('subscribes handlers with same reference only once (EventTarget behavior)', () => {
      const eventName = getEventName('multisub');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));
      unsubscribers.push(on(eventName, handler));

      emit(eventName, 'data');

      // EventTarget deduplicates identical handler references
      // This is standard browser behavior
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('handles event types with special characters', () => {
      const eventName = getEventName('node:update:position');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      emit(eventName, { x: 100, y: 200 });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('can unsubscribe multiple times without error', () => {
      const eventName = getEventName('multiunsub');
      const handler = vi.fn();
      const unsubscribe = on(eventName, handler);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('typed events', () => {
    interface NodeUpdateEvent {
      nodeId: string;
      position: { x: number; y: number };
    }

    it('supports typed event handlers', () => {
      const eventName = getEventName('nodeupdate');
      const handler = vi.fn<[CustomEvent<NodeUpdateEvent>]>();
      unsubscribers.push(on<NodeUpdateEvent>(eventName, handler));

      emit<NodeUpdateEvent>(eventName, {
        nodeId: 'node-1',
        position: { x: 100, y: 200 },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];
      expect(event.detail.nodeId).toBe('node-1');
      expect(event.detail.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe('event ordering', () => {
    it('calls handlers in subscription order', () => {
      const eventName = getEventName('ordered');
      const order: number[] = [];

      unsubscribers.push(on(eventName, () => order.push(1)));
      unsubscribers.push(on(eventName, () => order.push(2)));
      unsubscribers.push(on(eventName, () => order.push(3)));

      emit(eventName);

      expect(order).toEqual([1, 2, 3]);
    });

    it('handles synchronous emit within handler', () => {
      const eventA = getEventName('chainA');
      const eventB = getEventName('chainB');
      const order: string[] = [];

      unsubscribers.push(
        on(eventA, () => {
          order.push('a-start');
          emit(eventB);
          order.push('a-end');
        })
      );

      unsubscribers.push(
        on(eventB, () => {
          order.push('b');
        })
      );

      emit(eventA);

      expect(order).toEqual(['a-start', 'b', 'a-end']);
    });
  });

  describe('edge cases', () => {
    it('handles events with no listeners', () => {
      const eventName = getEventName('nolisteners');
      // Should not throw
      expect(() => emit(eventName)).not.toThrow();
    });

    it('handles rapid successive emits', () => {
      const eventName = getEventName('rapid');
      const handler = vi.fn();
      unsubscribers.push(on(eventName, handler));

      for (let i = 0; i < 100; i++) {
        emit(eventName, i);
      }

      expect(handler).toHaveBeenCalledTimes(100);
    });
  });
});
