import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// Utility: Calculate working days between two dates (excludes weekends)
function getWorkingDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(count, 1);
}

// Utility: Get Monday of the week for a given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// Utility: Check if a date range overlaps with a week
function rangeOverlapsWeek(startDate, endDate, weekStart) {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  return rangeStart <= weekEndDate && rangeEnd >= weekStartDate;
}

// Utility: Check if a date is a working day (M-F)
function isWorkingDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

// Utility: Get total working days between viewStart and viewEnd
function getTotalWorkingDays(viewStart, viewEnd) {
  let count = 0;
  const current = new Date(viewStart);
  while (current < viewEnd) {
    if (isWorkingDay(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Utility: Convert working day offset to actual date
function workingDayOffsetToDate(viewStart, offset) {
  const date = new Date(viewStart);
  let workingDaysCount = 0;
  while (workingDaysCount < offset) {
    date.setDate(date.getDate() + 1);
    if (isWorkingDay(date)) workingDaysCount++;
  }
  // Ensure we land on a working day
  while (!isWorkingDay(date)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

// Utility: Convert actual date to working day offset from viewStart
function dateToWorkingDayOffset(viewStart, targetDate) {
  const target = new Date(targetDate);
  const start = new Date(viewStart);
  let offset = 0;
  const current = new Date(start);
  while (current < target) {
    if (isWorkingDay(current)) offset++;
    current.setDate(current.getDate() + 1);
  }
  return offset;
}

// Parse GANTT_CONFIG from issue description
function parseGanttConfig(description) {
  if (!description) return null;
  const match = description.match(/`GANTT_CONFIG:\s*(\{[^`]+\})`/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn('Failed to parse GANTT_CONFIG:', e);
    }
  }
  return null;
}

// Generate description with GANTT_CONFIG appended
function appendGanttConfig(description, config) {
  // Remove existing GANTT_CONFIG if present
  const cleanDesc = (description || '').replace(/\n*-{3,}\n*`GANTT_CONFIG:[^`]+`\s*$/, '').trim();
  const configJson = JSON.stringify(config);
  return `${cleanDesc}\n\n----\n\n\`GANTT_CONFIG: ${configJson}\``;
}

// Phase colors for auto-assignment
const PHASE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // cyan
];

const DEFAULT_TEAMS = {
  Engineering: { name: 'Engineering', color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  Design: { name: 'Design', color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700' },
  Product: { name: 'Product', color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const DEFAULT_SEGMENTS = {
  'Core': { name: 'Core', color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  'Platform': { name: 'Platform', color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700' },
};

const initialTasks = [];

const ROW_HEIGHT = 48;
const SUBTASK_ROW_HEIGHT = 36;
const HEADER_HEIGHT = 60;

const ZOOM_LEVELS = [
  { label: '1W', dayWidth: 56, monthsToShow: 4 },
  { label: '2W', dayWidth: 42, monthsToShow: 5 },
  { label: '1M', dayWidth: 28, monthsToShow: 7 },
  { label: '2M', dayWidth: 14, monthsToShow: 9 },
  { label: 'Q', dayWidth: 8, monthsToShow: 12 },
];

// Team Badge Component
function TeamBadge({ team, teams, size = 'sm' }) {
  const teamsData = teams || DEFAULT_TEAMS;
  if (!team || !teamsData[team]) return null;
  const t = teamsData[team];
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';
  return (
    <span className={`${t.bg} ${t.text} ${sizeClasses} rounded font-medium`}>
      {t.name}
    </span>
  );
}

// Segment Tags Component - outlined style to differentiate from team badges
function SegmentTags({ segments, segmentsData, size = 'sm' }) {
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

// Multi-select dropdown for segments
function SegmentSelect({ value, onChange, segments }) {
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

// Compact multi-select for subtask segments (table-friendly)
function SubtaskSegmentSelect({ value, onChange, segments }) {
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

// Inline Team Dropdown - clickable team badge that opens a dropdown
function InlineTeamDropdown({ value, onChange, teams }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, openUpward: false });
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const teamsData = teams || DEFAULT_TEAMS;

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is inside the trigger button
      if (ref.current && ref.current.contains(e.target)) return;
      // Check if click is inside the dropdown (if it exists)
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      // Otherwise close
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

// Inline Segment Editor - segments with remove buttons and add dropdown
function InlineSegmentEditor({ value, onChange, segments }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, openUpward: false });
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const segsData = segments || DEFAULT_SEGMENTS;

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is inside the trigger container
      if (ref.current && ref.current.contains(e.target)) return;
      // Check if click is inside the dropdown (if it exists)
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      // Otherwise close
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
              ×
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

// Compact Effort Input - dual FE/BE inputs
function CompactEffortInput({ feValue, beValue, onFEChange, onBEChange }) {
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

export default function GanttChart() {
  const [tasks, setTasks] = useState(initialTasks);
  const [dependencyMode, setDependencyMode] = useState(false);
  const [dependencySource, setDependencySource] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  // Calculate project bounds from task dates
  const projectBounds = useMemo(() => {
    let earliest = null;
    let latest = null;
    tasks.forEach(task => {
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      if (!earliest || taskStart < earliest) earliest = taskStart;
      if (!latest || taskEnd > latest) latest = taskEnd;
      task.subtasks.forEach(st => {
        if (st.startDate) {
          const stStart = new Date(st.startDate);
          if (!earliest || stStart < earliest) earliest = stStart;
        }
        if (st.endDate) {
          const stEnd = new Date(st.endDate);
          if (!latest || stEnd > latest) latest = stEnd;
        }
      });
    });
    // Default fallback
    if (!earliest) earliest = new Date('2026-02-01');
    if (!latest) latest = new Date('2026-12-31');
    // Add 1 month buffer before earliest
    const minView = new Date(earliest);
    minView.setMonth(minView.getMonth() - 1);
    minView.setDate(1); // Start of month for cleaner display
    return { earliest, latest, minView };
  }, [tasks]);

  const [viewStart, setViewStart] = useState(() => {
    // Default to current month when no tasks
    if (initialTasks.length === 0) {
      const now = new Date();
      now.setDate(1);
      return now;
    }
    // Start view 1 month before earliest task
    const earliest = initialTasks.reduce((min, t) => {
      const d = new Date(t.startDate);
      return d < min ? d : min;
    }, new Date('2100-01-01'));
    const start = new Date(earliest);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    return start;
  });

  const [timelineSetMode, setTimelineSetMode] = useState(false);
  const [timelineDrawing, setTimelineDrawing] = useState(null);

  const [zoomLevel, setZoomLevel] = useState(2);
  const DAY_WIDTH = ZOOM_LEVELS[zoomLevel].dayWidth;

  // Filters
  const [filterTeam, setFilterTeam] = useState(null);
  const [filterSegment, setFilterSegment] = useState(null);
  const [colorByTeam, setColorByTeam] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncOutput, setSyncOutput] = useState(null);

  // Capacity planning state - Team-based pools
  const [showCapacitySettings, setShowCapacitySettings] = useState(false);
  const [capacityConfig, setCapacityConfig] = useState({
    teamCapacities: {
      Engineering: { fe: 2, be: 2 },
      Design: { fe: 2, be: 0 },
      Product: { fe: 0, be: 0 }
    }
  });

  // Calendar display settings
  const [showWorkingDaysOnly, setShowWorkingDaysOnly] = useState(true);
  const [showResourceChart, setShowResourceChart] = useState(true);
  const [resourceViewMode, setResourceViewMode] = useState('byTeam'); // 'byTeam' or 'aggregate'

  // Teams and Segments configuration (editable)
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [segments, setSegments] = useState(DEFAULT_SEGMENTS);
  const [showTeamsSegmentsManager, setShowTeamsSegmentsManager] = useState(false);

  // Import state
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [jiraImportData, setJiraImportData] = useState('');

  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);

  // Import tasks from JIRA JSON data
  const importFromJira = useCallback((jiraData) => {
    try {
      const data = typeof jiraData === 'string' ? JSON.parse(jiraData) : jiraData;

      // Track original dates for sync comparison
      const newOriginalDates = {};

      // Convert JIRA issues to Gantt tasks
      const newTasks = data.tasks.map((issue, index) => {
        // Parse GANTT_CONFIG from description
        const config = parseGanttConfig(issue.description);

        // Store original dates
        newOriginalDates[issue.id] = {
          startDate: issue.startDate,
          dueDate: issue.endDate
        };

        // Build subtasks
        const subtasks = (issue.subtasks || []).map(st => {
          const stConfig = parseGanttConfig(st.description);
          newOriginalDates[st.id] = {
            startDate: st.startDate,
            dueDate: st.endDate
          };
          return {
            id: st.id,
            name: st.name,
            status: st.status || 'To Do',
            team: stConfig?.team || st.team || null,
            segments: stConfig?.segments || st.segments || [],
            startDate: st.startDate || issue.startDate,
            endDate: st.endDate || issue.endDate,
            feEffortDays: stConfig?.feEffortDays ?? st.feEffortDays ?? 0,
            beEffortDays: stConfig?.beEffortDays ?? st.beEffortDays ?? 0,
          };
        });

        return {
          id: issue.id,
          name: issue.name,
          phase: index + 1,
          status: issue.status || 'ToDo',
          startDate: issue.startDate || new Date().toISOString().split('T')[0],
          endDate: issue.endDate || new Date().toISOString().split('T')[0],
          dependencies: issue.dependencies || [],
          description: issue.description || '',
          color: PHASE_COLORS[index % PHASE_COLORS.length],
          team: config?.team || issue.team || null,
          segments: config?.segments || issue.segments || [],
          feEffortDays: config?.feEffortDays ?? issue.feEffortDays ?? 0,
          beEffortDays: config?.beEffortDays ?? issue.beEffortDays ?? 0,
          subtasks,
        };
      });

      setTasks(newTasks);
      setShowLoadModal(false);
      setJiraImportData('');

      // Auto-adjust view to show the data
      if (newTasks.length > 0) {
        const earliest = newTasks.reduce((min, t) =>
          t.startDate < min ? t.startDate : min, newTasks[0].startDate);
        const startDate = new Date(earliest);
        startDate.setDate(1); // Start of month
        setViewStart(startDate);
      }

      return true;
    } catch (e) {
      console.error('Failed to import JIRA data:', e);
      alert('Failed to import: ' + e.message);
      return false;
    }
  }, []);

  // Generate export data for tasks
  const generateExportData = useCallback(() => {
    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      endDate: task.endDate,
      team: task.team,
      segments: task.segments,
      feEffortDays: task.feEffortDays || 0,
      beEffortDays: task.beEffortDays || 0,
      subtasks: task.subtasks.map(st => ({
        id: st.id,
        name: st.name,
        startDate: st.startDate,
        endDate: st.endDate,
        team: st.team,
        segments: st.segments,
        feEffortDays: st.feEffortDays || 0,
        beEffortDays: st.beEffortDays || 0,
      }))
    }));
  }, [tasks]);

  const toggleExpanded = (taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTasks(new Set(tasks.filter(t => t.subtasks.length > 0).map(t => t.id)));
  };

  const collapseAll = () => {
    setExpandedTasks(new Set());
  };

  // Filter tasks based on team and segment
  const filteredTasks = useMemo(() => {
    return tasks.map(task => {
      const taskMatches = (!filterTeam || task.team === filterTeam) &&
                          (!filterSegment || task.segments?.includes(filterSegment));

      const filteredSubtasks = task.subtasks.filter(st =>
        (!filterTeam || st.team === filterTeam) &&
        (!filterSegment || st.segments?.includes(filterSegment))
      );

      if (taskMatches || filteredSubtasks.length > 0) {
        return { ...task, subtasks: taskMatches ? task.subtasks : filteredSubtasks, _dimmed: !taskMatches };
      }
      return null;
    }).filter(Boolean);
  }, [tasks, filterTeam, filterSegment]);

  // Build flat list of visible rows
  const visibleRows = useMemo(() => {
    const rows = [];
    filteredTasks.forEach(task => {
      rows.push({ type: 'task', data: task });
      if (expandedTasks.has(task.id)) {
        task.subtasks.forEach(subtask => {
          const subtaskMatches = (!filterTeam || subtask.team === filterTeam) &&
                                 (!filterSegment || subtask.segments?.includes(filterSegment));
          rows.push({ type: 'subtask', data: subtask, parent: task, _dimmed: !subtaskMatches });
        });
      }
    });
    return rows;
  }, [filteredTasks, expandedTasks, filterTeam, filterSegment]);

  const viewEnd = useMemo(() => {
    const end = new Date(viewStart);
    end.setMonth(end.getMonth() + ZOOM_LEVELS[zoomLevel].monthsToShow);
    return end;
  }, [viewStart, zoomLevel]);

  const totalDays = useMemo(() => {
    if (showWorkingDaysOnly) {
      return getTotalWorkingDays(viewStart, viewEnd);
    }
    return Math.ceil((viewEnd - viewStart) / (1000 * 60 * 60 * 24));
  }, [viewStart, viewEnd, showWorkingDaysOnly]);

  // Calculate weekly resource demand
  const resourceData = useMemo(() => {
    // Get all weeks in the range
    const weeks = [];
    const current = new Date(viewStart);
    // Start from the Monday of the first week
    const startMonday = new Date(getWeekStart(current));

    const endDate = new Date(viewEnd);
    endDate.setMonth(endDate.getMonth() + 2); // Extend a bit beyond view

    let weekStart = new Date(startMonday);
    while (weekStart < endDate) {
      weeks.push(weekStart.toISOString().split('T')[0]);
      weekStart.setDate(weekStart.getDate() + 7);
    }

    // Collect all work items (subtasks + parent tasks without subtasks)
    const workItems = [];

    // Apply team filter if active
    const tasksToProcess = filterTeam
      ? tasks.filter(t => t.team === filterTeam || t.subtasks.some(st => st.team === filterTeam))
      : tasks;

    tasksToProcess.forEach(task => {
      if (task.subtasks.length === 0) {
        // Parent task without subtasks - use its own effort
        if (!filterTeam || task.team === filterTeam) {
          workItems.push({
            startDate: task.startDate,
            endDate: task.endDate,
            feEffortDays: task.feEffortDays || 0,
            beEffortDays: task.beEffortDays || 0,
            team: task.team
          });
        }
      } else {
        // Use subtasks
        task.subtasks.forEach(st => {
          if (!filterTeam || st.team === filterTeam) {
            workItems.push({
              startDate: st.startDate,
              endDate: st.endDate,
              feEffortDays: st.feEffortDays || 0,
              beEffortDays: st.beEffortDays || 0,
              team: st.team
            });
          }
        });
      }
    });

    // Calculate FTE for each week - by team
    return weeks.map(weekStart => {
      // Initialize per-team tracking
      const teamData = {};
      Object.keys(teams).forEach(team => {
        teamData[team] = { fe: 0, be: 0 };
      });
      teamData['Unassigned'] = { fe: 0, be: 0 };

      workItems.forEach(item => {
        if (rangeOverlapsWeek(item.startDate, item.endDate, weekStart)) {
          const workingDays = getWorkingDays(item.startDate, item.endDate);
          const dailyFe = item.feEffortDays / workingDays;
          const dailyBe = item.beEffortDays / workingDays;
          const team = item.team || 'Unassigned';
          if (teamData[team]) {
            teamData[team].fe += dailyFe;
            teamData[team].be += dailyBe;
          } else {
            teamData['Unassigned'].fe += dailyFe;
            teamData['Unassigned'].be += dailyBe;
          }
        }
      });

      // Calculate totals and check over-allocation per team
      let totalFe = 0;
      let totalBe = 0;
      const teamBreakdown = {};
      let hasOverAllocation = false;

      Object.keys(teams).forEach(team => {
        const cap = capacityConfig.teamCapacities[team] || { fe: 1, be: 1 };
        const fe = Math.round(teamData[team].fe * 100) / 100;
        const be = Math.round(teamData[team].be * 100) / 100;
        const feOver = fe > cap.fe;
        const beOver = be > cap.be;
        if (feOver || beOver) hasOverAllocation = true;
        teamBreakdown[team] = { fe, be, feCap: cap.fe, beCap: cap.be, feOver, beOver };
        totalFe += fe;
        totalBe += be;
      });

      // Add unassigned
      if (teamData['Unassigned'].fe > 0 || teamData['Unassigned'].be > 0) {
        teamBreakdown['Unassigned'] = {
          fe: Math.round(teamData['Unassigned'].fe * 100) / 100,
          be: Math.round(teamData['Unassigned'].be * 100) / 100,
          feCap: 0, beCap: 0, feOver: true, beOver: true
        };
        totalFe += teamBreakdown['Unassigned'].fe;
        totalBe += teamBreakdown['Unassigned'].be;
      }

      const weekDate = new Date(weekStart);
      const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Calculate total capacity
      const totalFeCap = Object.values(capacityConfig.teamCapacities).reduce((sum, t) => sum + t.fe, 0);
      const totalBeCap = Object.values(capacityConfig.teamCapacities).reduce((sum, t) => sum + t.be, 0);

      return {
        week: weekLabel,
        weekStart,
        fe: totalFe,
        be: totalBe,
        feCap: totalFeCap,
        beCap: totalBeCap,
        feOver: totalFe > totalFeCap,
        beOver: totalBe > totalBeCap,
        teamBreakdown,
        hasTeamOverAllocation: hasOverAllocation
      };
    });
  }, [tasks, viewStart, viewEnd, capacityConfig, filterTeam]);

  // Calculate totals for summary - with per-team breakdown
  const resourceSummary = useMemo(() => {
    // Initialize per-team totals
    const teamTotals = {};
    Object.keys(teams).forEach(team => {
      teamTotals[team] = { feDays: 0, beDays: 0, peakFe: 0, peakBe: 0, overAllocatedWeeks: 0 };
    });

    // Apply team filter
    const tasksToProcess = filterTeam
      ? tasks.filter(t => t.team === filterTeam || t.subtasks.some(st => st.team === filterTeam))
      : tasks;

    let totalFeDays = 0;
    let totalBeDays = 0;

    tasksToProcess.forEach(task => {
      if (task.subtasks.length === 0) {
        if (!filterTeam || task.team === filterTeam) {
          totalFeDays += task.feEffortDays || 0;
          totalBeDays += task.beEffortDays || 0;
          if (task.team && teamTotals[task.team]) {
            teamTotals[task.team].feDays += task.feEffortDays || 0;
            teamTotals[task.team].beDays += task.beEffortDays || 0;
          }
        }
      } else {
        task.subtasks.forEach(st => {
          if (!filterTeam || st.team === filterTeam) {
            totalFeDays += st.feEffortDays || 0;
            totalBeDays += st.beEffortDays || 0;
            if (st.team && teamTotals[st.team]) {
              teamTotals[st.team].feDays += st.feEffortDays || 0;
              teamTotals[st.team].beDays += st.beEffortDays || 0;
            }
          }
        });
      }
    });

    // Calculate peaks and over-allocation per team from resourceData
    Object.keys(teams).forEach(team => {
      resourceData.forEach(week => {
        if (week.teamBreakdown && week.teamBreakdown[team]) {
          const tb = week.teamBreakdown[team];
          teamTotals[team].peakFe = Math.max(teamTotals[team].peakFe, tb.fe);
          teamTotals[team].peakBe = Math.max(teamTotals[team].peakBe, tb.be);
          if (tb.feOver || tb.beOver) {
            teamTotals[team].overAllocatedWeeks++;
          }
        }
      });
    });

    const peakFe = Math.max(...resourceData.map(d => d.fe), 0);
    const peakBe = Math.max(...resourceData.map(d => d.be), 0);
    const overAllocatedWeeks = resourceData.filter(d => d.hasTeamOverAllocation).length;

    // Count teams with over-allocation issues
    const teamsOverAllocated = Object.entries(teamTotals).filter(([_, t]) => t.overAllocatedWeeks > 0).map(([name]) => name);

    return { totalFeDays, totalBeDays, peakFe, peakBe, overAllocatedWeeks, teamTotals, teamsOverAllocated };
  }, [tasks, resourceData, filterTeam]);

  const months = useMemo(() => {
    const result = [];
    let current = new Date(viewStart);
    let cumulativeWorkingDays = 0;
    while (current < viewEnd) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const endDate = monthEnd > viewEnd ? viewEnd : monthEnd;
      let days;
      let startDay;
      if (showWorkingDaysOnly) {
        days = getWorkingDays(monthStart.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
        startDay = cumulativeWorkingDays;
        cumulativeWorkingDays += days;
      } else {
        days = Math.ceil((endDate - monthStart) / (1000 * 60 * 60 * 24)) + 1;
        startDay = Math.ceil((monthStart - viewStart) / (1000 * 60 * 60 * 24));
      }
      result.push({
        name: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        days,
        startDay
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    return result;
  }, [viewStart, viewEnd, showWorkingDaysOnly]);

  const dayToDate = useCallback((dayOffset) => {
    if (showWorkingDaysOnly) {
      const date = workingDayOffsetToDate(viewStart, dayOffset);
      return date.toISOString().split('T')[0];
    }
    const date = new Date(viewStart);
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString().split('T')[0];
  }, [viewStart, showWorkingDaysOnly]);

  const getTaskPosition = useCallback((task) => {
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    if (showWorkingDaysOnly) {
      const startDay = Math.max(0, dateToWorkingDayOffset(viewStart, start));
      const duration = getWorkingDays(task.startDate, task.endDate);
      return { startDay, duration };
    }
    const startDay = Math.max(0, Math.ceil((start - viewStart) / (1000 * 60 * 60 * 24)));
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return { startDay, duration };
  }, [viewStart, showWorkingDaysOnly]);

  const handleBarMouseDown = (e, task, type) => {
    e.stopPropagation();
    if (dependencyMode) {
      if (!dependencySource) {
        setDependencySource(task.id);
      } else if (dependencySource !== task.id) {
        setTasks(prev => prev.map(t => {
          if (t.id === task.id && !t.dependencies.includes(dependencySource)) {
            return { ...t, dependencies: [...t.dependencies, dependencySource] };
          }
          return t;
        }));
        setDependencySource(null);
        setDependencyMode(false);
      }
      return;
    }

    if (timelineSetMode) return;

    const rect = chartRef.current.getBoundingClientRect();
    setDragState({
      taskId: task.id,
      type,
      startX: e.clientX - rect.left,
      originalStart: task.startDate,
      originalEnd: task.endDate
    });
  };

  const handleTimelineMouseDown = (e, rowIndex) => {
    if (!timelineSetMode || !chartRef.current) return;

    const row = visibleRows[rowIndex];
    if (!row || row.type !== 'task') return;

    const task = row.data;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayOffset = Math.floor(x / DAY_WIDTH);

    setTimelineDrawing({
      taskId: task.id,
      rowIndex,
      startDay: dayOffset,
      currentDay: dayOffset
    });

    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        const newDate = dayToDate(dayOffset);
        return { ...t, startDate: newDate, endDate: newDate };
      }
      return t;
    }));
  };

  // Handle subtask timeline drawing
  const handleSubtaskTimelineMouseDown = (e, rowIndex, parentId, subtaskId) => {
    if (!timelineSetMode || !chartRef.current) return;

    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayOffset = Math.floor(x / DAY_WIDTH);

    setTimelineDrawing({
      parentId,
      subtaskId,
      rowIndex,
      startDay: dayOffset,
      currentDay: dayOffset
    });

    setTasks(prev => prev.map(t => {
      if (t.id === parentId) {
        return {
          ...t,
          subtasks: t.subtasks.map(st => {
            if (st.id === subtaskId) {
              const newDate = dayToDate(dayOffset);
              return { ...st, startDate: newDate, endDate: newDate };
            }
            return st;
          })
        };
      }
      return t;
    }));
  };

  // Handle subtask bar dragging
  const handleSubtaskBarMouseDown = (e, parentId, subtask, type) => {
    e.stopPropagation();
    if (dependencyMode || timelineSetMode) return;

    const rect = chartRef.current.getBoundingClientRect();
    setDragState({
      taskId: subtask.id,
      parentId,
      type,
      isSubtask: true,
      startX: e.clientX - rect.left,
      originalStart: subtask.startDate,
      originalEnd: subtask.endDate
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!chartRef.current) return;

    const rect = chartRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;

    if (timelineDrawing) {
      const currentDay = Math.floor(currentX / DAY_WIDTH);

      setTimelineDrawing(prev => ({ ...prev, currentDay }));

      // Handle subtask timeline drawing
      if (timelineDrawing.subtaskId) {
        setTasks(prev => prev.map(task => {
          if (task.id !== timelineDrawing.parentId) return task;

          const startDay = Math.min(timelineDrawing.startDay, currentDay);
          const endDay = Math.max(timelineDrawing.startDay, currentDay);

          return {
            ...task,
            subtasks: task.subtasks.map(st => {
              if (st.id !== timelineDrawing.subtaskId) return st;
              return {
                ...st,
                startDate: dayToDate(startDay),
                endDate: dayToDate(endDay)
              };
            })
          };
        }));
      } else {
        // Handle task timeline drawing
        setTasks(prev => prev.map(task => {
          if (task.id !== timelineDrawing.taskId) return task;

          const startDay = Math.min(timelineDrawing.startDay, currentDay);
          const endDay = Math.max(timelineDrawing.startDay, currentDay);

          return {
            ...task,
            startDate: dayToDate(startDay),
            endDate: dayToDate(endDay)
          };
        }));
      }
      return;
    }

    if (!dragState) return;

    const dayDiff = Math.round((currentX - dragState.startX) / DAY_WIDTH);

    // Handle subtask dragging
    if (dragState.isSubtask) {
      setTasks(prev => prev.map(task => {
        if (task.id !== dragState.parentId) return task;

        return {
          ...task,
          subtasks: task.subtasks.map(st => {
            if (st.id !== dragState.taskId) return st;

            const originalStart = new Date(dragState.originalStart);
            const originalEnd = new Date(dragState.originalEnd);

            if (dragState.type === 'move') {
              const newStart = new Date(originalStart);
              newStart.setDate(newStart.getDate() + dayDiff);
              const newEnd = new Date(originalEnd);
              newEnd.setDate(newEnd.getDate() + dayDiff);
              return {
                ...st,
                startDate: newStart.toISOString().split('T')[0],
                endDate: newEnd.toISOString().split('T')[0]
              };
            } else if (dragState.type === 'start') {
              const newStart = new Date(originalStart);
              newStart.setDate(newStart.getDate() + dayDiff);
              if (newStart < originalEnd) {
                return { ...st, startDate: newStart.toISOString().split('T')[0] };
              }
            } else if (dragState.type === 'end') {
              const newEnd = new Date(originalEnd);
              newEnd.setDate(newEnd.getDate() + dayDiff);
              if (newEnd > originalStart) {
                return { ...st, endDate: newEnd.toISOString().split('T')[0] };
              }
            }
            return st;
          })
        };
      }));
      return;
    }

    // Handle task dragging
    setTasks(prev => prev.map(task => {
      if (task.id !== dragState.taskId) return task;

      const originalStart = new Date(dragState.originalStart);
      const originalEnd = new Date(dragState.originalEnd);

      if (dragState.type === 'move') {
        const newStart = new Date(originalStart);
        newStart.setDate(newStart.getDate() + dayDiff);
        const newEnd = new Date(originalEnd);
        newEnd.setDate(newEnd.getDate() + dayDiff);
        return {
          ...task,
          startDate: newStart.toISOString().split('T')[0],
          endDate: newEnd.toISOString().split('T')[0]
        };
      } else if (dragState.type === 'start') {
        const newStart = new Date(originalStart);
        newStart.setDate(newStart.getDate() + dayDiff);
        if (newStart < originalEnd) {
          return { ...task, startDate: newStart.toISOString().split('T')[0] };
        }
      } else if (dragState.type === 'end') {
        const newEnd = new Date(originalEnd);
        newEnd.setDate(newEnd.getDate() + dayDiff);
        if (newEnd > originalStart) {
          return { ...task, endDate: newEnd.toISOString().split('T')[0] };
        }
      }
      return task;
    }));
  }, [dragState, timelineDrawing, dayToDate, DAY_WIDTH]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setTimelineDrawing(null);
  }, []);

  useEffect(() => {
    if (dragState || timelineDrawing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, timelineDrawing, handleMouseMove, handleMouseUp]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoomLevel(prev => Math.max(0, prev - 1));
      } else {
        setZoomLevel(prev => Math.min(ZOOM_LEVELS.length - 1, prev + 1));
      }
    }
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const removeDependency = (taskId, depId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, dependencies: t.dependencies.filter(d => d !== depId) };
      }
      return t;
    }));
  };

  const getTaskById = (id) => tasks.find(t => t.id === id);

  const updateTask = (taskId, updates) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ));
  };

  const updateSubtask = (taskId, subtaskId, updates) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: t.subtasks.map(st =>
            st.id === subtaskId ? { ...st, ...updates } : st
          )
        };
      }
      return t;
    }));
  };

  const getBarColor = (task) => {
    if (colorByTeam && task.team && teams[task.team]) {
      return teams[task.team].color;
    }
    return task.color;
  };

  // Team/Segment management functions
  const getTeamUsageCount = (teamKey) => {
    let count = 0;
    tasks.forEach(t => {
      if (t.team === teamKey) count++;
      t.subtasks.forEach(st => {
        if (st.team === teamKey) count++;
      });
    });
    return count;
  };

  const getSegmentUsageCount = (segKey) => {
    let count = 0;
    tasks.forEach(t => {
      if (t.segments?.includes(segKey)) count++;
      t.subtasks.forEach(st => {
        if (st.segments?.includes(segKey)) count++;
      });
    });
    return count;
  };

  const addTeam = (key, config) => {
    setTeams(prev => ({ ...prev, [key]: config }));
    // Also add to capacity config
    setCapacityConfig(prev => ({
      ...prev,
      teamCapacities: { ...prev.teamCapacities, [key]: { fe: 1, be: 1 } }
    }));
  };

  const removeTeam = (key) => {
    const usage = getTeamUsageCount(key);
    if (usage > 0) {
      if (!window.confirm(`This team is used by ${usage} task(s)/subtask(s). Remove anyway?\n\nTheir team will be set to unassigned.`)) {
        return false;
      }
      // Clear team from all tasks/subtasks using it
      setTasks(prev => prev.map(t => ({
        ...t,
        team: t.team === key ? null : t.team,
        subtasks: t.subtasks.map(st => ({
          ...st,
          team: st.team === key ? null : st.team
        }))
      })));
    }
    setTeams(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    setCapacityConfig(prev => {
      const { [key]: _, ...restCaps } = prev.teamCapacities;
      return { ...prev, teamCapacities: restCaps };
    });
    return true;
  };

  const addSegment = (key, config) => {
    setSegments(prev => ({ ...prev, [key]: config }));
  };

  const removeSegment = (key) => {
    const usage = getSegmentUsageCount(key);
    if (usage > 0) {
      if (!window.confirm(`This segment is used by ${usage} task(s)/subtask(s). Remove anyway?\n\nIt will be removed from their segments.`)) {
        return false;
      }
      // Remove segment from all tasks/subtasks using it
      setTasks(prev => prev.map(t => ({
        ...t,
        segments: t.segments?.filter(s => s !== key) || [],
        subtasks: t.subtasks.map(st => ({
          ...st,
          segments: st.segments?.filter(s => s !== key) || []
        }))
      })));
    }
    setSegments(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    return true;
  };

  const renderDependencyLines = () => {
    const lines = [];
    const taskRowMap = {};
    let currentY = 0;
    visibleRows.forEach((row) => {
      if (row.type === 'task') {
        taskRowMap[row.data.id] = currentY + ROW_HEIGHT / 2;
        currentY += ROW_HEIGHT;
      } else {
        currentY += SUBTASK_ROW_HEIGHT;
      }
    });

    filteredTasks.forEach((task) => {
      task.dependencies.forEach(depId => {
        const depTask = getTaskById(depId);
        if (!depTask) return;

        const depPos = getTaskPosition(depTask);
        const taskPos = getTaskPosition(task);

        const y1 = taskRowMap[depId];
        const y2 = taskRowMap[task.id];
        if (y1 === undefined || y2 === undefined) return;

        const x1 = (depPos.startDay + depPos.duration) * DAY_WIDTH;
        const x2 = taskPos.startDay * DAY_WIDTH;

        const midX = (x1 + x2) / 2;

        lines.push(
          <g key={`${depId}-${task.id}`}>
            <path
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              strokeDasharray="4,2"
              markerEnd="url(#arrowhead)"
            />
          </g>
        );
      });
    });
    return lines;
  };

  const statusColors = {
    'ToDo': 'bg-gray-100 text-gray-700',
    'To Do': 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Done': 'bg-green-100 text-green-700'
  };

  const cycleStatus = (taskId) => {
    const statuses = ['ToDo', 'In Progress', 'Done'];
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const currentIndex = statuses.indexOf(t.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const exportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      teams: Object.keys(teams),
      segments: Object.keys(segments),
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status: t.status,
        team: t.team,
        segments: t.segments,
        dependencies: t.dependencies,
        subtasks: t.subtasks
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gantt-schedule.json';
    a.click();
  };

  // Copy export data to clipboard
  const copyExportData = () => {
    const exportData = generateExportData();
    const payload = {
      tasks: exportData,
      teams: Object.keys(teams),
      segments: Object.keys(segments),
      exportedAt: new Date().toISOString()
    };

    const text = JSON.stringify(payload, null, 2);
    setSyncOutput({ type: 'full', data: text });
  };

  const today = new Date();
  const todayOffset = showWorkingDaysOnly
    ? dateToWorkingDayOffset(viewStart, today)
    : Math.ceil((today - viewStart) / (1000 * 60 * 60 * 24));

  const chartHeight = visibleRows.reduce((acc, row) =>
    acc + (row.type === 'task' ? ROW_HEIGHT : SUBTASK_ROW_HEIGHT), 0
  );

  const clearFilters = () => {
    setFilterTeam(null);
    setFilterSegment(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Gantt Chart</h1>
                <button
                  onClick={() => setShowLoadModal(true)}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                  title="Import data"
                >
                  📂 Import
                </button>
              </div>
              <p className="text-gray-500 mt-1">Interactive Schedule & Dependency Manager</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setZoomLevel(Math.min(ZOOM_LEVELS.length - 1, zoomLevel + 1))}
                  disabled={zoomLevel === ZOOM_LEVELS.length - 1}
                  className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold"
                  title="Zoom out (see more)"
                >
                  −
                </button>
                <div className="flex gap-0.5">
                  {ZOOM_LEVELS.map((level, i) => (
                    <button
                      key={level.label}
                      onClick={() => setZoomLevel(i)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        zoomLevel === i
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setZoomLevel(Math.max(0, zoomLevel - 1))}
                  disabled={zoomLevel === 0}
                  className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold"
                  title="Zoom in (see detail)"
                >
                  +
                </button>
              </div>

              {/* Timeline Navigation */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => {
                    const newStart = new Date(viewStart);
                    newStart.setMonth(newStart.getMonth() - 1);
                    setViewStart(newStart);
                  }}
                  className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700"
                >
                  ◀
                </button>
                <button
                  onClick={() => setViewStart(new Date(projectBounds.minView))}
                  className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-200 text-gray-700"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    const newStart = new Date(viewStart);
                    newStart.setMonth(newStart.getMonth() + 1);
                    setViewStart(newStart);
                  }}
                  className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700"
                >
                  ▶
                </button>
              </div>

              {/* Expand/Collapse */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button onClick={expandAll} className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-200 text-gray-700">▼ All</button>
                <button onClick={collapseAll} className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-200 text-gray-700">▶ All</button>
              </div>

              <button
                onClick={() => {
                  setTimelineSetMode(!timelineSetMode);
                  setDependencyMode(false);
                  setDependencySource(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timelineSetMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📍 Set Dates
              </button>
              <button
                onClick={() => {
                  setDependencyMode(!dependencyMode);
                  setDependencySource(null);
                  setTimelineSetMode(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dependencyMode ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🔗 Link
              </button>
              <button
                onClick={() => setShowSyncModal(true)}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                📤 Export
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <span className="text-sm text-gray-500 font-medium">Filter:</span>

            {/* Team Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Team</span>
              <select
                value={filterTeam || ''}
                onChange={(e) => setFilterTeam(e.target.value || null)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="">All Teams</option>
                {Object.keys(teams).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Segment Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Segment</span>
              <select
                value={filterSegment || ''}
                onChange={(e) => setFilterSegment(e.target.value || null)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="">All Segments</option>
                {Object.keys(segments).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {(filterTeam || filterSegment) && (
              <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-800">
                Clear filters
              </button>
            )}

            {/* Manage Teams/Segments */}
            <button
              onClick={() => setShowTeamsSegmentsManager(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Manage Teams & Segments"
            >
              ⚙️
            </button>

            <div className="flex-1" />

            {/* Color by Team Toggle */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={colorByTeam}
                onChange={(e) => setColorByTeam(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-600">Color bars by team</span>
            </label>

            {/* Team Legend */}
            <div className="flex items-center gap-2">
              {Object.entries(teams).map(([key, team]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: team.color }} />
                  <span className="text-xs text-gray-500">{team.name}</span>
                </div>
              ))}
            </div>
          </div>

          {timelineSetMode && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm">
                <strong>Timeline Set Mode:</strong> Click and drag on any task or subtask row to set dates.
              </p>
            </div>
          )}

          {dependencyMode && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-purple-700 text-sm">
                <strong>Dependency Mode:</strong> {dependencySource
                  ? `Selected "${getTaskById(dependencySource)?.name}" → Click another task`
                  : 'Click the FIRST task (predecessor), then click the SECOND task'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {/* Task List */}
          <div className="w-[580px] flex-shrink-0 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b font-semibold text-gray-700 flex items-center justify-between" style={{ height: HEADER_HEIGHT }}>
              <span>Tasks</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-normal">FE/BE</span>
                <span className="text-xs text-gray-400 font-normal">{visibleRows.length} items</span>
              </div>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
                  <p className="text-gray-500 mb-6 max-w-sm">
                    Import JSON data to get started, or add tasks manually using the timeline.
                  </p>
                  <button
                    onClick={() => setShowLoadModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    📂 Import Data
                  </button>
                </div>
              ) : visibleRows.map((row) => {
                if (row.type === 'task') {
                  const task = row.data;
                  const hasSubtasks = task.subtasks.length > 0;
                  const isExpanded = expandedTasks.has(task.id);
                  const isDimmed = task._dimmed;

                  return (
                    <div
                      key={task.id}
                      className={`px-3 border-b transition-colors hover:bg-gray-50 ${dependencySource === task.id ? 'bg-purple-50 ring-2 ring-purple-400' : ''} ${isDimmed ? 'opacity-40' : ''}`}
                      style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center' }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {hasSubtasks ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(task.id);
                            }}
                            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded text-xs"
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <div className="w-5" />
                        )}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getBarColor(task) }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{task.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">{task.id}</span>
                            <InlineTeamDropdown
                              value={task.team}
                              onChange={(team) => updateTask(task.id, { team })}
                              teams={teams}
                            />
                            <InlineSegmentEditor
                              value={task.segments || []}
                              onChange={(segs) => updateTask(task.id, { segments: segs })}
                              segments={segments}
                            />
                          </div>
                        </div>
                        {!hasSubtasks && (
                          <CompactEffortInput
                            feValue={task.feEffortDays}
                            beValue={task.beEffortDays}
                            onFEChange={(val) => updateTask(task.id, { feEffortDays: val })}
                            onBEChange={(val) => updateTask(task.id, { beEffortDays: val })}
                          />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleStatus(task.id);
                          }}
                          className={`px-2 py-0.5 text-xs rounded ml-2 ${statusColors[task.status]}`}
                        >
                          {task.status}
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  const subtask = row.data;
                  const parent = row.parent;
                  const isDimmed = row._dimmed;

                  return (
                    <div
                      key={subtask.id}
                      className={`px-3 border-b bg-gray-50/50 hover:bg-gray-100/50 ${isDimmed ? 'opacity-40' : ''}`}
                      style={{ height: SUBTASK_ROW_HEIGHT, display: 'flex', alignItems: 'center' }}
                    >
                      <div className="flex items-center gap-1.5 w-full pl-7">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorByTeam
                              ? (subtask.team && teams[subtask.team]?.color) || (parent.team && teams[parent.team]?.color) || parent.color
                              : parent.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-700 truncate">{subtask.name}</div>
                        </div>
                        <InlineTeamDropdown
                          value={subtask.team}
                          onChange={(team) => updateSubtask(parent.id, subtask.id, { team })}
                          teams={teams}
                        />
                        <InlineSegmentEditor
                          value={subtask.segments || []}
                          onChange={(segs) => updateSubtask(parent.id, subtask.id, { segments: segs })}
                          segments={segments}
                        />
                        <CompactEffortInput
                          feValue={subtask.feEffortDays}
                          beValue={subtask.beEffortDays}
                          onFEChange={(val) => updateSubtask(parent.id, subtask.id, { feEffortDays: val })}
                          onBEChange={(val) => updateSubtask(parent.id, subtask.id, { beEffortDays: val })}
                        />
                        <span className={`px-1.5 py-0.5 text-xs rounded ${statusColors[subtask.status]}`}>
                          {subtask.status}
                        </span>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>

          {/* Gantt Chart */}
          <div ref={chartContainerRef} className="flex-1 bg-white rounded-lg shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <div className="relative" style={{ minWidth: totalDays * DAY_WIDTH }}>
              {/* Month Headers */}
              <div className="flex border-b bg-gray-50 sticky top-0 z-10" style={{ height: HEADER_HEIGHT }}>
                {months.map((month, i) => (
                  <div
                    key={i}
                    className="border-r px-2 py-2 text-center"
                    style={{ width: month.days * DAY_WIDTH }}
                  >
                    <div className="font-semibold text-gray-700">{month.name}</div>
                    <div className="text-xs text-gray-400">{month.days} days</div>
                  </div>
                ))}
              </div>

              {/* Chart Area */}
              <div
                ref={chartRef}
                className="relative"
                style={{ height: chartHeight }}
              >
                {/* Grid Lines */}
                {Array.from({ length: totalDays }).map((_, i) => {
                  const isWeekBoundary = showWorkingDaysOnly ? i % 5 === 0 : i % 7 === 0;
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 border-r ${
                        isWeekBoundary ? 'border-gray-200' : 'border-gray-100'
                      }`}
                      style={{ left: i * DAY_WIDTH }}
                    />
                  );
                })}

                {/* Today Line */}
                {todayOffset >= 0 && todayOffset < totalDays && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: todayOffset * DAY_WIDTH }}
                  >
                    <div className="absolute -top-6 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      Today
                    </div>
                  </div>
                )}

                {/* Row backgrounds and bars */}
                {(() => {
                  let currentY = 0;
                  return visibleRows.map((row, idx) => {
                    const rowHeight = row.type === 'task' ? ROW_HEIGHT : SUBTASK_ROW_HEIGHT;
                    const rowY = currentY;
                    currentY += rowHeight;

                    if (row.type === 'task') {
                      const task = row.data;
                      const pos = getTaskPosition(task);
                      const barWidth = Math.max(pos.duration * DAY_WIDTH, DAY_WIDTH);
                      const isDimmed = task._dimmed;

                      return (
                        <React.Fragment key={task.id}>
                          <div
                            onMouseDown={(e) => handleTimelineMouseDown(e, idx)}
                            className={`absolute left-0 right-0 border-b transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            } ${timelineSetMode ? 'cursor-crosshair hover:bg-green-50/50' : ''}`}
                            style={{ top: rowY, height: rowHeight }}
                          />

                          <div
                            className={`absolute flex items-center group ${isDimmed ? 'opacity-40' : ''}`}
                            style={{
                              left: pos.startDay * DAY_WIDTH,
                              top: rowY + 8,
                              height: rowHeight - 16,
                              width: barWidth,
                              zIndex: dragState?.taskId === task.id || timelineDrawing?.taskId === task.id ? 30 : 20,
                              pointerEvents: timelineSetMode ? 'none' : 'auto'
                            }}
                          >
                            <div
                              onMouseDown={(e) => handleBarMouseDown(e, task, 'start')}
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-l-lg z-10"
                            />
                            <div
                              onMouseDown={(e) => handleBarMouseDown(e, task, 'move')}
                              className={`w-full h-full rounded-lg shadow-sm cursor-move transition-shadow hover:shadow-md flex items-center px-3 ${
                                dependencySource === task.id ? 'ring-2 ring-purple-500' : ''
                              } ${task.status === 'Done' ? 'opacity-60' : ''}`}
                              style={{ backgroundColor: getBarColor(task) }}
                            >
                              <span className="text-white text-sm font-medium truncate">
                                {task.name.replace(/^Phase \d+: /, '').replace('Phase 5 Spike: ', '')}
                              </span>
                            </div>
                            <div
                              onMouseDown={(e) => handleBarMouseDown(e, task, 'end')}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-r-lg z-10"
                            />
                            {task.status === 'Done' && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-white text-lg">✓</span>
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    } else {
                      const subtask = row.data;
                      const parent = row.parent;
                      const pos = getTaskPosition(subtask);
                      const barWidth = Math.max(pos.duration * DAY_WIDTH - 4, 16);
                      const isDimmed = row._dimmed;
                      const subtaskColor = colorByTeam
                        ? (subtask.team && teams[subtask.team]?.color) || (parent.team && teams[parent.team]?.color) || parent.color
                        : parent.color;

                      return (
                        <React.Fragment key={subtask.id}>
                          <div
                            onMouseDown={(e) => handleSubtaskTimelineMouseDown(e, idx, parent.id, subtask.id)}
                            className={`absolute left-0 right-0 border-b bg-gray-50/30 ${isDimmed ? 'opacity-40' : ''} ${timelineSetMode ? 'cursor-crosshair hover:bg-green-50/30' : ''}`}
                            style={{ top: rowY, height: rowHeight }}
                          />
                          <div
                            className="absolute flex items-center group"
                            style={{
                              left: pos.startDay * DAY_WIDTH + 2,
                              top: rowY + 4,
                              height: rowHeight - 8,
                              width: barWidth,
                              zIndex: dragState?.taskId === subtask.id || timelineDrawing?.subtaskId === subtask.id ? 30 : 15,
                              pointerEvents: timelineSetMode ? 'none' : 'auto'
                            }}
                          >
                            <div
                              onMouseDown={(e) => handleSubtaskBarMouseDown(e, parent.id, subtask, 'start')}
                              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/10 rounded-l z-10"
                            />
                            <div
                              onMouseDown={(e) => handleSubtaskBarMouseDown(e, parent.id, subtask, 'move')}
                              className="w-full h-full rounded shadow-sm cursor-move transition-shadow hover:shadow-md flex items-center px-2 opacity-80 hover:opacity-100"
                              style={{ backgroundColor: subtaskColor }}
                            >
                              <span className="text-white text-xs font-medium truncate">
                                {subtask.name.replace(/^\d+\.\d+\s*/, '')}
                              </span>
                            </div>
                            <div
                              onMouseDown={(e) => handleSubtaskBarMouseDown(e, parent.id, subtask, 'end')}
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/10 rounded-r z-10"
                            />
                          </div>
                        </React.Fragment>
                      );
                    }
                  });
                })()}

                {/* Dependency Lines SVG */}
                <svg
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ width: totalDays * DAY_WIDTH, height: chartHeight }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                    </marker>
                  </defs>
                  {renderDependencyLines()}
                </svg>

                {timelineDrawing && (
                  <div
                    className="absolute pointer-events-none border-2 border-dashed border-green-500 bg-green-100/30 rounded"
                    style={{
                      left: Math.min(timelineDrawing.startDay, timelineDrawing.currentDay) * DAY_WIDTH,
                      top: (() => {
                        let y = 0;
                        for (let i = 0; i < timelineDrawing.rowIndex; i++) {
                          y += visibleRows[i].type === 'task' ? ROW_HEIGHT : SUBTASK_ROW_HEIGHT;
                        }
                        const isSubtask = !!timelineDrawing.subtaskId;
                        return y + (isSubtask ? 4 : 8);
                      })(),
                      width: (Math.abs(timelineDrawing.currentDay - timelineDrawing.startDay) + 1) * DAY_WIDTH,
                      height: timelineDrawing.subtaskId ? SUBTASK_ROW_HEIGHT - 8 : ROW_HEIGHT - 16,
                      zIndex: 40
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
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

        {/* Resource Planning Section */}
        <div className="mt-4 bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">📊 Resource Planning</h3>
              <button
                onClick={() => setShowResourceChart(!showResourceChart)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showResourceChart ? '▼ Hide' : '▶ Show'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              {/* Summary Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Total FE:</span>
                  <span className="font-medium text-blue-600">{resourceSummary.totalFeDays} days</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Total BE:</span>
                  <span className="font-medium text-green-600">{resourceSummary.totalBeDays} days</span>
                </div>
                {resourceSummary.overAllocatedWeeks > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                    ⚠️ {resourceSummary.overAllocatedWeeks} weeks over-allocated
                  </span>
                )}
                {resourceSummary.teamsOverAllocated.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Teams:</span>
                    {resourceSummary.teamsOverAllocated.map(team => (
                      <span key={team} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs" style={{ borderLeft: `3px solid ${teams[team]?.color}` }}>
                        {team}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setResourceViewMode('byTeam')}
                  className={`px-3 py-1.5 ${resourceViewMode === 'byTeam' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  By Team
                </button>
                <button
                  onClick={() => setResourceViewMode('aggregate')}
                  className={`px-3 py-1.5 ${resourceViewMode === 'aggregate' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  Aggregate
                </button>
              </div>
              <button
                onClick={() => setShowCapacitySettings(!showCapacitySettings)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                ⚙️ Capacity Settings
              </button>
            </div>
          </div>

          {/* Capacity Settings Panel - Team-based */}
          {showCapacitySettings && (
            <div className="px-4 py-3 bg-gray-50 border-b">
              <div className="flex items-start gap-6">
                <table className="text-sm">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left pr-4 pb-2 font-medium">Team</th>
                      <th className="text-center px-3 pb-2 font-medium">FE Cap</th>
                      <th className="text-center px-3 pb-2 font-medium">BE Cap</th>
                      <th className="text-center px-3 pb-2 font-medium">FE Used</th>
                      <th className="text-center px-3 pb-2 font-medium">BE Used</th>
                      <th className="text-center px-3 pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(teams).map(([teamKey, team]) => {
                      const cap = capacityConfig.teamCapacities[teamKey] || { fe: 1, be: 1 };
                      const stats = resourceSummary.teamTotals[teamKey] || { peakFe: 0, peakBe: 0, overAllocatedWeeks: 0 };
                      const feOver = stats.peakFe > cap.fe;
                      const beOver = stats.peakBe > cap.be;
                      return (
                        <tr key={teamKey} className="border-t border-gray-200">
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: team.color }} />
                              <span className="font-medium">{team.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={cap.fe}
                              onChange={(e) => setCapacityConfig(prev => ({
                                ...prev,
                                teamCapacities: {
                                  ...prev.teamCapacities,
                                  [teamKey]: { ...prev.teamCapacities[teamKey], fe: parseFloat(e.target.value) || 0 }
                                }
                              }))}
                              className="w-16 px-2 py-1 border rounded text-sm text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={cap.be}
                              onChange={(e) => setCapacityConfig(prev => ({
                                ...prev,
                                teamCapacities: {
                                  ...prev.teamCapacities,
                                  [teamKey]: { ...prev.teamCapacities[teamKey], be: parseFloat(e.target.value) || 0 }
                                }
                              }))}
                              className="w-16 px-2 py-1 border rounded text-sm text-center"
                            />
                          </td>
                          <td className={`py-2 px-3 text-center ${feOver ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {stats.peakFe.toFixed(1)}
                          </td>
                          <td className={`py-2 px-3 text-center ${beOver ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {stats.peakBe.toFixed(1)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {stats.overAllocatedWeeks > 0 ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                ⚠️ {stats.overAllocatedWeeks}w
                              </span>
                            ) : (
                              <span className="text-green-600 text-xs">✓ OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-l pl-6 ml-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Calendar Display</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWorkingDaysOnly}
                      onChange={(e) => setShowWorkingDaysOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Show working days only (M-F)</span>
                  </label>
                </div>
                <div className="flex-1" />
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-2">
                    Capacity = # of full-time developers per team per week
                  </p>
                  <p className="text-xs text-gray-400">
                    Total: {Object.values(capacityConfig.teamCapacities).reduce((s,t) => s + t.fe, 0)} FE / {Object.values(capacityConfig.teamCapacities).reduce((s,t) => s + t.be, 0)} BE
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Resource Chart */}
          {showResourceChart && (
            <div className="p-4">
              {resourceViewMode === 'byTeam' ? (
                /* By Team View - Separate chart per team */
                <div className="space-y-4">
                  {Object.entries(teams).map(([teamKey, team]) => {
                    const cap = capacityConfig.teamCapacities[teamKey] || { fe: 1, be: 1 };
                    const teamData = resourceData.map(week => ({
                      week: week.week,
                      weekStart: week.weekStart,
                      fe: week.teamBreakdown?.[teamKey]?.fe || 0,
                      be: week.teamBreakdown?.[teamKey]?.be || 0,
                      feCap: cap.fe,
                      beCap: cap.be,
                      feOver: week.teamBreakdown?.[teamKey]?.feOver,
                      beOver: week.teamBreakdown?.[teamKey]?.beOver
                    }));
                    const hasData = teamData.some(d => d.fe > 0 || d.be > 0);
                    if (!hasData) return null;
                    const stats = resourceSummary.teamTotals[teamKey];
                    return (
                      <div key={teamKey} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: team.color }} />
                            <span className="font-medium text-gray-800">{team.name}</span>
                            <span className="text-xs text-gray-500">
                              (Cap: {cap.fe} FE / {cap.be} BE)
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-gray-500">
                              Total: <span className="font-medium text-blue-600">{stats?.feDays || 0} FE days</span> / <span className="font-medium text-green-600">{stats?.beDays || 0} BE days</span>
                            </span>
                            {stats?.overAllocatedWeeks > 0 && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                ⚠️ {stats.overAllocatedWeeks} weeks over
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teamData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="week" tick={{ fontSize: 9 }} interval={1} angle={-45} textAnchor="end" height={40} />
                              <YAxis tick={{ fontSize: 10 }} domain={[0, Math.max(cap.fe, cap.be) * 1.5]} />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload;
                                  return (
                                    <div className="bg-white border rounded shadow-lg p-2 text-xs">
                                      <p className="font-medium">{team.name} - Week of {label}</p>
                                      <div className={d?.feOver ? 'text-red-600' : ''}>FE: {d?.fe?.toFixed(2)} / {d?.feCap} {d?.feOver && '⚠️'}</div>
                                      <div className={d?.beOver ? 'text-red-600' : ''}>BE: {d?.be?.toFixed(2)} / {d?.beCap} {d?.beOver && '⚠️'}</div>
                                    </div>
                                  );
                                }}
                              />
                              <ReferenceLine y={cap.fe} stroke={team.color} strokeDasharray="5 5" strokeOpacity={0.7} />
                              <ReferenceLine y={cap.be} stroke={team.color} strokeDasharray="2 2" strokeOpacity={0.5} />
                              <Bar dataKey="fe" name="FE" fill={team.color} radius={[2, 2, 0, 0]} />
                              <Bar dataKey="be" name="BE" fill={team.color} fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Aggregate View - Original combined chart */
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resourceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'FTE', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0]?.payload;
                          return (
                            <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-medium mb-2">Week of {label}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-blue-600">FE:</span>
                                  <span className={data?.feOver ? 'text-red-600 font-medium' : ''}>{data?.fe?.toFixed(2)} / {data?.feCap} {data?.feOver && '⚠️'}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-green-600">BE:</span>
                                  <span className={data?.beOver ? 'text-red-600 font-medium' : ''}>{data?.be?.toFixed(2)} / {data?.beCap} {data?.beOver && '⚠️'}</span>
                                </div>
                                {data?.teamBreakdown && (
                                  <div className="border-t pt-1 mt-1 text-xs text-gray-500">
                                    {Object.entries(data.teamBreakdown).filter(([_, v]) => v.fe > 0 || v.be > 0).map(([t, v]) => (
                                      <div key={t} className="flex justify-between">
                                        <span>{t}:</span>
                                        <span>{v.fe.toFixed(1)} FE / {v.be.toFixed(1)} BE</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <ReferenceLine y={Object.values(capacityConfig.teamCapacities).reduce((s,t) => s + t.fe, 0)} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: `FE Cap`, position: 'right', fontSize: 10, fill: '#3b82f6' }} />
                      <ReferenceLine y={Object.values(capacityConfig.teamCapacities).reduce((s,t) => s + t.be, 0)} stroke="#10b981" strokeDasharray="5 5" label={{ value: `BE Cap`, position: 'right', fontSize: 10, fill: '#10b981' }} />
                      <Bar dataKey="fe" name="FE Demand" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="be" name="BE Demand" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Over-allocation warnings - by team */}
              {resourceSummary.teamsOverAllocated.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">⚠️ Team Over-allocation Summary</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {resourceSummary.teamsOverAllocated.map(teamKey => {
                      const stats = resourceSummary.teamTotals[teamKey];
                      const cap = capacityConfig.teamCapacities[teamKey];
                      return (
                        <div key={teamKey} className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-red-200">
                          <div className="w-2 h-2 rounded" style={{ backgroundColor: teams[teamKey]?.color }} />
                          <span className="font-medium text-gray-700">{teamKey}</span>
                          <span className="text-red-600 text-xs">
                            Peak: {stats.peakFe.toFixed(1)}/{cap.fe} FE, {stats.peakBe.toFixed(1)}/{cap.be} BE
                          </span>
                          <span className="text-gray-500 text-xs">({stats.overAllocatedWeeks} weeks)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Load from JIRA Modal */}
        {showLoadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">📂 Load Epic from JIRA</h2>
                <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
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
                      value={jiraImportData}
                      onChange={(e) => setJiraImportData(e.target.value)}
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
                  onClick={() => setShowLoadModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => importFromJira(jiraImportData)}
                  disabled={!jiraImportData.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📥 Import Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams & Segments Manager Modal */}
        {showTeamsSegmentsManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">⚙️ Manage Teams & Segments</h2>
                <button onClick={() => setShowTeamsSegmentsManager(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
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
                              onClick={() => removeTeam(key)}
                              className="text-red-500 hover:text-red-700 text-sm px-2"
                              title="Remove team"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => {
                        const name = window.prompt('Enter team name:');
                        if (name && name.trim()) {
                          const key = name.trim();
                          if (teams[key]) {
                            alert('A team with this name already exists.');
                            return;
                          }
                          const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ef4444', '#06b6d4', '#ec4899'];
                          const color = colors[Object.keys(teams).length % colors.length];
                          addTeam(key, { name: key, color, bg: 'bg-gray-100', text: 'text-gray-700' });
                        }
                      }}
                      className="mt-3 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
                    >
                      + Add Team
                    </button>
                  </div>

                  {/* Segments Column */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Segments</h3>
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
                              onClick={() => removeSegment(key)}
                              className="text-red-500 hover:text-red-700 text-sm px-2"
                              title="Remove segment"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => {
                        const name = window.prompt('Enter segment name:');
                        if (name && name.trim()) {
                          const key = name.trim();
                          if (segments[key]) {
                            alert('A segment with this name already exists.');
                            return;
                          }
                          const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                          const color = colors[Object.keys(segments).length % colors.length];
                          addSegment(key, { name: key, color, bg: 'bg-gray-100', text: 'text-gray-700' });
                        }
                      }}
                      className="mt-3 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
                    >
                      + Add Segment
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowTeamsSegmentsManager(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showSyncModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">📤 Export Data</h2>
                <button onClick={() => setShowSyncModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              <div className="p-6 overflow-auto max-h-[60vh]">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Export your Gantt chart data as JSON. You can later import this data to restore your schedule.
                  </p>
                  <button
                    onClick={copyExportData}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    📄 Generate Export Data
                  </button>
                </div>
                {syncOutput && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Export Data — Select all and copy:
                    </label>
                    <textarea
                      readOnly
                      value={syncOutput.data}
                      className="w-full h-64 p-2 text-xs font-mono bg-gray-50 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
