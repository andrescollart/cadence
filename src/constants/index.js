// Phase colors for auto-assignment
export const PHASE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // cyan
];

export const DEFAULT_TEAMS = {
  Engineering: { name: 'Engineering', color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  Design: { name: 'Design', color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700' },
  Product: { name: 'Product', color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export const DEFAULT_SEGMENTS = {
  'Core': { name: 'Core', color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  'Platform': { name: 'Platform', color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700' },
};

// Layout constants
export const ROW_HEIGHT = 48;
export const SUBTASK_ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 60;

export const ZOOM_LEVELS = [
  { label: '1W', dayWidth: 56, monthsToShow: 4 },
  { label: '2W', dayWidth: 42, monthsToShow: 5 },
  { label: '1M', dayWidth: 28, monthsToShow: 7 },
  { label: '2M', dayWidth: 14, monthsToShow: 9 },
  { label: 'Q', dayWidth: 8, monthsToShow: 12 },
];

// Status colors for task badges
export const STATUS_COLORS = {
  'ToDo': 'bg-gray-100 text-gray-700',
  'To Do': 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Done': 'bg-green-100 text-green-700'
};
