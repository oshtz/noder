/**
 * Tests for workflowId utility
 */

import { describe, it, expect } from 'vitest';
import { toSafeWorkflowId } from './workflowId';

describe('workflowId', () => {
  describe('toSafeWorkflowId', () => {
    it('returns "workflow" for empty input', () => {
      expect(toSafeWorkflowId('')).toBe('workflow');
      expect(toSafeWorkflowId()).toBe('workflow');
    });

    it('preserves valid characters', () => {
      expect(toSafeWorkflowId('MyWorkflow123')).toBe('MyWorkflow123');
      expect(toSafeWorkflowId('test-workflow')).toBe('test-workflow');
      expect(toSafeWorkflowId('test_workflow')).toBe('test_workflow');
      expect(toSafeWorkflowId('Test Workflow')).toBe('Test Workflow');
    });

    it('replaces invalid characters with underscores', () => {
      expect(toSafeWorkflowId('test@workflow')).toBe('test_workflow');
      expect(toSafeWorkflowId('test!@#$%workflow')).toBe('test_____workflow');
      expect(toSafeWorkflowId('workflow.json')).toBe('workflow_json');
    });

    it('trims whitespace', () => {
      expect(toSafeWorkflowId('  workflow  ')).toBe('workflow');
      expect(toSafeWorkflowId('  ')).toBe('workflow');
    });

    it('handles special characters', () => {
      expect(toSafeWorkflowId('workflow/path')).toBe('workflow_path');
      expect(toSafeWorkflowId('workflow\\path')).toBe('workflow_path');
      expect(toSafeWorkflowId('<script>alert()</script>')).toBe('_script_alert____script_');
    });

    it('preserves numbers', () => {
      expect(toSafeWorkflowId('workflow123')).toBe('workflow123');
      expect(toSafeWorkflowId('123workflow')).toBe('123workflow');
      expect(toSafeWorkflowId('123')).toBe('123');
    });

    it('handles unicode characters', () => {
      expect(toSafeWorkflowId('workflow-')).toBe('workflow-');
      expect(toSafeWorkflowId('workflow_')).toBe('workflow_');
    });

    it('handles mixed valid and invalid characters', () => {
      expect(toSafeWorkflowId('My Workflow!2024')).toBe('My Workflow_2024');
      expect(toSafeWorkflowId('Test-Flow_v2.0')).toBe('Test-Flow_v2_0');
    });

    it('handles strings with only special characters', () => {
      expect(toSafeWorkflowId('!!!')).toBe('___');
      // Whitespace gets replaced with underscores but leading/trailing trimmed
      expect(toSafeWorkflowId('   !!   ')).toBe('__');
    });
  });
});
