import React from 'react';

export default function CompactEffortInput({ feValue, beValue, onFEChange, onBEChange }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="0.5"
        value={feValue || 0}
        onChange={(e) => onFEChange(parseFloat(e.target.value) || 0)}
        onClick={(e) => e.stopPropagation()}
        className="w-10 px-1 py-0.5 text-xs border rounded text-center"
        title="FE Days"
      />
      <span className="text-gray-300">/</span>
      <input
        type="number"
        min="0"
        step="0.5"
        value={beValue || 0}
        onChange={(e) => onBEChange(parseFloat(e.target.value) || 0)}
        onClick={(e) => e.stopPropagation()}
        className="w-10 px-1 py-0.5 text-xs border rounded text-center"
        title="BE Days"
      />
    </div>
  );
}
