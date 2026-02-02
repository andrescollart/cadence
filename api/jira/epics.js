import { getAccessToken } from './_auth.js';

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
export default async function handler(req, res) {
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { cloudId, projectKey } = req.query;

  if (!cloudId || !projectKey) {
    return res.status(400).json({ error: 'Missing cloudId or projectKey parameter' });
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

    return res.status(200).json(epicsWithChildren);
  } catch (err) {
    console.error('Failed to fetch epics:', err);
    return res.status(500).json({ error: err.message });
  }
}
