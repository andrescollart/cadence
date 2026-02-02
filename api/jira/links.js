export const config = { runtime: 'edge' };

import { getAccessToken, unauthorizedResponse, jsonResponse } from './_auth.js';

/**
 * JIRA Issue Links API
 *
 * GET: Get available link types for a cloud site
 * POST: Create an issue link
 * DELETE: Remove an issue link
 */
export default async function handler(request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);

  if (request.method === 'GET') {
    return handleGetLinkTypes(accessToken, url);
  } else if (request.method === 'POST') {
    return handleCreateLink(accessToken, request);
  } else if (request.method === 'DELETE') {
    return handleDeleteLink(accessToken, url);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

/**
 * Get available issue link types
 */
async function handleGetLinkTypes(accessToken, url) {
  const cloudId = url.searchParams.get('cloudId');

  if (!cloudId) {
    return jsonResponse({ error: 'Missing cloudId' }, 400);
  }

  try {
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
    const response = await fetch(`${baseUrl}/issueLinkType`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch link types: ${response.status}`);
    }

    const data = await response.json();
    return jsonResponse(data.issueLinkTypes || []);
  } catch (err) {
    console.error('Failed to get link types:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Create an issue link
 * Body: { cloudId, linkType, inwardIssue, outwardIssue }
 *
 * linkType: Name of the link type (e.g., "Blocks")
 * inwardIssue: The issue key that is blocked/depends (e.g., "PROJ-456")
 * outwardIssue: The issue key that blocks/is depended on (e.g., "PROJ-123")
 */
async function handleCreateLink(accessToken, request) {
  try {
    const body = await request.json();
    const { cloudId, linkType, inwardIssue, outwardIssue } = body;

    if (!cloudId || !linkType || !inwardIssue || !outwardIssue) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
    const response = await fetch(`${baseUrl}/issueLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: { name: linkType },
        inwardIssue: { key: inwardIssue },
        outwardIssue: { key: outwardIssue },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errorMessages?.[0] || `Failed to create link: ${response.status}`);
    }

    return jsonResponse({ success: true, inwardIssue, outwardIssue });
  } catch (err) {
    console.error('Failed to create issue link:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Delete an issue link
 * Query params: cloudId, linkId
 */
async function handleDeleteLink(accessToken, url) {
  const cloudId = url.searchParams.get('cloudId');
  const linkId = url.searchParams.get('linkId');

  if (!cloudId || !linkId) {
    return jsonResponse({ error: 'Missing cloudId or linkId' }, 400);
  }

  try {
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
    const response = await fetch(`${baseUrl}/issueLink/${linkId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errorMessages?.[0] || `Failed to delete link: ${response.status}`);
    }

    return jsonResponse({ success: true, linkId });
  } catch (err) {
    console.error('Failed to delete issue link:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}
