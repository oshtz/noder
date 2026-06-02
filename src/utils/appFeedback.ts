import {
  useUIStore,
  type ConfirmDialogOptions,
  type PromptDialogOptions,
} from '../stores/useUIStore';

export function notifyError(message: string, title = 'Error'): void {
  useUIStore.getState().addNotification({ type: 'error', title, message });
}

export function notifySuccess(message: string, title = 'Done'): void {
  useUIStore.getState().addNotification({ type: 'success', title, message });
}

export function notifyInfo(message: string, title = 'Notice'): void {
  useUIStore.getState().addNotification({ type: 'info', title, message });
}

export function notifyWarning(message: string, title = 'Warning'): void {
  useUIStore.getState().addNotification({ type: 'warning', title, message });
}

export function confirmAction(options: ConfirmDialogOptions): Promise<boolean> {
  return useUIStore.getState().showConfirmDialog(options);
}

export function promptForText(options: PromptDialogOptions): Promise<string | null> {
  return useUIStore.getState().showPromptDialog(options);
}
