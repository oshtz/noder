/**
 * Workflows API Client
 *
 * Centralized module for all workflow CRUD operations.
 * Provides consistent error handling and logging.
 */

import { invoke } from '../types/tauri';
import { logApiError } from '../utils/errorLogger';
import type { Workflow, WorkflowData } from '../types/tauri';
import type { WorkflowDocument } from '../utils/workflowSchema';

// =============================================================================
// Types
// =============================================================================

/** Re-export for convenience */
export type { Workflow, WorkflowData };

// =============================================================================
// API Functions
// =============================================================================

/**
 * List all saved workflows
 *
 * @returns Array of workflow summaries
 */
export async function listWorkflows(): Promise<Workflow[]> {
  try {
    return await invoke('list_workflows');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'list_workflows');
    throw err;
  }
}

/**
 * Load a workflow by ID
 *
 * @param id - Workflow ID to load
 * @returns Workflow data
 */
export async function loadWorkflow(id: string): Promise<Workflow> {
  try {
    return await invoke('load_workflow', { id });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'load_workflow', { workflowId: id });
    throw err;
  }
}

/**
 * Save a workflow
 *
 * @param name - Workflow name
 * @param data - Workflow document data
 */
export async function saveWorkflow(name: string, data: WorkflowData): Promise<void> {
  try {
    await invoke('save_workflow', { name, data });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'save_workflow', { workflowName: name });
    throw err;
  }
}

/**
 * Delete a workflow by ID
 *
 * @param id - Workflow ID to delete
 */
export async function deleteWorkflow(id: string): Promise<void> {
  try {
    await invoke('delete_workflow', { id });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'delete_workflow', { workflowId: id });
    throw err;
  }
}

// =============================================================================
// File Import/Export Functions
// =============================================================================

/**
 * Export a workflow document to a JSON file
 *
 * @param document - Workflow document to export
 * @param filename - Desired filename (without extension)
 */
export function exportWorkflowToFile(document: WorkflowDocument, filename = 'workflow'): void {
  try {
    const jsonString = JSON.stringify(document, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'export_workflow', { filename });
    throw err;
  }
}

/**
 * Import a workflow from a JSON file
 *
 * @param file - File object to import
 * @returns Parsed workflow document
 */
export function importWorkflowFromFile(file: File): Promise<WorkflowDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          throw new Error('Failed to read file as text');
        }
        const document = JSON.parse(result) as WorkflowDocument;
        resolve(document);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logApiError(err, 'import_workflow', { filename: file.name });
        reject(new Error('Invalid workflow file format'));
      }
    };

    reader.onerror = () => {
      const error = new Error('Failed to read workflow file');
      logApiError(error, 'import_workflow', { filename: file.name });
      reject(error);
    };

    reader.readAsText(file);
  });
}
