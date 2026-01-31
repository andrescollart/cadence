import React from 'react';
import { DEFAULT_SEGMENTS } from '../../constants';

export default function SegmentTags({ segments, segmentsData, size = 'sm' }) {
  const segsData = segmentsData || DEFAULT_SEGMENTS;
  if (!segments || segments.length === 0) return null;
  const sizeClasses = size === 'sm' ? 'px-1 py-0.5 text-xs' : 'px-1.5 py-0.5 text-xs';
  return (
    <div className="flex flex-wrap gap-1">
      {segments.map(seg => {
        const s = segsData[seg];
        if (!s) return null;
        return (
          <span
            key={seg}
            className={`${sizeClasses} rounded border bg-white`}
            style={{ borderColor: s.color, color: s.color }}
          >
            {s.name}
          </span>
        );
      })}
    </div>
  );
}
