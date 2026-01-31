import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DEFAULT_SEGMENTS } from '../../constants';

export default function InlineSegmentEditor({ value, onChange, segments }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, openUpward: false });
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const segsData = segments || DEFAULT_SEGMENTS;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleOpenAdd = (e) => {
    e.stopPropagation();
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 200;
      setPosition({
        top: openUpward ? rect.top : rect.bottom + 2,
        left: rect.left,
        openUpward
      });
    }
    setOpen(!open);
  };

  const handleRemove = (e, seg) => {
    e.stopPropagation();
    onChange(value.filter(s => s !== seg));
  };

  const handleAdd = (e, seg) => {
    e.stopPropagation();
    if (!value.includes(seg)) {
      onChange([...value, seg]);
    }
    setOpen(false);
  };

  const availableSegments = Object.keys(segsData).filter(seg => !value.includes(seg));

  return (
    <div ref={ref} className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {value.map(seg => {
        const s = segsData[seg];
        if (!s) return null;
        return (
          <span
            key={seg}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 text-xs rounded border bg-white group"
            style={{ borderColor: s.color, color: s.color }}
          >
            {s.name}
            <button
              onClick={(e) => handleRemove(e, seg)}
              className="ml-0.5 hover:bg-gray-100 rounded px-0.5 opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </span>
        );
      })}
      <button
        onClick={handleOpenAdd}
        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded text-sm"
        title="Add segment"
      >
        +
      </button>
      {open && availableSegments.length > 0 && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[120px]"
          style={{
            top: position.openUpward ? 'auto' : position.top,
            bottom: position.openUpward ? window.innerHeight - position.top + 2 : 'auto',
            left: position.left
          }}
        >
          {availableSegments.map(seg => {
            const s = segsData[seg];
            return (
              <button
                key={seg}
                onClick={(e) => handleAdd(e, seg)}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
              >
                <span
                  className="px-1.5 py-0.5 rounded border"
                  style={{ borderColor: s.color, color: s.color }}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
