export const createNode = ({
  id,
  type,
  title,
  handles,
  initialData = {},
  position = { x: 0, y: 0 },
  style = { width: 200, height: 200 },
  className = "react-flow__node-resizable",
  dragHandle = ".custom-drag-handle"
}) => ({
  id,
  type,
  position,
  style,
  className,
  dragHandle,
  data: {
    title,
    handles,
    ...initialData
  }
});

/**
 * Ensures parent/group nodes come before their child nodes in the array.
 * React Flow requires parent nodes to be defined before children that reference them.
 * This also removes orphaned parentNode references (where the parent doesn't exist).
 * This prevents "Parent node not found" errors.
 * 
 * @param {Array} nodes - Array of React Flow nodes
 * @returns {Array} - Sorted array with parents before children, orphans cleaned up
 */
export const sortNodesForReactFlow = (nodes) => {
  if (!nodes || nodes.length === 0) return nodes;
  
  // Build a set of all existing node IDs
  const existingNodeIds = new Set(nodes.map(node => node.id));
  
  // Clean up orphaned parentNode references and categorize nodes
  const parentNodes = [];
  const childNodes = [];
  const regularNodes = [];
  
  // First pass: identify all parent node IDs that are referenced AND exist
  const validParentIds = new Set();
  nodes.forEach(node => {
    const parentId = node.parentNode || node.parentId;
    if (parentId && existingNodeIds.has(parentId)) {
      validParentIds.add(parentId);
    }
  });
  
  // Second pass: categorize nodes and clean up orphaned references
  const cleanedNodes = nodes.map(node => {
    const parentId = node.parentNode || node.parentId;
    
    // If node has a parent reference but that parent doesn't exist, remove the reference
    if (parentId && !existingNodeIds.has(parentId)) {
      console.warn(`[sortNodesForReactFlow] Removing orphaned parentNode reference "${parentId}" from node "${node.id}"`);
      const { parentNode, parentId: pId, extent, ...cleanNode } = node;
      return cleanNode;
    }
    return node;
  });
  
  // Third pass: categorize cleaned nodes
  cleanedNodes.forEach(node => {
    if (validParentIds.has(node.id) || node.type === 'group') {
      // This is a parent/group node
      parentNodes.push(node);
    } else if (node.parentNode || node.parentId) {
      // This is a child node with valid parent
      childNodes.push(node);
    } else {
      // Regular node without parent relationship
      regularNodes.push(node);
    }
  });
  
  // Return with parents first, then regular nodes, then children
  return [...parentNodes, ...regularNodes, ...childNodes];
};
