// Core data types for workflow connections
// Only 4 types: text, image, video, audio
export const HANDLE_TYPES = {
  TEXT: {
    type: 'text',
    dataType: 'text',
    color: '#2196F3', // Blue
    label: 'Text'
  },
  IMAGE: {
    type: 'image',
    dataType: 'image',
    color: '#f97316', // Orange
    label: 'Image'
  },
  VIDEO: {
    type: 'video',
    dataType: 'video',
    color: '#14b8a6', // Teal
    label: 'Video'
  },
  AUDIO: {
    type: 'audio',
    dataType: 'audio',
    color: '#ec4899', // Pink
    label: 'Audio'
  },
  MODEL: {
    type: 'model',
    dataType: 'model',
    color: '#a855f7', // Purple
    label: 'Model'
  }
};

// Simple lookup by type string
const TYPE_MAP = {
  text: HANDLE_TYPES.TEXT,
  image: HANDLE_TYPES.IMAGE,
  video: HANDLE_TYPES.VIDEO,
  audio: HANDLE_TYPES.AUDIO,
  model: HANDLE_TYPES.MODEL,
  // Legacy aliases
  string: HANDLE_TYPES.TEXT
};

// Get handle color by type
export const getHandleColor = (type) => {
  return TYPE_MAP[type]?.color || 'var(--primary-color)';
};

// Check if two types are compatible for connection
export const areTypesCompatible = (sourceType, targetType) => {
  // "any" type accepts everything and can connect to everything
  if (sourceType === 'any' || targetType === 'any') return true;
  
  // Exact match
  if (sourceType === targetType) return true;
  
  // Legacy string -> text compatibility
  if ((sourceType === 'string' && targetType === 'text') ||
      (sourceType === 'text' && targetType === 'string')) {
    return true;
  }
  
  return false;
};

// Get all valid types
export const getAllTypes = () => Object.keys(TYPE_MAP).filter(k => k !== 'string');
