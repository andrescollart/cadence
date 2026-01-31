# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive Gantt chart application for project timeline management and resource allocation planning. Built with React 19 and Vite, it integrates with JIRA for importing epics and syncing schedule changes.

## Development Commands

```bash
npm run dev      # Start development server (Vite HMR, port 5173)
npm run build    # Production build
npm run lint     # ESLint check
npm run preview  # Preview production build locally
```

## Architecture

### Single-File Application
The entire application lives in `src/App.jsx` (~2,600 lines). This includes:
- Gantt chart visualization with zoom levels (1W, 2W, 1M, 2M, Quarter)
- Task/phase management with dependencies and subtasks
- Resource allocation tracking (FE/BE effort in person-days)
- JIRA integration via JSON import/export modals

### Key Data Structures

**Task Object:**
```javascript
{
  id: string,              // Task identifier (e.g., "TASK-001")
  name: string,
  phase: number,
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  dependencies: string[],
  team: string,            // Team key from TEAMS object
  segments: string[],      // Segment keys from SEGMENTS object
  subtasks: Task[],
  feEffortDays?: number,
  beEffortDays?: number
}
```

### Color Systems
Three separate color objects at top of App.jsx:
- `PHASE_COLORS`: 7 distinct phase colors
- `TEAMS`: Team definitions with Tailwind classes
- `SEGMENTS`: Segment definitions with colors

### JIRA Integration
- `parseGanttConfig(description)`: Extracts GANTT_CONFIG from JIRA descriptions
- `appendGanttConfig(description, config)`: Embeds config in backtick notation
- Import/export handled via modal JSON copy-paste

### Utility Functions
- `getWorkingDays(startDate, endDate)`: Business days excluding weekends
- `getWeekStart(date)`: Returns Monday of the week
- `rangeOverlapsWeek(startDate, endDate, weekStart)`: Date range overlap detection

## Tech Stack

- React 19.2 with functional components and hooks
- Vite 7.2 (ES modules, fast refresh)
- Recharts 3.7 for resource capacity charts
- Tailwind CSS 4.1 for styling
- ESLint 9 with flat config format

## Code Style

- ESLint flat config in `eslint.config.js` (not `.eslintrc`)
- Tailwind utility classes for styling
- Dynamic inline styles for colors from palette objects
- useState for all state management (no external state library)
- useMemo for computed values (resourceSummary, resourceData)
