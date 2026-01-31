import React, { useState, useMemo } from 'react';
import { useJira } from '../../hooks/useJira.js';
import {
  detectAllChanges,
  groupChangesByHierarchy,
  buildGanttConfig,
  getFieldLabel,
  formatFieldValue,
  countChanges,
} from '../../utils/changeDetection.js';

// Field diff display component
function FieldDiff({ field, original, current }) {
  const label = getFieldLabel(field);
  const origDisplay = formatFieldValue(field, original);
  const currDisplay = formatFieldValue(field, current);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-20 flex-shrink-0">{label}:</span>
      <span className="text-gray-400 line-through">{origDisplay}</span>
      <span className="text-gray-400">→</span>
      <span className="text-green-600 font-medium">{currDisplay}</span>
    </div>
  );
}

// Single change item in the tree
function ChangeItem({ change, selected, selectedFields, onToggleItem, onToggleField, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = change.children?.length > 0;
  const hasOwnChanges = change.changes?.length > 0;

  const indentPx = depth * 24;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Item header */}
      <div
        className="flex items-start gap-2 py-2 px-3 hover:bg-gray-50"
        style={{ paddingLeft: `${12 + indentPx}px` }}
      >
        {/* Expand/collapse for items with children */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-5 h-5 flex items-center justify-center text-gray-400 ${hasChildren ? 'cursor-pointer hover:text-gray-600' : 'invisible'}`}
        >
          {hasChildren && (expanded ? '▼' : '▶')}
        </button>

        {/* Checkbox for item */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleItem(change.issueKey)}
          className="mt-1 w-4 h-4 text-blue-600 rounded"
        />

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {change.issueKey}
            </span>
            <span className="text-sm text-gray-900 truncate">{change.name}</span>
            {hasOwnChanges && (
              <span className="text-xs text-gray-400">
                ({change.changes.length} {change.changes.length === 1 ? 'change' : 'changes'})
              </span>
            )}
          </div>

          {/* Field changes (only if item has own changes and is selected) */}
          {hasOwnChanges && selected && (
            <div className="mt-2 ml-2 space-y-1">
              {change.changes.map(({ field, original, current }) => (
                <div key={field} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedFields.has(`${change.issueKey}:${field}`)}
                    onChange={() => onToggleField(change.issueKey, field)}
                    className="w-3 h-3 text-blue-600 rounded"
                  />
                  <FieldDiff field={field} original={original} current={current} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {change.children.map(child => (
            <ChangeItem
              key={child.issueKey}
              change={child}
              selected={selected}
              selectedFields={selectedFields}
              onToggleItem={onToggleItem}
              onToggleField={onToggleField}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Progress display during push
function PushProgress({ current, total, currentKey }) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="py-8 px-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Pushing to JIRA...</h3>
      <p className="text-sm text-gray-600 mb-4">
        Updating {currentKey} ({current} of {total})
      </p>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{percent}% complete</p>
    </div>
  );
}

// Results display after push
function PushResults({ results, onClose, onRetry }) {
  const hasFailures = results.failed.length > 0;

  return (
    <div className="py-6 px-6">
      {/* Success message */}
      {results.success.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-xl">✓</span>
            <span className="text-green-800 font-medium">
              {results.success.length} {results.success.length === 1 ? 'item' : 'items'} updated successfully
            </span>
          </div>
        </div>
      )}

      {/* Failures */}
      {hasFailures && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 text-xl">✕</span>
            <span className="text-red-800 font-medium">
              {results.failed.length} {results.failed.length === 1 ? 'item' : 'items'} failed
            </span>
          </div>
          <ul className="text-sm text-red-700 ml-6 space-y-1">
            {results.failed.map(({ issueKey, error }) => (
              <li key={issueKey}>
                <span className="font-mono">{issueKey}</span>: {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        {hasFailures && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            Retry Failed
          </button>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// Wrapper component to handle isOpen - unmounts inner content when closed
export default function PushToJiraModal({ isOpen, onClose, tasks, jiraImportSource, onUpdateOriginalState }) {
  if (!isOpen) return null;

  return (
    <PushToJiraModalContent
      onClose={onClose}
      tasks={tasks}
      jiraImportSource={jiraImportSource}
      onUpdateOriginalState={onUpdateOriginalState}
    />
  );
}

// Inner component with all state - remounts when modal reopens
function PushToJiraModalContent({ onClose, tasks, jiraImportSource, onUpdateOriginalState }) {
  const { syncToJira } = useJira();

  // Detect changes first to use in state initialization
  const allChanges = useMemo(() => {
    if (!jiraImportSource?.originalState) return [];
    return detectAllChanges(tasks, jiraImportSource.originalState);
  }, [tasks, jiraImportSource]);

  const changeTree = useMemo(() => {
    return groupChangesByHierarchy(allChanges, tasks);
  }, [allChanges, tasks]);

  // Initialize selection state with all items/fields selected
  const [selectedItems, setSelectedItems] = useState(() => {
    return new Set(allChanges.map(c => c.issueKey));
  });

  const [selectedFields, setSelectedFields] = useState(() => {
    const fields = new Set();
    allChanges.forEach(change => {
      change.changes.forEach(c => {
        fields.add(`${change.issueKey}:${c.field}`);
      });
    });
    return fields;
  });

  // View state: 'review' | 'confirm' | 'progress' | 'results'
  const [view, setView] = useState('review');

  // Filter state
  const [filter, setFilter] = useState('all'); // 'all' | 'dates' | 'effort' | 'assignment'

  // Push state
  const [progress, setProgress] = useState({ current: 0, total: 0, currentKey: '' });
  const [results, setResults] = useState({ success: [], failed: [] });

  const toggleItem = (issueKey) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(issueKey)) {
        next.delete(issueKey);
        // Also deselect all fields for this item
        setSelectedFields(prevFields => {
          const nextFields = new Set(prevFields);
          for (const key of nextFields) {
            if (key.startsWith(`${issueKey}:`)) {
              nextFields.delete(key);
            }
          }
          return nextFields;
        });
      } else {
        next.add(issueKey);
        // Also select all fields for this item
        const change = allChanges.find(c => c.issueKey === issueKey);
        if (change) {
          setSelectedFields(prevFields => {
            const nextFields = new Set(prevFields);
            change.changes.forEach(c => {
              nextFields.add(`${issueKey}:${c.field}`);
            });
            return nextFields;
          });
        }
      }
      return next;
    });
  };

  const toggleField = (issueKey, field) => {
    setSelectedFields(prev => {
      const key = `${issueKey}:${field}`;
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    const items = new Set(allChanges.map(c => c.issueKey));
    setSelectedItems(items);
    const fields = new Set();
    allChanges.forEach(change => {
      change.changes.forEach(c => {
        fields.add(`${change.issueKey}:${c.field}`);
      });
    });
    setSelectedFields(fields);
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
    setSelectedFields(new Set());
  };

  // Get selected changes for push
  const getSelectedChanges = () => {
    return allChanges.filter(change => {
      if (!selectedItems.has(change.issueKey)) return false;
      // Check if any fields are selected
      const hasSelectedFields = change.changes.some(c =>
        selectedFields.has(`${change.issueKey}:${c.field}`)
      );
      return hasSelectedFields;
    }).map(change => ({
      ...change,
      selectedFields: new Set(
        change.changes
          .filter(c => selectedFields.has(`${change.issueKey}:${c.field}`))
          .map(c => c.field)
      ),
    }));
  };

  const selectedCount = getSelectedChanges().length;

  // Execute push
  const executePush = async () => {
    const changesToPush = getSelectedChanges();
    if (changesToPush.length === 0) return;

    setView('progress');
    setProgress({ current: 0, total: changesToPush.length, currentKey: '' });

    const pushResults = { success: [], failed: [] };
    const newOriginalState = { ...jiraImportSource.originalState };

    for (let i = 0; i < changesToPush.length; i++) {
      const change = changesToPush[i];
      setProgress({ current: i + 1, total: changesToPush.length, currentKey: change.issueKey });

      try {
        const config = buildGanttConfig(change.current, change.selectedFields);
        const result = await syncToJira(jiraImportSource.cloudId, change.issueKey, config);

        if (result.success) {
          pushResults.success.push(change.issueKey);
          // Update original state with pushed values
          newOriginalState[change.issueKey] = {
            ...newOriginalState[change.issueKey],
            ...Object.fromEntries(
              Array.from(change.selectedFields).map(field => [field, change.current[field]])
            ),
          };
        } else {
          pushResults.failed.push({ issueKey: change.issueKey, error: result.error || 'Unknown error' });
        }
      } catch (err) {
        pushResults.failed.push({ issueKey: change.issueKey, error: err.message });
      }

      // Rate limiting delay
      if (i < changesToPush.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // Update original state in parent
    if (pushResults.success.length > 0 && onUpdateOriginalState) {
      onUpdateOriginalState(newOriginalState);
    }

    setResults(pushResults);
    setView('results');
  };

  const handleRetry = () => {
    // Reset to review with only failed items selected
    const failedKeys = new Set(results.failed.map(f => f.issueKey));
    setSelectedItems(failedKeys);
    // Re-select all fields for failed items
    const fields = new Set();
    allChanges.forEach(change => {
      if (failedKeys.has(change.issueKey)) {
        change.changes.forEach(c => {
          fields.add(`${change.issueKey}:${c.field}`);
        });
      }
    });
    setSelectedFields(fields);
    setView('review');
  };

  const { totalItems } = countChanges(allChanges);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Push Changes to JIRA</h2>
            {view === 'review' && totalItems > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {totalItems} items changed • {selectedCount} selected to push
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'review' && (
            <>
              {/* Toolbar */}
              {totalItems > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Filter:</span>
                    {['all', 'dates', 'effort', 'assignment'].map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2 py-1 text-xs rounded ${
                          filter === f
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                        }`}
                      >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button onClick={deselectAll} className="text-xs text-blue-600 hover:underline">
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* Change list */}
              <div className="flex-1 overflow-y-auto">
                {totalItems === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-4">✓</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No changes to push</h3>
                    <p className="text-sm text-gray-500">
                      All items match their original JIRA values.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {changeTree.map(change => (
                      <ChangeItem
                        key={change.issueKey}
                        change={change}
                        selected={selectedItems.has(change.issueKey)}
                        selectedFields={selectedFields}
                        onToggleItem={toggleItem}
                        onToggleField={toggleField}
                        depth={0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'confirm' && (
            <div className="py-8 px-6 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Push to JIRA</h3>
              <p className="text-gray-600 mb-6">
                This will update <strong>{selectedCount}</strong> {selectedCount === 1 ? 'issue' : 'issues'} in JIRA.
                <br />
                <span className="text-sm text-gray-500">
                  Only the GANTT_CONFIG section of each issue description will be modified.
                </span>
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setView('review')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={executePush}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Push to JIRA
                </button>
              </div>
            </div>
          )}

          {view === 'progress' && (
            <PushProgress {...progress} />
          )}

          {view === 'results' && (
            <PushResults results={results} onClose={onClose} onRetry={handleRetry} />
          )}
        </div>

        {/* Footer (only in review mode) */}
        {view === 'review' && totalItems > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => setView('confirm')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Push {selectedCount} {selectedCount === 1 ? 'Item' : 'Items'} to JIRA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
