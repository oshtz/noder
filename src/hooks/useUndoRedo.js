import { useCallback, useRef, useState, useEffect } from 'react';
import { sortNodesForReactFlow } from '../utils/createNode';

/**
 * Hook for managing undo/redo history in the workflow editor
 * 
 * Features:
 * - Snapshot-based history management
 * - Configurable max history size
 * - Debounced snapshots to avoid flooding history during drag operations
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 */
export const useUndoRedo = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  maxHistory = 50,
  debounceMs = 300
}) => {
  // History stacks
  const [pastStates, setPastStates] = useState([]);
  const [futureStates, setFutureStates] = useState([]);
  
  // Track if we're currently applying an undo/redo to prevent snapshot
  const isApplyingRef = useRef(false);
  
  // Debounce timer for position changes
  const debounceTimerRef = useRef(null);
  
  // Store the last saved state to detect meaningful changes
  const lastSavedStateRef = useRef(null);

  /**
   * Create a snapshot of the current state
   */
  const createSnapshot = useCallback(() => {
    return {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now()
    };
  }, [nodes, edges]);

  /**
   * Check if the state has meaningfully changed
   */
  const hasStateChanged = useCallback((snapshot) => {
    if (!lastSavedStateRef.current) return true;
    
    const last = lastSavedStateRef.current;
    
    // Check node count
    if (snapshot.nodes.length !== last.nodes.length) return true;
    if (snapshot.edges.length !== last.edges.length) return true;
    
    // Check node IDs
    const currentIds = new Set(snapshot.nodes.map(n => n.id));
    const lastIds = new Set(last.nodes.map(n => n.id));
    if (currentIds.size !== lastIds.size) return true;
    for (const id of currentIds) {
      if (!lastIds.has(id)) return true;
    }
    
    // Check edge IDs
    const currentEdgeIds = new Set(snapshot.edges.map(e => e.id));
    const lastEdgeIds = new Set(last.edges.map(e => e.id));
    if (currentEdgeIds.size !== lastEdgeIds.size) return true;
    for (const id of currentEdgeIds) {
      if (!lastEdgeIds.has(id)) return true;
    }
    
    // Check node positions (with threshold for position changes)
    for (const node of snapshot.nodes) {
      const lastNode = last.nodes.find(n => n.id === node.id);
      if (!lastNode) return true;
      
      const dx = Math.abs((node.position?.x || 0) - (lastNode.position?.x || 0));
      const dy = Math.abs((node.position?.y || 0) - (lastNode.position?.y || 0));
      
      // Consider it changed if moved more than 5 pixels
      if (dx > 5 || dy > 5) return true;
    }
    
    return false;
  }, []);

  /**
   * Take a snapshot for undo history
   */
  const takeSnapshot = useCallback((immediate = false) => {
    if (isApplyingRef.current) return;
    
    const saveSnapshot = () => {
      const snapshot = createSnapshot();
      
      if (!hasStateChanged(snapshot)) return;
      
      setPastStates(prev => {
        const newPast = [...prev, snapshot].slice(-maxHistory);
        return newPast;
      });
      
      // Clear future states when new action is taken
      setFutureStates([]);
      
      lastSavedStateRef.current = snapshot;
    };
    
    if (immediate) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      saveSnapshot();
    } else {
      // Debounce for position changes
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(saveSnapshot, debounceMs);
    }
  }, [createSnapshot, hasStateChanged, maxHistory, debounceMs]);

  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    if (pastStates.length === 0) return false;
    
    isApplyingRef.current = true;
    
    // Save current state to future
    const currentSnapshot = createSnapshot();
    setFutureStates(prev => [currentSnapshot, ...prev].slice(0, maxHistory));
    
    // Get previous state
    const previousState = pastStates[pastStates.length - 1];
    setPastStates(prev => prev.slice(0, -1));
    
    // Apply previous state (sort nodes to ensure parents come before children)
    setNodes(sortNodesForReactFlow(previousState.nodes));
    setEdges(previousState.edges);
    
    lastSavedStateRef.current = previousState;
    
    // Allow new snapshots after a short delay
    setTimeout(() => {
      isApplyingRef.current = false;
    }, 50);
    
    return true;
  }, [pastStates, createSnapshot, maxHistory, setNodes, setEdges]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback(() => {
    if (futureStates.length === 0) return false;
    
    isApplyingRef.current = true;
    
    // Save current state to past
    const currentSnapshot = createSnapshot();
    setPastStates(prev => [...prev, currentSnapshot].slice(-maxHistory));
    
    // Get next state
    const nextState = futureStates[0];
    setFutureStates(prev => prev.slice(1));
    
    // Apply next state (sort nodes to ensure parents come before children)
    setNodes(sortNodesForReactFlow(nextState.nodes));
    setEdges(nextState.edges);
    
    lastSavedStateRef.current = nextState;
    
    // Allow new snapshots after a short delay
    setTimeout(() => {
      isApplyingRef.current = false;
    }, 50);
    
    return true;
  }, [futureStates, createSnapshot, maxHistory, setNodes, setEdges]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setPastStates([]);
    setFutureStates([]);
    lastSavedStateRef.current = null;
  }, []);

  /**
   * Handle keyboard shortcuts for undo/redo
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger when typing in inputs/textareas
      const target = event.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z OR Ctrl/Cmd + Y - Redo
      if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'y')
      ) {
        event.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    undo,
    redo,
    takeSnapshot,
    clearHistory,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
    historyLength: pastStates.length,
    futureLength: futureStates.length
  };
};

export default useUndoRedo;
