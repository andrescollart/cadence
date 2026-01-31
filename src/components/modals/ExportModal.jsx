import React, { useState } from 'react';

export default function ExportModal({ onClose, onGenerateExport }) {
  const [exportData, setExportData] = useState(null);

  const handleGenerate = () => {
    const data = onGenerateExport();
    setExportData(JSON.stringify(data, null, 2));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Export your Gantt chart data as JSON. You can later import this data to restore your schedule.
            </p>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              Generate Export Data
            </button>
          </div>
          {exportData && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Export Data — Select all and copy:
              </label>
              <textarea
                readOnly
                value={exportData}
                className="w-full h-64 p-2 text-xs font-mono bg-gray-50 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
