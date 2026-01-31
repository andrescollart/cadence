import React from 'react';
import { DEFAULT_TEAMS } from '../../constants';

export default function TeamBadge({ team, teams, size = 'sm' }) {
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
