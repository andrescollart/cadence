import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_SEGMENTS } from '../../constants';

export default function SegmentSelect({ value, onChange, segments }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const segsData = segments || DEFAULT_SEGMENTS;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (seg) => {
    if (value.includes(seg)) {
      onChange(value.filter(s => s !== seg));
    } else {
      onChange([...value, seg]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border rounded-lg text-left text-sm flex items-center justify-between bg-white"
      >
        <span className="truncate">
          {value.length === 0 ? 'Select segments...' : value.join(', ')}
        </span>
        <span className="ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg">
          {Object.keys(segsData).map(seg => (
            <label key={seg} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(seg)}
                onChange={() => toggle(seg)}
                className="mr-2"
              />
              <span className={`${segsData[seg].bg} ${segsData[seg].text} px-1.5 py-0.5 rounded text-xs`}>
                {seg}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
