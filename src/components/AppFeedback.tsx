import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { useUIStore, type AppNotification } from '../stores/useUIStore';
import './AppFeedback.css';

const notificationIcon = (type: AppNotification['type']): React.ReactNode => {
  if (type === 'success') return <FaCheckCircle />;
  if (type === 'warning') return <FaExclamationTriangle />;
  if (type === 'error') return <FaExclamationTriangle />;
  return <FaInfoCircle />;
};

export default function AppFeedback(): JSX.Element {
  const notifications = useUIStore((state) => state.notifications);
  const dismissNotification = useUIStore((state) => state.dismissNotification);
  const activeDialog = useUIStore((state) => state.activeDialog);
  const resolveDialog = useUIStore((state) => state.resolveDialog);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (activeDialog?.kind === 'prompt') {
      setPromptValue(activeDialog.defaultValue ?? '');
    }
  }, [activeDialog]);

  return (
    <>
      <div className="app-notifications" aria-live="polite" aria-atomic="false">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`app-notification app-notification-${notification.type}`}
            role={notification.type === 'error' ? 'alert' : 'status'}
          >
            <div className="app-notification-icon">{notificationIcon(notification.type)}</div>
            <div className="app-notification-body">
              {notification.title && (
                <div className="app-notification-title">{notification.title}</div>
              )}
              <div className="app-notification-message">{notification.message}</div>
            </div>
            <button
              className="app-notification-close"
              onClick={() => dismissNotification(notification.id)}
              aria-label="Dismiss notification"
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>

      {activeDialog && (
        <div className="app-dialog-backdrop" role="presentation">
          <div
            className="app-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
          >
            <h2 id="app-dialog-title">{activeDialog.title}</h2>
            <p>{activeDialog.message}</p>

            {activeDialog.kind === 'prompt' && (
              <input
                className="app-dialog-input"
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const value = promptValue.trim();
                    if (!activeDialog.required || value) {
                      resolveDialog(value);
                    }
                  }
                  if (event.key === 'Escape') {
                    resolveDialog(null);
                  }
                }}
              />
            )}

            <div className="app-dialog-actions">
              <button className="app-dialog-secondary" onClick={() => resolveDialog(null)}>
                {activeDialog.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={
                  activeDialog.kind === 'confirm' && activeDialog.tone === 'danger'
                    ? 'app-dialog-primary app-dialog-danger'
                    : 'app-dialog-primary'
                }
                onClick={() => {
                  if (activeDialog.kind === 'confirm') {
                    resolveDialog(true);
                    return;
                  }

                  const value = promptValue.trim();
                  if (!activeDialog.required || value) {
                    resolveDialog(value);
                  }
                }}
              >
                {activeDialog.confirmLabel ?? 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
