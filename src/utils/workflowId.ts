/**
 * Workflow ID utilities
 *
 * Functions for generating and validating workflow IDs.
 */

/**
 * Convert any string input to a safe workflow ID
 * Replaces invalid characters with underscores
 * @param input - Raw input string
 * @returns Safe workflow ID string
 */
export const toSafeWorkflowId = (input = ''): string => {
  const cleaned = input
    .split('')
    .map((ch) => (/[A-Za-z0-9 _-]/.test(ch) ? ch : '_'))
    .join('')
    .trim();

  return cleaned || 'workflow';
};
