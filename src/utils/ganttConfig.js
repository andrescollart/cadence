// Extract plain text from ADF (Atlassian Document Format) object
function extractTextFromAdf(adf, debug = false) {
  if (!adf || typeof adf !== 'object') return '';

  let text = '';
  const processedNodes = new Set();

  function traverse(node, depth = 0) {
    if (!node) return;

    // Prevent double-processing
    const nodeId = JSON.stringify({ type: node.type, text: node.text?.slice(0, 20) });
    if (processedNodes.has(nodeId) && node.type === 'text') return;
    processedNodes.add(nodeId);

    if (debug) {
      console.log('  '.repeat(depth) + `ADF node: ${node.type}`);
    }

    // Text node - extract the text
    if (node.type === 'text' && node.text) {
      text += node.text;
      return; // Text nodes don't have content
    }

    // Inline code - preserve backticks for GANTT_CONFIG detection
    if (node.type === 'inlineCode' && node.attrs?.text) {
      text += '`' + node.attrs.text + '`';
      return;
    }

    // Code block - preserve content with backticks
    if (node.type === 'codeBlock') {
      text += '`';
      if (node.content) {
        node.content.forEach(child => traverse(child, depth + 1));
      }
      text += '`\n';
      return;
    }

    // Block elements - process content and add newline
    if (['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'rule', 'panel'].includes(node.type)) {
      if (node.content) {
        node.content.forEach(child => traverse(child, depth + 1));
      }
      text += '\n';
      return;
    }

    // Table cells
    if (['tableRow', 'tableCell', 'tableHeader'].includes(node.type)) {
      if (node.content) {
        node.content.forEach(child => traverse(child, depth + 1));
      }
      text += ' ';
      return;
    }

    // Generic container - just recurse
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => traverse(child, depth + 1));
    }
  }

  traverse(adf);
  return text;
}

// Parse GANTT_CONFIG from issue description
export function parseGanttConfig(description, debugKey = null) {
  if (!description) {
    if (debugKey) console.log(`[${debugKey}] parseGanttConfig: No description provided`);
    return null;
  }

  // Handle ADF (Atlassian Document Format) objects
  let textDescription = description;
  if (typeof description === 'object') {
    textDescription = extractTextFromAdf(description);
  }

  if (typeof textDescription !== 'string') {
    return null;
  }

  // Try multiple patterns - with or without backticks
  const patterns = [
    /`GANTT_CONFIG:\s*(\{[^`]+\})`/,           // With backticks
    /GANTT_CONFIG:\s*(\{[^\n]+\})/,            // Without backticks, single line
    /GANTT_CONFIG:\s*(\{[\s\S]*?\})\s*(?:\n|$)/ // Without backticks, possibly multiline
  ];

  for (const pattern of patterns) {
    const match = textDescription.match(pattern);
    if (match) {
      try {
        const config = JSON.parse(match[1]);
        if (debugKey) console.log(`[${debugKey}] Parsed GANTT_CONFIG:`, config);
        return config;
      } catch (e) {
        if (debugKey) console.warn(`[${debugKey}] Failed to parse GANTT_CONFIG JSON:`, match[1], e);
      }
    }
  }

  if (debugKey) console.log(`[${debugKey}] No GANTT_CONFIG match found in description`);
  return null;
}

// Remove all GANTT_CONFIG blocks from description (all variants)
export function removeGanttConfig(description) {
  if (!description) return '';

  let cleaned = description;

  // Remove GANTT_CONFIG with backticks (anywhere in text)
  cleaned = cleaned.replace(/`GANTT_CONFIG:\s*\{[^`]+\}`/g, '');

  // Remove GANTT_CONFIG without backticks (match until end of line)
  // JSON is always on single line, so match everything from GANTT_CONFIG: to newline
  cleaned = cleaned.replace(/GANTT_CONFIG:\s*\{[^\n]+\}\s*\n?/g, '');

  // Remove separator lines that are now orphaned (---- with only whitespace around)
  cleaned = cleaned.replace(/\n*-{3,}\s*\n*/g, '\n\n');

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

// Generate description with GANTT_CONFIG appended
export function appendGanttConfig(description, config) {
  // Remove ALL existing GANTT_CONFIG blocks first
  const cleanDesc = removeGanttConfig(description);
  const configJson = JSON.stringify(config);
  return `${cleanDesc}\n\n----\n\n\`GANTT_CONFIG: ${configJson}\``;
}
