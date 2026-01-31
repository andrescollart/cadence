import React from 'react';

export default function EmptyState({ onImport }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-6xl mb-4">📋</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
      <p className="text-gray-500 mb-6 max-w-sm">
        Import from JIRA to get started, or add tasks manually using the timeline.
      </p>
      <button
        onClick={onImport}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        🔗 Import from JIRA
      </button>
    </div>
  );
}
