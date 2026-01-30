// Gallery component types

export type OutputType = 'image' | 'video' | 'audio' | 'text';
export type ViewMode = 'list' | 'grid' | 'compare';
export type FilterType = 'all' | OutputType;
export type CompareTarget = 'left' | 'right';

export interface Output {
  id?: string;
  value: string;
  type: OutputType;
  prompt?: string;
  model?: string;
  timestamp?: string | number;
}

export interface Database {
  isInitialized: boolean;
  getOutputs: (options: { limit: number; offset: number }) => Promise<Output[]>;
  deleteOutput: (id: string) => Promise<void>;
}

export interface DragData {
  value: string;
  type: OutputType;
  prompt?: string;
  model?: string;
}

export interface PanPosition {
  x: number;
  y: number;
}

export interface GalleryCallbacks {
  onClose?: () => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onGalleryDragStart?: (data: DragData, x: number, y: number) => void;
  onGalleryDragEnd?: (x: number, y: number) => void;
}

/**
 * Check if a value is a local file path (not a URL)
 */
export const isLocalPath = (value: unknown): boolean => {
  if (!value || typeof value !== 'string') return false;
  return (
    !value.startsWith('http://') &&
    !value.startsWith('https://') &&
    !value.startsWith('data:') &&
    (!!value.match(/^[A-Za-z]:[\\/]/) || value.startsWith('/'))
  );
};

export const getFileExtension = (type: OutputType): string => {
  switch (type) {
    case 'image':
      return 'png';
    case 'video':
      return 'mp4';
    case 'audio':
      return 'mp3';
    default:
      return 'txt';
  }
};
