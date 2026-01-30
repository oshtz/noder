import React, { useMemo, useState, useCallback } from 'react';
import { FaCopy, FaPaste } from 'react-icons/fa';
import './NodeSettingsClipboard.css';

// =============================================================================
// Types
// =============================================================================

interface ClipboardPayload {
  nodeType: string;
  values: Record<string, unknown>;
  timestamp: number;
}

interface NodeSettingsClipboardProps {
  nodeType: string;
  values: Record<string, unknown>;
  onApply: (values: Record<string, unknown>, sourceNodeType?: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const CLIPBOARD_KEY = 'noder-node-settings-clipboard';

// =============================================================================
// Helper Functions
// =============================================================================

const safeParse = (value: string): ClipboardPayload | null => {
  try {
    return JSON.parse(value) as ClipboardPayload;
  } catch {
    return null;
  }
};

const writeClipboard = async (payload: ClipboardPayload): Promise<void> => {
  const serialized = JSON.stringify(payload);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(serialized);
      return;
    }
  } catch {
    // Fall back to localStorage
  }

  localStorage.setItem(CLIPBOARD_KEY, serialized);
};

const readClipboard = async (): Promise<string> => {
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    }
  } catch {
    // Fall back to localStorage
  }

  return localStorage.getItem(CLIPBOARD_KEY) || '';
};

// =============================================================================
// NodeSettingsClipboard Component
// =============================================================================

const NodeSettingsClipboard: React.FC<NodeSettingsClipboardProps> = ({
  nodeType,
  values,
  onApply,
}) => {
  const [status, setStatus] = useState('');

  const allowedKeys = useMemo(() => new Set(Object.keys(values || {})), [values]);

  const setTimedStatus = useCallback((message: string): void => {
    setStatus(message);
    if (message) {
      setTimeout(() => setStatus(''), 1400);
    }
  }, []);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!values || typeof values !== 'object') return;
    await writeClipboard({
      nodeType,
      values,
      timestamp: Date.now(),
    });
    setTimedStatus('Copied');
  }, [nodeType, values, setTimedStatus]);

  const handlePaste = useCallback(async (): Promise<void> => {
    const raw = await readClipboard();
    const payload = raw ? safeParse(raw) : null;
    if (!payload?.values || typeof payload.values !== 'object') {
      setTimedStatus('No clipboard data');
      return;
    }

    const filtered: Record<string, unknown> = {};
    Object.entries(payload.values).forEach(([key, value]) => {
      if (allowedKeys.has(key)) {
        filtered[key] = value;
      }
    });

    if (Object.keys(filtered).length === 0) {
      setTimedStatus('No matching fields');
      return;
    }

    onApply({ ...values, ...filtered }, payload.nodeType);
    setTimedStatus('Pasted');
  }, [allowedKeys, values, onApply, setTimedStatus]);

  return (
    <div className="node-settings-clipboard">
      <button
        type="button"
        className="node-settings-clipboard-button"
        onClick={handleCopy}
        title="Copy node settings"
      >
        <FaCopy size={12} />
        Copy
      </button>
      <button
        type="button"
        className="node-settings-clipboard-button"
        onClick={handlePaste}
        title="Paste node settings"
      >
        <FaPaste size={12} />
        Paste
      </button>
      {status && <span className="node-settings-clipboard-status">{status}</span>}
    </div>
  );
};

export default NodeSettingsClipboard;
