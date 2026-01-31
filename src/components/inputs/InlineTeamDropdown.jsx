import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DEFAULT_TEAMS } from '../../constants';

export default function InlineTeamDropdown({ value, onChange, teams }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, openUpward: false });
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const teamsData = teams || DEFAULT_TEAMS;

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

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 180;
      setPosition({
        top: openUpward ? rect.top : rect.bottom + 2,
        left: rect.left,
        openUpward
      });
    }
    setOpen(!open);
  };

  const handleSelect = (e, teamKey) => {
    e.stopPropagation();
    onChange(teamKey);
    setOpen(false);
  };

  const currentTeam = value && teamsData[value] ? teamsData[value] : null;

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleOpen}
        className={`${currentTeam ? `${currentTeam.bg} ${currentTeam.text}` : 'bg-gray-100 text-gray-500'} px-1.5 py-0.5 text-xs rounded font-medium cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {currentTeam ? currentTeam.name : 'Team'}
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[100px]"
          style={{
            top: position.openUpward ? 'auto' : position.top,
            bottom: position.openUpward ? window.innerHeight - position.top + 2 : 'auto',
            left: position.left
          }}
        >
          <button
            onClick={(e) => handleSelect(e, null)}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 text-gray-400"
          >
            Unassigned
          </button>
          {Object.entries(teamsData).map(([key, team]) => (
            <button
              key={key}
              onClick={(e) => handleSelect(e, key)}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${value === key ? 'bg-gray-50' : ''}`}
            >
              <span className={`${team.bg} ${team.text} px-1.5 py-0.5 rounded font-medium`}>
                {team.name}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
