/**
 * MessageComposer - Component for composing and sending messages.
 */

import React, { ChangeEvent, KeyboardEvent } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import type { MessageComposerProps } from './types';

export const MessageComposer: React.FC<MessageComposerProps> = ({
  draft,
  isLoading,
  onDraftChange,
  onSend,
}) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="assistant-footer">
      <div className="assistant-composer">
        <textarea
          rows={2}
          value={draft}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a workflow..."
          disabled={isLoading}
        />
        <button
          type="button"
          className={`assistant-send ${isLoading ? 'is-loading' : ''}`}
          onClick={onSend}
          disabled={isLoading}
          aria-busy={isLoading}
          aria-label={isLoading ? 'Sending message' : 'Send message'}
          title={isLoading ? 'Sending...' : 'Send'}
        >
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
