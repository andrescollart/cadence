// Utility: Calculate working days between two dates (excludes weekends)
export function getWorkingDays(startDate, endDate) {
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
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// Utility: Check if a date range overlaps with a week
export function rangeOverlapsWeek(startDate, endDate, weekStart) {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  return rangeStart <= weekEndDate && rangeEnd >= weekStartDate;
}

// Utility: Check if a date is a working day (M-F)
export function isWorkingDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

// Utility: Get total working days between viewStart and viewEnd
export function getTotalWorkingDays(viewStart, viewEnd) {
  let count = 0;
  const current = new Date(viewStart);
  while (current < viewEnd) {
    if (isWorkingDay(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Utility: Convert working day offset to actual date
export function workingDayOffsetToDate(viewStart, offset) {
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
export function dateToWorkingDayOffset(viewStart, targetDate) {
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
