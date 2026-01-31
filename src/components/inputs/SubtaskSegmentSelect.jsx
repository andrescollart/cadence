import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_SEGMENTS } from '../../constants';

export default function SubtaskSegmentSelect({ value, onChange, segments }) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
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

  const handleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 150);
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="w-full px-1 py-0.5 border rounded text-xs text-left flex items-center justify-between bg-white min-h-[24px]"
      >
        {value.length === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-0.5">
            {value.map(seg => {
              const s = segsData[seg];
              return s ? (
                <span
                  key={seg}
                  className="px-1 rounded border text-[10px]"
                  style={{ borderColor: s.color, color: s.color }}
                >
                  {s.name}
                </span>
              ) : null;
            })}
          </div>
        )}
        <span className="ml-1 text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={`absolute z-50 w-32 bg-white border rounded shadow-lg ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {Object.keys(segsData).map(seg => (
            <label key={seg} className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={value.includes(seg)}
                onChange={() => toggle(seg)}
                className="mr-1.5 h-3 w-3"
              />
              <span
                className="px-1 rounded border"
                style={{ borderColor: segsData[seg].color, color: segsData[seg].color }}
              >
                {seg}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
