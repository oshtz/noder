import React, { useMemo, useState } from 'react';
import { FaCopy, FaPaste } from 'react-icons/fa';
import './NodeSettingsClipboard.css';

const CLIPBOARD_KEY = 'noder-node-settings-clipboard';

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const writeClipboard = async (payload) => {
  const serialized = JSON.stringify(payload);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(serialized);
      return;
    }
  } catch (error) {
    // Fall back to localStorage
  }

  localStorage.setItem(CLIPBOARD_KEY, serialized);
};

const readClipboard = async () => {
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    }
  } catch (error) {
    // Fall back to localStorage
  }

  return localStorage.getItem(CLIPBOARD_KEY) || '';
};

const NodeSettingsClipboard = ({ nodeType, values, onApply }) => {
  const [status, setStatus] = useState('');

  const allowedKeys = useMemo(() => new Set(Object.keys(values || {})), [values]);

  const setTimedStatus = (message) => {
    setStatus(message);
    if (message) {
      setTimeout(() => setStatus(''), 1400);
    }
  };

  const handleCopy = async () => {
    if (!values || typeof values !== 'object') return;
    await writeClipboard({
      nodeType,
      values,
      timestamp: Date.now()
    });
    setTimedStatus('Copied');
  };

  const handlePaste = async () => {
    const raw = await readClipboard();
    const payload = raw ? safeParse(raw) : null;
    if (!payload?.values || typeof payload.values !== 'object') {
      setTimedStatus('No clipboard data');
      return;
    }

    const filtered = {};
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
  };

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
