import { useMemo } from 'react';
import { getWorkingDays, getWeekStart, rangeOverlapsWeek } from '../utils/dateUtils';

export default function useResourceCalculations({
  tasks,
  teams,
  viewStart,
  viewEnd,
  capacityConfig,
  filterTeam,
}) {
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
    return weeks.map(weekStartDate => {
      // Initialize per-team tracking
      const teamData = {};
      Object.keys(teams).forEach(team => {
        teamData[team] = { fe: 0, be: 0 };
      });
      teamData['Unassigned'] = { fe: 0, be: 0 };

      workItems.forEach(item => {
        if (rangeOverlapsWeek(item.startDate, item.endDate, weekStartDate)) {
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

      const weekDate = new Date(weekStartDate);
      const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Calculate total capacity
      const totalFeCap = Object.values(capacityConfig.teamCapacities).reduce((sum, t) => sum + t.fe, 0);
      const totalBeCap = Object.values(capacityConfig.teamCapacities).reduce((sum, t) => sum + t.be, 0);

      return {
        week: weekLabel,
        weekStart: weekStartDate,
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
  }, [tasks, viewStart, viewEnd, capacityConfig, filterTeam, teams]);

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
  }, [tasks, resourceData, filterTeam, teams]);

  return { resourceData, resourceSummary };
}
