import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

// Utils
import {
  getWorkingDays,
  getTotalWorkingDays,
  workingDayOffsetToDate,
  dateToWorkingDayOffset,
} from './utils/dateUtils';
import { parseGanttConfig } from './utils/ganttConfig';

// Constants
import {
  PHASE_COLORS,
  DEFAULT_TEAMS,
  DEFAULT_SEGMENTS,
  ROW_HEIGHT,
  SUBTASK_ROW_HEIGHT,
  HEADER_HEIGHT,
  ZOOM_LEVELS,
  STATUS_COLORS,
} from './constants';

// Components
import ExportModal from './components/modals/ExportModal';
import TeamsSegmentsModal from './components/modals/TeamsSegmentsModal';
import { TeamBadge, SegmentTags } from './components/badges';
import {
  SegmentSelect,
  SubtaskSegmentSelect,
  InlineTeamDropdown,
  InlineSegmentEditor,
  CompactEffortInput,
} from './components/inputs';
import { ResourcePlanningSection } from './components/resources';
import Legend from './components/Legend';
import { useResourceCalculations } from './hooks';
import AuthButton from './components/auth/AuthButton';
import JiraImportModal from './components/modals/JiraImportModal';
import PushToJiraModal from './components/modals/PushToJiraModal';
import SetupWizard from './components/SetupWizard';
import { useAuth } from './context/AuthContext.jsx';

const initialTasks = [];

