// Parse GANTT_CONFIG from issue description
export function parseGanttConfig(description) {
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
export function appendGanttConfig(description, config) {
  // Remove existing GANTT_CONFIG if present
  const cleanDesc = (description || '').replace(/\n*-{3,}\n*`GANTT_CONFIG:[^`]+`\s*$/, '').trim();
  const configJson = JSON.stringify(config);
  return `${cleanDesc}\n\n----\n\n\`GANTT_CONFIG: ${configJson}\``;
}
