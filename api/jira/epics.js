export const config = { runtime: 'edge' };

import {
  getAccessToken,
  unauthorizedResponse,
  jsonResponse,
} from './_auth.js';

/**
 * Search JIRA issues using the new /search/jql POST endpoint
 */
async function jiraSearch(accessToken, baseUrl, jql, fields = [], maxResults = 100) {
  const response = await fetch(`${baseUrl}/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      fields,
      maxResults,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`JIRA API error ${response.status}:`, errorText);
    throw new Error(`JIRA API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Get epics and their child issues for a project
 * Query params: cloudId (required), projectKey (required)
 */
export default async function handler(request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const cloudId = url.searchParams.get('cloudId');
  const projectKey = url.searchParams.get('projectKey');

  if (!cloudId || !projectKey) {
    return jsonResponse({ error: 'Missing cloudId or projectKey parameter' }, 400);
  }

  try {
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;

    // First, get all epics in the project
    const epicsJql = `project = ${projectKey} AND type = Epic ORDER BY created DESC`;
    console.log('Fetching epics with JQL:', epicsJql);

    const epicsData = await jiraSearch(
      accessToken,
      baseUrl,
      epicsJql,
      ['summary', 'description', 'status', 'created', 'parent']
    );
    console.log(`Found ${epicsData.issues?.length || 0} epics`);

    // For listing, just return epic metadata (no children - those are fetched on import)
    const epicsWithChildren = (epicsData.issues || []).map((epic) => ({
      id: epic.id,
      key: epic.key,
      summary: epic.fields.summary,
      description: epic.fields.description,
      status: epic.fields.status?.name,
      created: epic.fields.created,
      children: [], // Children fetched separately via epic-details endpoint
    }));

    return jsonResponse(epicsWithChildren);
  } catch (err) {
    console.error('Failed to fetch epics:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}