export default function GanttChart() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState(initialTasks);
  const [dependencyMode, setDependencyMode] = useState(false);
  const [dependencySource, setDependencySource] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [taskListWidth, setTaskListWidth] = useState(() => {
    const saved = localStorage.getItem('gantt_task_list_width');
    return saved ? parseInt(saved, 10) : 580;
  });
  const isResizing = useRef(false);

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
  const [showJiraImportModal, setShowJiraImportModal] = useState(false);
  const [showPushToJiraModal, setShowPushToJiraModal] = useState(false);

  // JIRA import source tracking - for push-back functionality
  const JIRA_IMPORT_STATE_KEY = 'jira_import_state';
  const CAPACITY_CONFIG_KEY_PREFIX = 'gantt_capacity_';

  // Helper to get/save capacity config per project
  const getCapacityKey = (cloudId, projectKey) => `${CAPACITY_CONFIG_KEY_PREFIX}${cloudId}:${projectKey}`;
  const getSavedCapacity = (cloudId, projectKey) => {
    try {
      const saved = localStorage.getItem(getCapacityKey(cloudId, projectKey));
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };
  const saveCapacity = (cloudId, projectKey, config) => {
    try {
      localStorage.setItem(getCapacityKey(cloudId, projectKey), JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save capacity config:', e);
    }
  };

  const [jiraImportSource, setJiraImportSource] = useState(() => {
    try {
      const saved = localStorage.getItem(JIRA_IMPORT_STATE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Persist capacity config to localStorage when it changes (keyed by project)
  useEffect(() => {
    if (jiraImportSource?.cloudId && jiraImportSource?.projectKey) {
      saveCapacity(jiraImportSource.cloudId, jiraImportSource.projectKey, capacityConfig);
    }
  }, [capacityConfig, jiraImportSource?.cloudId, jiraImportSource?.projectKey]);

  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const chartHeaderRef = useRef(null);

  // Sync chart header horizontal scroll with chart content
  const handleChartScroll = useCallback(() => {
    if (chartHeaderRef.current && chartContainerRef.current) {
      chartHeaderRef.current.scrollLeft = chartContainerRef.current.scrollLeft;
    }
  }, []);

  // Resizable task list panel
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(300, Math.min(800, e.clientX - 24)); // 24px for page padding
      setTaskListWidth(newWidth);
    };

    const handleResizeEnd = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('gantt_task_list_width', taskListWidth.toString());
      }
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [taskListWidth]);

  // Color palette for dynamically created teams/segments
  const TEAM_COLORS = [
    { color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
    { color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700' },
    { color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { color: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700' },
    { color: '#ef4444', bg: 'bg-red-100', text: 'text-red-700' },
    { color: '#06b6d4', bg: 'bg-cyan-100', text: 'text-cyan-700' },
    { color: '#ec4899', bg: 'bg-pink-100', text: 'text-pink-700' },
    { color: '#84cc16', bg: 'bg-lime-100', text: 'text-lime-700' },
  ];

  // Import tasks from JIRA JSON data
  // jiraData can include: { tasks, cloudId?, projectKey?, fieldMapping? }
  const importFromJira = useCallback((jiraData) => {
    try {
      const data = typeof jiraData === 'string' ? JSON.parse(jiraData) : jiraData;

      // Track original state for push-back change detection
      const originalState = {};

      // Collect all unique teams and segments from the data
      const foundTeams = new Set();
      const foundSegments = new Set();

      // Helper to capture original state for an item
      const captureOriginalState = (id, startDate, endDate, team, segments, feEffortDays, beEffortDays) => {
        originalState[id] = {
          startDate: startDate || null,
          endDate: endDate || null,
          team: team || null,
          segments: segments || [],
          feEffortDays: feEffortDays || 0,
          beEffortDays: beEffortDays || 0,
        };
      };

      // Convert JIRA issues to Gantt tasks
      const newTasks = data.tasks.map((issue, index) => {
        // Parse GANTT_CONFIG from description
        const config = parseGanttConfig(issue.description);

        // Collect team/segments from task
        const taskTeam = config?.team || issue.team || null;
        const taskSegments = config?.segments || issue.segments || [];
        const taskFeEffort = config?.feEffortDays ?? issue.feEffortDays ?? 0;
        const taskBeEffort = config?.beEffortDays ?? issue.beEffortDays ?? 0;

        // Capture original state for this task
        captureOriginalState(issue.id, issue.startDate, issue.endDate, taskTeam, taskSegments, taskFeEffort, taskBeEffort);

        if (taskTeam) foundTeams.add(taskTeam);
        taskSegments.forEach(s => foundSegments.add(s));

        // Recursive function to build subtasks (supports nested subtasks)
        const buildSubtasks = (items, parentStartDate, parentEndDate) => {
          return (items || []).map(st => {
            const stConfig = parseGanttConfig(st.description);

            // Collect team/segments from subtask
            const stTeam = stConfig?.team || st.team || null;
            const stSegments = stConfig?.segments || st.segments || [];
            const stFeEffort = stConfig?.feEffortDays ?? st.feEffortDays ?? 0;
            const stBeEffort = stConfig?.beEffortDays ?? st.beEffortDays ?? 0;

            const subtaskStartDate = st.startDate || parentStartDate;
            const subtaskEndDate = st.endDate || parentEndDate;

            // Capture original state for this subtask
            captureOriginalState(st.id, subtaskStartDate, subtaskEndDate, stTeam, stSegments, stFeEffort, stBeEffort);

            if (stTeam) foundTeams.add(stTeam);
            stSegments.forEach(s => foundSegments.add(s));

            return {
              id: st.id,
              name: st.name,
              status: st.status || 'To Do',
              team: stTeam,
              segments: stSegments,
              startDate: subtaskStartDate,
              endDate: subtaskEndDate,
              feEffortDays: stFeEffort,
              beEffortDays: stBeEffort,
              subtasks: buildSubtasks(st.subtasks, subtaskStartDate, subtaskEndDate),
            };
          });
        };

        // Build subtasks (now supports nesting)
        const subtasks = buildSubtasks(issue.subtasks, issue.startDate, issue.endDate);

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
          team: taskTeam,
          segments: taskSegments,
          feEffortDays: taskFeEffort,
          beEffortDays: taskBeEffort,
          subtasks,
        };
      });

      // Update teams state with discovered teams (replace defaults with imported ones)
      if (foundTeams.size > 0) {
        const newTeams = {};
        let colorIndex = 0;
        foundTeams.forEach(teamName => {
          const colorSet = TEAM_COLORS[colorIndex % TEAM_COLORS.length];
          newTeams[teamName] = {
            name: teamName,
            ...colorSet
          };
          colorIndex++;
        });
        setTeams(newTeams);

        // Restore saved capacity for this project, or use defaults for new teams
        const savedCapacity = data.cloudId && data.projectKey
          ? getSavedCapacity(data.cloudId, data.projectKey)
          : null;
        const savedTeamCapacities = savedCapacity?.teamCapacities || {};

        const newCapacities = {};
        foundTeams.forEach(teamName => {
          // Use saved capacity if available, otherwise default to { fe: 1, be: 1 }
          newCapacities[teamName] = savedTeamCapacities[teamName] || { fe: 1, be: 1 };
        });
        setCapacityConfig(prev => ({
          ...prev,
          teamCapacities: newCapacities
        }));
      }

      // Update segments state with discovered segments (replace defaults with imported ones)
      if (foundSegments.size > 0) {
        const newSegments = {};
        let colorIndex = 0;
        foundSegments.forEach(segName => {
          const colorSet = TEAM_COLORS[colorIndex % TEAM_COLORS.length];
          newSegments[segName] = {
            name: segName,
            ...colorSet
          };
          colorIndex++;
        });
        setSegments(newSegments);
      }

      setTasks(newTasks);

      // Expand top-level tasks by default (but not grandchildren)
      setExpandedTasks(new Set(newTasks.map(t => t.id)));

      // Store JIRA import source for push-back functionality
      if (data.cloudId && data.projectKey) {
        setJiraImportSource({
          cloudId: data.cloudId,
          projectKey: data.projectKey,
          importedAt: new Date().toISOString(),
          fieldMapping: data.fieldMapping || {},
          originalState,
        });
      }

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
    const idsToExpand = [];

    const collectExpandableIds = (items) => {
      items.forEach(item => {
        if (item.subtasks?.length > 0) {
          idsToExpand.push(item.id);
          collectExpandableIds(item.subtasks);
        }
      });
    };

    collectExpandableIds(tasks);
    setExpandedTasks(new Set(idsToExpand));
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

  // Build flat list of visible rows (supports nested subtasks)
  const visibleRows = useMemo(() => {
    const rows = [];

    // Recursive function to add subtasks at any depth
    const addSubtasks = (subtasks, parent, depth = 1) => {
      subtasks.forEach(subtask => {
        const subtaskMatches = (!filterTeam || subtask.team === filterTeam) &&
                               (!filterSegment || subtask.segments?.includes(filterSegment));
        rows.push({ type: 'subtask', data: subtask, parent, depth, _dimmed: !subtaskMatches });

        // Recursively add nested subtasks if expanded
        if (expandedTasks.has(subtask.id) && subtask.subtasks?.length > 0) {
          addSubtasks(subtask.subtasks, subtask, depth + 1);
        }
      });
    };

    filteredTasks.forEach(task => {
      rows.push({ type: 'task', data: task });
      if (expandedTasks.has(task.id)) {
        addSubtasks(task.subtasks, task, 1);
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

  // Resource calculations hook
  const { resourceData, resourceSummary } = useResourceCalculations({
    tasks,
    teams,
    viewStart,
    viewEnd,
    capacityConfig,
    filterTeam,
  });


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

      // Handle subtask timeline drawing (supports nested subtasks)
      if (timelineDrawing.subtaskId) {
        const startDay = Math.min(timelineDrawing.startDay, currentDay);
        const endDay = Math.max(timelineDrawing.startDay, currentDay);

        // Use deep update for nested subtasks
        const updateInSubtasks = (subtasks) => {
          return subtasks.map(st => {
            if (st.id === timelineDrawing.subtaskId) {
              return { ...st, startDate: dayToDate(startDay), endDate: dayToDate(endDay) };
            }
            if (st.subtasks?.length > 0) {
              return { ...st, subtasks: updateInSubtasks(st.subtasks) };
            }
            return st;
          });
        };

        setTasks(prev => prev.map(task => ({
          ...task,
          subtasks: updateInSubtasks(task.subtasks)
        })));
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

    // Handle subtask dragging (supports nested subtasks)
    if (dragState.isSubtask) {
      const originalStart = new Date(dragState.originalStart);
      const originalEnd = new Date(dragState.originalEnd);

      let updates = {};
      if (dragState.type === 'move') {
        const newStart = new Date(originalStart);
        newStart.setDate(newStart.getDate() + dayDiff);
        const newEnd = new Date(originalEnd);
        newEnd.setDate(newEnd.getDate() + dayDiff);
        updates = {
          startDate: newStart.toISOString().split('T')[0],
          endDate: newEnd.toISOString().split('T')[0]
        };
      } else if (dragState.type === 'start') {
        const newStart = new Date(originalStart);
        newStart.setDate(newStart.getDate() + dayDiff);
        if (newStart < originalEnd) {
          updates = { startDate: newStart.toISOString().split('T')[0] };
        }
      } else if (dragState.type === 'end') {
        const newEnd = new Date(originalEnd);
        newEnd.setDate(newEnd.getDate() + dayDiff);
        if (newEnd > originalStart) {
          updates = { endDate: newEnd.toISOString().split('T')[0] };
        }
      }

      if (Object.keys(updates).length > 0) {
        // Use deep update for nested subtasks
        const updateInSubtasks = (subtasks) => {
          return subtasks.map(st => {
            if (st.id === dragState.taskId) {
              return { ...st, ...updates };
            }
            if (st.subtasks?.length > 0) {
              return { ...st, subtasks: updateInSubtasks(st.subtasks) };
            }
            return st;
          });
        };

        setTasks(prev => prev.map(task => ({
          ...task,
          subtasks: updateInSubtasks(task.subtasks)
        })));
      }
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


  // Persist JIRA import source to localStorage
  useEffect(() => {
    if (jiraImportSource) {
      localStorage.setItem(JIRA_IMPORT_STATE_KEY, JSON.stringify(jiraImportSource));
    }
  }, [jiraImportSource]);

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

  // Deep update for nested subtasks - finds subtask at any depth
  const updateSubtaskDeep = (subtaskId, updates) => {
    const updateInSubtasks = (subtasks) => {
      return subtasks.map(st => {
        if (st.id === subtaskId) {
          return { ...st, ...updates };
        }
        if (st.subtasks?.length > 0) {
          return { ...st, subtasks: updateInSubtasks(st.subtasks) };
        }
        return st;
      });
    };

    setTasks(prev => prev.map(t => ({
      ...t,
      subtasks: updateInSubtasks(t.subtasks)
    })));
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

  // Show setup wizard if not authenticated or no tasks imported
  if (!authLoading && (!isAuthenticated || tasks.length === 0)) {
    return <SetupWizard onComplete={importFromJira} />;
  }

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
                  onClick={() => setShowJiraImportModal(true)}
                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                  title="Import from JIRA"
                >
                  🔗 JIRA Import
                </button>
                {jiraImportSource && (
                  <button
                    onClick={() => setShowPushToJiraModal(true)}
                    className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded text-green-700"
                    title="Push changes back to JIRA"
                  >
                    ↑ Push to JIRA
                  </button>
                )}
              </div>
              <AuthButton />
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
                <option value="">All Customer Segments</option>
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

            {/* Manage Teams/Customer Segments */}
            <button
              onClick={() => setShowTeamsSegmentsManager(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Manage Teams & Customer Segments"
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

        {/* Single scroll container for synchronized vertical scrolling */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {/* Sticky header row */}
          <div className="flex sticky top-0 z-40">
            {/* Task List Header */}
            <div className="flex-shrink-0 bg-white rounded-tl-lg shadow-sm" style={{ width: taskListWidth }}>
              <div className="bg-gray-50 px-4 py-3 border-b font-semibold text-gray-700 flex items-center justify-between rounded-t-lg" style={{ height: HEADER_HEIGHT }}>
                <span>Tasks</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-normal flex items-center gap-1">
                    FE/BE
                    <span className="relative group cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path strokeWidth="2" d="M12 16v-4M12 8h.01"/>
                      </svg>
                      <span className="fixed mt-6 ml-[-240px] w-64 px-3 py-2 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ zIndex: 9999 }}>
                        <strong className="block mb-1">Effort is additive across hierarchy</strong>
                        <span className="text-gray-300 block">
                          All effort values sum up: parent + subtasks + nested subtasks. Set effort at any level and it contributes to total capacity.
                        </span>
                        <span className="text-gray-400 block mt-1.5 text-[10px]">
                          Example: Phase (5/3) + Task (10/2) + Subtask (3/1) = 18/6 total
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 font-normal">{visibleRows.length} items</span>
                </div>
              </div>
            </div>
            {/* Resize Handle */}
            <div
              onMouseDown={handleResizeStart}
              className="w-2 flex-shrink-0 cursor-col-resize hover:bg-blue-400 bg-gray-200 transition-colors"
              title="Drag to resize"
            />
            {/* Chart Header */}
            <div ref={chartHeaderRef} className="flex-1 bg-white rounded-tr-lg shadow-sm overflow-hidden">
              <div className="flex border-b bg-gray-50" style={{ minWidth: totalDays * DAY_WIDTH, height: HEADER_HEIGHT }}>
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
            </div>
          </div>

          {/* Content row */}
          <div className="flex">
            {/* Task List Content */}
            <div className="flex-shrink-0 bg-white rounded-bl-lg shadow-sm" style={{ width: taskListWidth }}>
              <div>
              {visibleRows.map((row) => {
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
                        <CompactEffortInput
                          feValue={task.feEffortDays}
                          beValue={task.beEffortDays}
                          onFEChange={(val) => updateTask(task.id, { feEffortDays: val })}
                          onBEChange={(val) => updateTask(task.id, { beEffortDays: val })}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleStatus(task.id);
                          }}
                          className={`px-2 py-0.5 text-xs rounded ml-2 ${STATUS_COLORS[task.status]}`}
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
                  const depth = row.depth || 1;
                  const hasNestedSubtasks = subtask.subtasks?.length > 0;
                  const isExpanded = expandedTasks.has(subtask.id);
                  const indentPx = 28 + (depth - 1) * 20; // Base indent + depth-based indent

                  return (
                    <div
                      key={subtask.id}
                      className={`px-3 border-b bg-gray-50/50 hover:bg-gray-100/50 ${isDimmed ? 'opacity-40' : ''}`}
                      style={{ height: SUBTASK_ROW_HEIGHT, display: 'flex', alignItems: 'center' }}
                    >
                      <div className="flex items-center gap-1.5 w-full" style={{ paddingLeft: indentPx }}>
                        {hasNestedSubtasks ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(subtask.id);
                            }}
                            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded text-xs flex-shrink-0"
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <div className="w-4 flex-shrink-0" />
                        )}
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
                          onChange={(team) => updateSubtaskDeep(subtask.id, { team })}
                          teams={teams}
                        />
                        <InlineSegmentEditor
                          value={subtask.segments || []}
                          onChange={(segs) => updateSubtaskDeep(subtask.id, { segments: segs })}
                          segments={segments}
                        />
                        <CompactEffortInput
                          feValue={subtask.feEffortDays}
                          beValue={subtask.beEffortDays}
                          onFEChange={(val) => updateSubtaskDeep(subtask.id, { feEffortDays: val })}
                          onBEChange={(val) => updateSubtaskDeep(subtask.id, { beEffortDays: val })}
                        />
                        <span className={`px-1.5 py-0.5 text-xs rounded ${STATUS_COLORS[subtask.status]}`}>
                          {subtask.status}
                        </span>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
            {/* Resize Handle */}
            <div
              onMouseDown={handleResizeStart}
              className="w-2 flex-shrink-0 cursor-col-resize hover:bg-blue-400 bg-gray-200 transition-colors"
            />
            {/* Gantt Chart Content */}
            <div ref={chartContainerRef} className="flex-1 bg-white rounded-br-lg shadow-sm overflow-x-auto" onScroll={handleChartScroll}>
            <div className="relative" style={{ minWidth: totalDays * DAY_WIDTH }}>
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
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-50"
                    style={{ left: todayOffset * DAY_WIDTH }}
                  >
                    <div className="absolute top-1 -left-8 bg-red-500/80 text-white text-xs px-2 py-1 rounded">
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
        </div>

        {/* Legend */}
        <Legend teams={teams} segments={segments} />

        {/* Resource Planning Section */}
        <ResourcePlanningSection
          showResourceChart={showResourceChart}
          setShowResourceChart={setShowResourceChart}
          resourceSummary={resourceSummary}
          teams={teams}
          resourceViewMode={resourceViewMode}
          setResourceViewMode={setResourceViewMode}
          showCapacitySettings={showCapacitySettings}
          setShowCapacitySettings={setShowCapacitySettings}
          capacityConfig={capacityConfig}
          setCapacityConfig={setCapacityConfig}
          showWorkingDaysOnly={showWorkingDaysOnly}
          setShowWorkingDaysOnly={setShowWorkingDaysOnly}
          resourceData={resourceData}
        />

        {/* JIRA Direct Import Modal */}
        <JiraImportModal
          isOpen={showJiraImportModal}
          onClose={() => setShowJiraImportModal(false)}
          onImport={importFromJira}
        />

        {/* Push to JIRA Modal */}
        <PushToJiraModal
          isOpen={showPushToJiraModal}
          onClose={() => setShowPushToJiraModal(false)}
          tasks={tasks}
          jiraImportSource={jiraImportSource}
          onUpdateOriginalState={(newOriginalState) => {
            setJiraImportSource(prev => prev ? {
              ...prev,
              originalState: newOriginalState,
            } : null);
          }}
        />

        {/* Teams & Segments Manager Modal */}
        {showTeamsSegmentsManager && (
          <TeamsSegmentsModal
            onClose={() => setShowTeamsSegmentsManager(false)}
            teams={teams}
            segments={segments}
            onAddTeam={addTeam}
            onRemoveTeam={removeTeam}
            onAddSegment={addSegment}
            onRemoveSegment={removeSegment}
            getTeamUsageCount={getTeamUsageCount}
            getSegmentUsageCount={getSegmentUsageCount}
          />
        )}

        {/* Export Modal */}
        {showSyncModal && (
          <ExportModal
            onClose={() => setShowSyncModal(false)}
            onGenerateExport={() => ({
              tasks: generateExportData(),
              teams: Object.keys(teams),
              segments: Object.keys(segments),
              exportedAt: new Date().toISOString()
            })}
          />
        )}
      </div>
    </div>
  );
}
