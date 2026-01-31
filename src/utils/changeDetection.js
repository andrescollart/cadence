/**
 * Change detection utilities for Push to JIRA feature
 */

// Fields that can be pushed to JIRA
const PUSHABLE_FIELDS = ['startDate', 'endDate', 'team', 'segments', 'feEffortDays', 'beEffortDays'];

/**
 * Compare two values for equality (handles arrays and null/undefined)
 */
function valuesEqual(a, b) {
  // Normalize null/undefined
  const normA = a ?? null;
  const normB = b ?? null;

  // Both null/undefined
  if (normA === null && normB === null) return true;
  if (normA === null || normB === null) return false;

  // Array comparison
  if (Array.isArray(normA) && Array.isArray(normB)) {
    if (normA.length !== normB.length) return false;
    return normA.every((v, i) => v === normB[i]);
  }

  // Direct comparison
  return normA === normB;
}

/**
 * Get human-readable label for a field
 */
export function getFieldLabel(field) {
  const labels = {
    startDate: 'Start Date',
    endDate: 'End Date',
    team: 'Team',
    segments: 'Segments',
    feEffortDays: 'FE Effort',
    beEffortDays: 'BE Effort',
  };
  return labels[field] || field;
}

/**
 * Format a value for display
 */
export function formatFieldValue(field, value) {
  if (value === null || value === undefined) return '—';

  switch (field) {
    case 'startDate':
    case 'endDate':
      if (!value) return '—';
      try {
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return value;
      }
    case 'segments':
      if (!Array.isArray(value) || value.length === 0) return '—';
      return value.join(', ');
    case 'feEffortDays':
    case 'beEffortDays':
      return `${value} days`;
    default:
      return String(value);
  }
}

/**
 * Detect changes for a single item
 * @returns {{ field: string, original: any, current: any }[]}
 */
function detectItemChanges(original, current) {
  const changes = [];

  for (const field of PUSHABLE_FIELDS) {
    const originalValue = original?.[field];
    const currentValue = current?.[field];

    if (!valuesEqual(originalValue, currentValue)) {
      changes.push({
        field,
        original: originalValue,
        current: currentValue,
      });
    }
  }

  return changes;
}

/**
 * Recursively detect all changes in task hierarchy
 * @param tasks - Current tasks array
 * @param originalState - Map of issue key to original values
 * @returns Array of change objects with hierarchy info
 */
export function detectAllChanges(tasks, originalState) {
  if (!originalState) return [];

  const allChanges = [];

  function traverseItem(item, parentPath = [], depth = 0) {
    const issueKey = item.id;
    const original = originalState[issueKey];

    if (!original) {
      // Item not from JIRA or new - skip
      return;
    }

    const currentValues = {
      startDate: item.startDate,
      endDate: item.endDate,
      team: item.team,
      segments: item.segments,
      feEffortDays: item.feEffortDays,
      beEffortDays: item.beEffortDays,
    };

    const itemChanges = detectItemChanges(original, currentValues);

    if (itemChanges.length > 0) {
      allChanges.push({
        issueKey,
        name: item.name,
        depth,
        parentPath: [...parentPath],
        changes: itemChanges,
        original,
        current: currentValues,
      });
    }

    // Recurse into subtasks
    if (item.subtasks?.length > 0) {
      for (const subtask of item.subtasks) {
        traverseItem(subtask, [...parentPath, issueKey], depth + 1);
      }
    }
  }

  for (const task of tasks) {
    traverseItem(task);
  }

  return allChanges;
}

/**
 * Group changes by top-level parent for tree display
 * Returns a hierarchical structure for UI rendering
 */
export function groupChangesByHierarchy(changes, tasks) {
  // Build a map of all items by key for lookups
  const itemMap = new Map();

  function mapItems(items, parent = null) {
    for (const item of items) {
      itemMap.set(item.id, { item, parent });
      if (item.subtasks?.length > 0) {
        mapItems(item.subtasks, item.id);
      }
    }
  }
  mapItems(tasks);

  // Build tree structure
  const tree = [];
  const processed = new Set();

  for (const change of changes) {
    if (change.depth === 0) {
      // Top-level task - create root node
      const existingRoot = tree.find(n => n.issueKey === change.issueKey);
      if (!existingRoot) {
        tree.push({
          ...change,
          children: [],
        });
      }
      processed.add(change.issueKey);
    }
  }

  // Add child changes under their parents
  for (const change of changes) {
    if (change.depth > 0) {
      // Find the top-level parent
      const topParent = change.parentPath[0];
      let rootNode = tree.find(n => n.issueKey === topParent);

      if (!rootNode) {
        // Parent doesn't have its own changes, create placeholder
        const parentInfo = itemMap.get(topParent);
        rootNode = {
          issueKey: topParent,
          name: parentInfo?.item?.name || topParent,
          depth: 0,
          parentPath: [],
          changes: [],
          original: {},
          current: {},
          children: [],
        };
        tree.push(rootNode);
      }

      rootNode.children.push(change);
    }
  }

  return tree;
}

/**
 * Build GANTT_CONFIG object from item with selected fields only
 */
export function buildGanttConfig(item, selectedFields) {
  const config = {};

  if (selectedFields.has('team') && item.team) {
    config.team = item.team;
  }
  if (selectedFields.has('segments') && item.segments?.length > 0) {
    config.segments = item.segments;
  }
  if (selectedFields.has('feEffortDays') && (item.feEffortDays || item.feEffortDays === 0)) {
    config.feEffortDays = item.feEffortDays;
  }
  if (selectedFields.has('beEffortDays') && (item.beEffortDays || item.beEffortDays === 0)) {
    config.beEffortDays = item.beEffortDays;
  }
  // Dates are also stored in GANTT_CONFIG for non-native field sync
  if (selectedFields.has('startDate') && item.startDate) {
    config.startDate = item.startDate;
  }
  if (selectedFields.has('endDate') && item.endDate) {
    config.endDate = item.endDate;
  }

  return config;
}

/**
 * Count total changes across all items
 */
export function countChanges(changes) {
  let totalItems = changes.length;
  let totalFields = 0;

  for (const change of changes) {
    totalFields += change.changes.length;
  }

  return { totalItems, totalFields };
}

/**
 * Get field category for filtering
 */
export function getFieldCategory(field) {
  switch (field) {
    case 'startDate':
    case 'endDate':
      return 'dates';
    case 'feEffortDays':
    case 'beEffortDays':
      return 'effort';
    case 'team':
    case 'segments':
      return 'assignment';
    default:
      return 'other';
  }
}
