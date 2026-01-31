import { getAccessToken, unauthorizedResponse, jsonResponse } from './_auth.js';
import { appendGanttConfig, parseGanttConfig } from '../../src/utils/ganttConfig.js';

/**
 * Sync GANTT_CONFIG back to JIRA issue description
 * POST body: { cloudId, issueKey, config }
 */
export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { cloudId, issueKey, config } = body;

    if (!cloudId || !issueKey || !config) {
      return jsonResponse({ error: 'Missing cloudId, issueKey, or config' }, 400);
    }

    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;

    // First, get the current issue to preserve existing description
    const getIssueUrl = `${baseUrl}/issue/${issueKey}?fields=description`;
    const issueResponse = await fetch(getIssueUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!issueResponse.ok) {
      throw new Error(`Failed to fetch issue: ${issueResponse.status}`);
    }

    const issue = await issueResponse.json();

    // Convert ADF description to text if needed, or use empty string
    let currentDescription = '';
    if (issue.fields.description) {
      if (typeof issue.fields.description === 'string') {
        currentDescription = issue.fields.description;
      } else if (issue.fields.description.content) {
        // ADF format - extract text content
        currentDescription = extractTextFromAdf(issue.fields.description);
      }
    }

    // Parse existing GANTT_CONFIG and merge with new values
    // This ensures we don't lose existing fields when only updating some
    const existingConfig = parseGanttConfig(currentDescription) || {};
    const mergedConfig = { ...existingConfig, ...config };

    // Append merged GANTT_CONFIG (removes old one first)
    const newDescription = appendGanttConfig(currentDescription, mergedConfig);

    // Update the issue with new description
    // Note: JIRA API v3 requires ADF format for description
    const updateUrl = `${baseUrl}/issue/${issueKey}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          description: textToAdf(newDescription),
        },
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json().catch(() => ({}));
      throw new Error(error.errorMessages?.[0] || `Update failed: ${updateResponse.status}`);
    }

    return jsonResponse({ success: true, issueKey });
  } catch (err) {
    console.error('Failed to sync to JIRA:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Extract text content from ADF (Atlassian Document Format)
 */
function extractTextFromAdf(adf) {
  if (!adf || !adf.content) return '';

  let text = '';

  function traverse(node) {
    if (node.type === 'text') {
      text += node.text || '';
    } else if (node.type === 'hardBreak') {
      text += '\n';
    } else if (node.type === 'paragraph') {
      if (text && !text.endsWith('\n')) text += '\n';
      (node.content || []).forEach(traverse);
      text += '\n';
    } else if (node.content) {
      (node.content || []).forEach(traverse);
    }
  }

  adf.content.forEach(traverse);
  return text.trim();
}

/**
 * Convert plain text to minimal ADF format
 */
function textToAdf(text) {
  const paragraphs = text.split('\n\n').filter(Boolean);

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((para) => ({
      type: 'paragraph',
      content: para.split('\n').flatMap((line, i, arr) => {
        const nodes = [{ type: 'text', text: line }];
        if (i < arr.length - 1) {
          nodes.push({ type: 'hardBreak' });
        }
        return nodes;
      }),
    })),
  };
}
