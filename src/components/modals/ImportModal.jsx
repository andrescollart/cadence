import React, { useState } from 'react';

export default function ImportModal({ onClose, onImport }) {
  const [importData, setImportData] = useState('');

  const handleImport = () => {
    if (importData.trim()) {
      onImport(importData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Load Epic from JIRA</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 overflow-auto max-h-[65vh]">
          <div className="space-y-4">
            {/* Instructions */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Import Data</h3>
              <p className="text-sm text-blue-800">
                Paste JSON data below to load tasks into the Gantt chart. You can export data from an existing chart and import it here.
              </p>
            </div>

            {/* JSON Import Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste JSON Data
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder='{"tasks": [...]}'
                className="w-full h-48 px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>

            {/* Sample Format */}
            <details className="text-sm">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                Expected JSON format
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs overflow-auto">
{`{
  "tasks": [
    {
      "id": "TASK-001",
      "name": "Phase 1: MVP",
      "startDate": "2026-02-03",
      "endDate": "2026-03-13",
      "team": "Engineering",
      "segments": ["Core"],
      "subtasks": [
        {
          "id": "TASK-002",
          "name": "1.1 Setup project",
          "startDate": "2026-02-03",
          "endDate": "2026-02-14",
          "team": "Engineering"
        }
      ]
    }
  ]
}`}
              </pre>
            </details>
          </div>
        </div>
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!importData.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import Data
          </button>
        </div>
      </div>
    </div>
  );
}
