import React from 'react';

const TEAM_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ef4444', '#06b6d4', '#ec4899'];
const SEGMENT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

export default function TeamsSegmentsModal({
  onClose,
  teams,
  segments,
  onAddTeam,
  onRemoveTeam,
  onAddSegment,
  onRemoveSegment,
  getTeamUsageCount,
  getSegmentUsageCount,
}) {
  const handleAddTeam = () => {
    const name = window.prompt('Enter team name:');
    if (name && name.trim()) {
      const key = name.trim();
      if (teams[key]) {
        alert('A team with this name already exists.');
        return;
      }
      const color = TEAM_COLORS[Object.keys(teams).length % TEAM_COLORS.length];
      onAddTeam(key, { name: key, color, bg: 'bg-gray-100', text: 'text-gray-700' });
    }
  };

  const handleAddSegment = () => {
    const name = window.prompt('Enter segment name:');
    if (name && name.trim()) {
      const key = name.trim();
      if (segments[key]) {
        alert('A segment with this name already exists.');
        return;
      }
      const color = SEGMENT_COLORS[Object.keys(segments).length % SEGMENT_COLORS.length];
      onAddSegment(key, { name: key, color, bg: 'bg-gray-100', text: 'text-gray-700' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Manage Teams & Customer Segments</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-8">
            {/* Teams Column */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Teams</h3>
              <div className="space-y-2">
                {Object.entries(teams).map(([key, team]) => {
                  const usage = getTeamUsageCount(key);
                  return (
                    <div key={key} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: team.color }} />
                        <span className="font-medium">{team.name}</span>
                        {usage > 0 && (
                          <span className="text-xs text-gray-400">({usage} uses)</span>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveTeam(key)}
                        className="text-red-500 hover:text-red-700 text-sm px-2"
                        title="Remove team"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleAddTeam}
                className="mt-3 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
              >
                + Add Team
              </button>
            </div>

            {/* Customer Segments Column */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Customer Segments</h3>
              <div className="space-y-2">
                {Object.entries(segments).map(([key, seg]) => {
                  const usage = getSegmentUsageCount(key);
                  return (
                    <div key={key} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2" style={{ borderColor: seg.color, backgroundColor: 'white' }} />
                        <span className="font-medium">{seg.name}</span>
                        {usage > 0 && (
                          <span className="text-xs text-gray-400">({usage} uses)</span>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveSegment(key)}
                        className="text-red-500 hover:text-red-700 text-sm px-2"
                        title="Remove segment"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleAddSegment}
                className="mt-3 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
              >
                + Add Customer Segment
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
