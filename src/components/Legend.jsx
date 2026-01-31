import React from 'react';

export default function Legend({ teams, segments }) {
  return (
    <div className="mt-4 bg-white rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap gap-6 text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-500 font-medium">Teams:</span>
          {Object.entries(teams).map(([key, team]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`${team.bg} ${team.text} px-1.5 py-0.5 rounded text-xs font-medium`}>{team.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 font-medium">Segments:</span>
          {Object.entries(segments).map(([key, seg]) => (
            <div key={key} className="flex items-center gap-1">
              <span
                className="px-1.5 py-0.5 rounded text-xs border bg-white"
                style={{ borderColor: seg.color, color: seg.color }}
              >
                {seg.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
