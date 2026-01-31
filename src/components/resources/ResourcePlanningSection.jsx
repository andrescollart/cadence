import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function ResourcePlanningSection({
  showResourceChart,
  setShowResourceChart,
  resourceSummary,
  teams,
  resourceViewMode,
  setResourceViewMode,
  showCapacitySettings,
  setShowCapacitySettings,
  capacityConfig,
  setCapacityConfig,
  showWorkingDaysOnly,
  setShowWorkingDaysOnly,
  resourceData,
}) {
  return (
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
            (() => {
              const totalFeCap = Object.values(capacityConfig.teamCapacities).reduce((s, t) => s + t.fe, 0);
              const totalBeCap = Object.values(capacityConfig.teamCapacities).reduce((s, t) => s + t.be, 0);
              const maxDemand = Math.max(...resourceData.map(d => Math.max(d.fe, d.be)), 0);
              const yMax = Math.ceil(Math.max(totalFeCap, totalBeCap, maxDemand) * 1.2);
              return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resourceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, yMax]} allowDecimals={false} label={{ value: 'FTE', angle: -90, position: 'insideLeft', fontSize: 12 }} />
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
                  <ReferenceLine y={totalFeCap} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: `FE Cap (${totalFeCap})`, position: 'right', fontSize: 10, fill: '#3b82f6' }} />
                  <ReferenceLine y={totalBeCap} stroke="#10b981" strokeDasharray="5 5" label={{ value: `BE Cap (${totalBeCap})`, position: 'right', fontSize: 10, fill: '#10b981' }} />
                  <Bar dataKey="fe" name="FE Demand" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="be" name="BE Demand" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
              );
            })()
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
  );
}
