import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { FaStar, FaRegStar } from "react-icons/fa";
import { emit, on } from "../utils/eventBus";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Error in NodeSelector:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div>Error in Node Selector</div>;
    }
    return this.props.children;
  }
}

const FAVORITES_STORAGE_KEY = 'noder-favorite-nodes';
const MENU_PADDING = 8;

const NodeSelector = ({ nodeDefinitions, onAddNode, screenToFlowPosition, connectionContext = null }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [pendingConnection, setPendingConnection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [favoriteTypes, setFavoriteTypes] = useState(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  });
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filter to show only Text, Image, Video, Audio, and Chip nodes
  const allowedNodeTypes = ['text', 'image', 'upscaler', 'video', 'audio', 'chip'];
  
  const groupedNodes = {
    nodes: nodeDefinitions.filter(node => allowedNodeTypes.includes(node.type))
  };

  // Filter nodes based on search term
  const filteredNodes = groupedNodes.nodes.filter(node => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const label = (node.label || node.type).toLowerCase();
    const type = node.type.toLowerCase();
    return label.includes(term) || type.includes(term);
  });

  const favoriteSet = useMemo(() => new Set(favoriteTypes), [favoriteTypes]);
  const favoriteNodes = useMemo(
    () => filteredNodes.filter(node => favoriteSet.has(node.type)),
    [filteredNodes, favoriteSet]
  );
  const nonFavoriteNodes = useMemo(
    () => filteredNodes.filter(node => !favoriteSet.has(node.type)),
    [filteredNodes, favoriteSet]
  );
  const hasSearch = searchTerm.trim().length > 0;
  const allNodes = useMemo(
    () => (hasSearch ? filteredNodes : [...favoriteNodes, ...nonFavoriteNodes]),
    [filteredNodes, favoriteNodes, nonFavoriteNodes, hasSearch]
  );

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteTypes));
    } catch (error) {
      console.warn('Failed to persist favorite nodes:', error);
    }
  }, [favoriteTypes]);

  const toggleFavorite = (type) => {
    setFavoriteTypes(prev => (
      prev.includes(type) ? prev.filter(item => item !== type) : [...prev, type]
    ));
  };

  // Detect media type from file extension
  const detectMediaType = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)) return 'image';
    if (lower.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/)) return 'video';
    if (lower.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/)) return 'audio';
    return null;
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      for (const file of files) {
        const mediaType = detectMediaType(file.name);
        if (!mediaType) {
          console.warn(`Unsupported file type: ${file.name}`);
          continue;
        }

        // Read file as base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Data = e.target.result;
            
            // Save file using Tauri
            const savedPath = await invoke('save_uploaded_file', {
              filename: file.name,
              data: base64Data
            });

            // Create media node for uploaded files
            const flowPosition = screenToFlowPosition({
              x: clickPosition.x,
              y: clickPosition.y
            });

            onAddNode('media', flowPosition);
            
            // Dispatch event to set the uploaded file path and type in the node
            setTimeout(() => {
              const nodes = window.nodesRef?.current || [];
              const newNode = nodes[nodes.length - 1];
              if (newNode) {
                // Update node data directly
                newNode.data = {
                  ...newNode.data,
                  mediaPath: savedPath,
                  mediaType: mediaType
                };
                
                // Also dispatch event for any listeners
                emit("nodeContentChanged", {
                  targetId: newNode.id,
                  content: {
                    type: mediaType,
                    value: savedPath,
                    fromUpload: true
                  }
                });
                
                // Handle pending connection if exists
                if (pendingConnection) {
                  handleAutoConnect(newNode.id);
                }
              }
            }, 100);

          } catch (error) {
            console.error('Error saving uploaded file:', error);
            alert(`Failed to upload ${file.name}: ${error.message}`);
          }
        };
        reader.readAsDataURL(file);
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error handling file upload:', error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setSearchTerm('');
      // Focus search input when menu opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const maxX = Math.max(MENU_PADDING, window.innerWidth - rect.width - MENU_PADDING);
    const maxY = Math.max(MENU_PADDING, window.innerHeight - rect.height - MENU_PADDING);
    const nextX = Math.min(Math.max(position.x, MENU_PADDING), maxX);
    const nextY = Math.min(Math.max(position.y, MENU_PADDING), maxY);

    if (nextX !== position.x || nextY !== position.y) {
      setPosition({ x: nextX, y: nextY });
    }
  }, [isOpen, position.x, position.y]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      if (!allNodes.length) return;
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allNodes.length - 1));
    } else if (e.key === "ArrowUp") {
      if (!allNodes.length) return;
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (!allNodes.length) return;
      e.preventDefault();
      const selectedNode = allNodes[selectedIndex];
      if (selectedNode) {
        createNode(selectedNode.type);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Reset selected index when search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedIndex >= allNodes.length) {
      setSelectedIndex(Math.max(allNodes.length - 1, 0));
    }
  }, [allNodes.length, selectedIndex]);

  // Handle double-click on the flow pane
  useEffect(() => {
    const handleDoubleClick = (e) => {
      // Only trigger if clicking on the pane itself, not on nodes
      if (e.target.classList.contains('react-flow__pane')) {
        // Get the ReactFlow wrapper bounds to calculate relative position
        const flowWrapper = document.querySelector('.react-flow__renderer');
        const bounds = flowWrapper?.getBoundingClientRect();
        
        if (bounds) {
          // Calculate position relative to the flow wrapper
          const relativeX = e.clientX - bounds.left;
          const relativeY = e.clientY - bounds.top;
          
          // Store the relative position for node creation (not screen coordinates!)
          setClickPosition({ x: relativeX, y: relativeY });
          // Menu position uses screen coordinates for absolute positioning
          setPosition({ x: e.clientX, y: e.clientY });
          setPendingConnection(null); // Clear any pending connection
          setIsOpen(true);
        }
      }
    };

    // Handle opening selector from handle drag
    const handleOpenNodeSelector = (e) => {
      const { position, clickPosition, connectionContext } = e.detail;
      setPosition(position);
      setClickPosition(clickPosition);
      setPendingConnection(connectionContext);
      setIsOpen(true);
    };

    // Add the event listener to the flow container
    const flowPane = document.querySelector(".react-flow__pane");
    if (flowPane) {
      flowPane.addEventListener("dblclick", handleDoubleClick);
    }
    
    const offOpenNodeSelector = on("openNodeSelector", handleOpenNodeSelector);
    
    return () => {
      flowPane?.removeEventListener("dblclick", handleDoubleClick);
      offOpenNodeSelector();
    };
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedIndex, allNodes]);

  // Helper function to auto-connect the newly created node
  const handleAutoConnect = (newNodeId) => {
    if (!pendingConnection) return;
    
    const { sourceNode, sourceHandle, handleType } = pendingConnection;
    
    // Dispatch connection event
    emit("autoConnect", {
      source: sourceNode,
      sourceHandle: sourceHandle,
      target: newNodeId,
      handleType: handleType
    });
    
    setPendingConnection(null);
  };

  const createNode = (nodeType) => {
    const flowPosition = screenToFlowPosition({
      x: clickPosition.x,
      y: clickPosition.y
    });
    const newNodeId = onAddNode(nodeType, flowPosition);

    if (pendingConnection && newNodeId) {
      setTimeout(() => handleAutoConnect(newNodeId), 100);
    }

    setIsOpen(false);
  };

  if (!isOpen) return null;

  const getNodeIcon = (type) => {
    // Return first letter of node type
    if (type === 'text') return 'T';
    if (type.includes('upscale')) return 'U';
    if (type.includes('image')) return 'I';
    if (type.includes('video')) return 'V';
    if (type.includes('audio')) return 'A';
    if (type === 'chip') return 'C';
    return 'N';
  };

  const getNodeLabel = (node) => {
    if (node.type === 'text') return 'Text';
    if (node.type === 'upscaler') return 'Upscaler';
    if (node.type === 'image') return 'Image';
    if (node.type === 'video') return 'Video';
    if (node.type === 'audio') return 'Audio';
    if (node.type === 'chip') return 'Chip';
    return node.label || node.type;
  };

  return (
    <ErrorBoundary>
      <div
        className="node-selector-backdrop"
        onClick={() => setIsOpen(false)}
      >
        <div
          ref={menuRef}
          className="node-selector-menu"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="node-selector-search">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="node-selector-search-input"
            />
          </div>

          {/* Upload Section */}
          <div className="node-selector-section">
            <div className="node-selector-section-title">Add Source</div>
            <div
              className="node-selector-item upload-item"
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              <div className="node-selector-item-icon">U</div>
              <div className="node-selector-item-content">
                <div className="node-selector-item-label">Upload</div>
                <div className="node-selector-item-description" style={{
                  fontSize: '11px',
                  opacity: 0.7,
                  marginTop: '2px'
                }}>
                  Add media from your computer
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {/* Favorites Section */}
          {!hasSearch && favoriteNodes.length > 0 && (
            <div className="node-selector-section">
              <div className="node-selector-section-title">Favorites</div>
              {favoriteNodes.map((node, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={node.type}
                    className={`node-selector-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => createNode(node.type)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="node-selector-item-icon">{getNodeIcon(node.type)}</div>
                    <div className="node-selector-item-label">{getNodeLabel(node)}</div>
                    <button
                      type="button"
                      className={`node-selector-favorite${favoriteSet.has(node.type) ? ' active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(node.type);
                      }}
                      title="Remove favorite"
                    >
                      <FaStar size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Node Section */}
          <div className="node-selector-section">
            <div className="node-selector-section-title">{hasSearch ? 'Results' : 'Add Node'}</div>
            {(hasSearch ? filteredNodes : nonFavoriteNodes).map((node, index) => {
              const globalIndex = hasSearch ? index : index + favoriteNodes.length;
              const isFavorite = favoriteSet.has(node.type);
              return (
                <div
                  key={node.type}
                  className={`node-selector-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                  onClick={() => createNode(node.type)}
                  onMouseEnter={() => setSelectedIndex(globalIndex)}
                >
                  <div className="node-selector-item-icon">{getNodeIcon(node.type)}</div>
                  <div className="node-selector-item-label">{getNodeLabel(node)}</div>
                  <button
                    type="button"
                    className={`node-selector-favorite${isFavorite ? ' active' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(node.type);
                    }}
                    title={isFavorite ? 'Remove favorite' : 'Add favorite'}
                  >
                    {isFavorite ? <FaStar size={12} /> : <FaRegStar size={12} />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="node-selector-footer">
            <span className="node-selector-footer-hint">{"\u2191\u2193"} Navigate</span>
            <span className="node-selector-footer-hint">{"\u21B5"} Select</span>
          </div>

          {/* Learn about Nodes link */}
          <div className="node-selector-learn">
            <span className="node-selector-learn-icon">{"\u24D8"}</span>
            <span className="node-selector-learn-text">Learn about Nodes</span>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default NodeSelector;
