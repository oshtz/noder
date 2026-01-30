/**
 * MessageDisplay - Component for displaying assistant messages.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MessageDisplayProps } from './types';

export const MessageDisplay: React.FC<MessageDisplayProps> = ({
  messages,
  isLoading,
  streamingContent,
  activeToolCalls,
  messagesContainerRef,
}) => {
  // Filter visible messages
  const visibleMessages = messages.filter((message) => {
    if (message.role === 'tool') return false;
    if (message.role === 'assistant' && !message.content?.trim()) return false;
    return true;
  });

  return (
    <div className="assistant-body">
      {messages.length === 0 && (
        <div className="assistant-empty">
          Describe a workflow to build, like &quot;Summarize text and display the result.&quot;
        </div>
      )}

      <div className="assistant-messages" ref={messagesContainerRef}>
        {visibleMessages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`assistant-message assistant-message-${message.role}`}
          >
            <div className="assistant-message-role">{message.role}</div>
            {message.content && message.role !== 'tool' && (
              <div className="assistant-message-content">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div
            className={`assistant-message assistant-message-assistant ${
              streamingContent ? 'assistant-message-streaming' : 'assistant-message-typing'
            }`}
            role="status"
            aria-label={streamingContent ? 'Assistant is responding' : 'Assistant is typing'}
          >
            <div className="assistant-message-role">assistant</div>
            <div className="assistant-message-content">
              {streamingContent ? (
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              ) : (
                <span className="assistant-typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </div>
            {activeToolCalls.length > 0 && (
              <div className="assistant-tool-calls">
                {activeToolCalls.map((toolName) => (
                  <div key={toolName} className="assistant-tool-call">
                    <span className="assistant-tool-call-icon">⚙</span>
                    <span className="assistant-tool-call-name">{toolName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageDisplay;
