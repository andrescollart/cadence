import { getAccessToken } from './_auth.js';

/**
 * JIRA Issue Links API
 *
 * GET: Get available link types for a cloud site
 * POST: Create an issue link
 * DELETE: Remove an issue link
 */
export default async function handler(req, res) {
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return handleGetLinkTypes(accessToken, req, res);
  } else if (req.method === 'POST') {
    return handleCreateLink(accessToken, req, res);
  } else if (req.method === 'DELETE') {
    return handleDeleteLink(accessToken, req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Get available issue link types
 */
async function handleGetLinkTypes(accessToken, req, res) {
  const { cloudId } = req.query;

  if (!cloudId) {
    return res.status(400).json({ error: 'Missing cloudId' });
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
    return res.status(200).json(data.issueLinkTypes || []);
  } catch (err) {
    console.error('Failed to get link types:', err);
    return res.status(500).json({ error: err.message });
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
async function handleCreateLink(accessToken, req, res) {
  try {
    const { cloudId, linkType, inwardIssue, outwardIssue } = req.body;

    if (!cloudId || !linkType || !inwardIssue || !outwardIssue) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    return res.status(200).json({ success: true, inwardIssue, outwardIssue });
  } catch (err) {
    console.error('Failed to create issue link:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Delete an issue link
 * Query params: cloudId, linkId
 */
async function handleDeleteLink(accessToken, req, res) {
  const { cloudId, linkId } = req.query;

  if (!cloudId || !linkId) {
    return res.status(400).json({ error: 'Missing cloudId or linkId' });
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

    return res.status(200).json({ success: true, linkId });
  } catch (err) {
    console.error('Failed to delete issue link:', err);
    return res.status(500).json({ error: err.message });
  }
}
