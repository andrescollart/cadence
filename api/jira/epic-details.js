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
 * Get full details for specific epics including nested children (grandchildren)
 * Query params: cloudId (required), epicKeys (required, comma-separated)
 */
export default async function handler(request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const cloudId = url.searchParams.get('cloudId');
  const epicKeys = url.searchParams.get('epicKeys');
  const startDateField = url.searchParams.get('startDateField') || null;
  const endDateField = url.searchParams.get('endDateField') || 'duedate';

  if (!cloudId || !epicKeys) {
    return jsonResponse({ error: 'Missing cloudId or epicKeys parameter' }, 400);
  }


  const epicKeyList = epicKeys.split(',').map(k => k.trim()).filter(Boolean);
  if (epicKeyList.length === 0) {
    return jsonResponse({ error: 'No valid epic keys provided' }, 400);
  }

  try {
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;

    // Helper to add delay between requests
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to fetch children with retry on rate limit
    async function fetchChildren(parentKey, useEpicLink = false, retries = 3) {
      try {
        const childrenJql = useEpicLink
          ? `"Epic Link" = ${parentKey} ORDER BY created ASC`
          : `parent = ${parentKey} ORDER BY created ASC`;
        // Build fields list including the configured date fields
        const fields = ['summary', 'description', 'status', 'issuetype', 'created', 'duedate'];
        if (startDateField && !fields.includes(startDateField)) fields.push(startDateField);
        if (endDateField && !fields.includes(endDateField)) fields.push(endDateField);

        const childrenData = await jiraSearch(
          accessToken,
          baseUrl,
          childrenJql,
          fields
        );
        return childrenData.issues || [];
      } catch (err) {
        // Retry on rate limit
        if (err.message.includes('429') && retries > 0) {
          console.log(`Rate limited, waiting 1s before retry for ${parentKey}...`);
          await delay(1000);
          return fetchChildren(parentKey, useEpicLink, retries - 1);
        }
        // If parent field fails, try Epic Link
        if (!useEpicLink && !err.message.includes('429')) {
          return fetchChildren(parentKey, true, retries);
        }
        console.warn(`Could not fetch children for ${parentKey}:`, err.message);
        return [];
      }
    }

    // Fetch each epic with its full hierarchy
    const epicsWithFullHierarchy = [];

    for (const epicKey of epicKeyList) {
      console.log(`Fetching full hierarchy for ${epicKey}...`);

      // Build fields list including the configured date fields
      const epicFields = ['summary', 'description', 'status', 'created', 'duedate'];
      if (startDateField && !epicFields.includes(startDateField)) epicFields.push(startDateField);
      if (endDateField && !epicFields.includes(endDateField)) epicFields.push(endDateField);

      // Fetch the epic itself
      const epicData = await jiraSearch(
        accessToken,
        baseUrl,
        `key = ${epicKey}`,
        epicFields
      );

      if (!epicData.issues || epicData.issues.length === 0) {
        console.warn(`Epic ${epicKey} not found`);
        continue;
      }

      const epic = epicData.issues[0];

      await delay(100);

      // Fetch direct children
      const childIssues = await fetchChildren(epicKey);
      await delay(100);

      // For each child, fetch grandchildren (sequentially to avoid rate limits)
      const children = [];
      for (const child of childIssues) {
        const grandchildIssues = await fetchChildren(child.key);

        // Helper to extract dates from JIRA fields using configured field IDs
        const extractDates = (fields) => {
          const startDate = startDateField ? fields[startDateField] : null;
          const endDate = endDateField ? fields[endDateField] : fields.duedate;
          return { startDate, endDate };
        };

        const childDates = extractDates(child.fields);

        children.push({
          id: child.id,
          key: child.key,
          summary: child.fields.summary,
          description: child.fields.description,
          status: child.fields.status?.name,
          issueType: child.fields.issuetype?.name,
          created: child.fields.created,
          startDate: childDates.startDate,
          endDate: childDates.endDate,
          children: grandchildIssues.map(gc => {
            const gcDates = extractDates(gc.fields);
            return {
              id: gc.id,
              key: gc.key,
              summary: gc.fields.summary,
              description: gc.fields.description,
              status: gc.fields.status?.name,
              issueType: gc.fields.issuetype?.name,
              created: gc.fields.created,
              startDate: gcDates.startDate,
              endDate: gcDates.endDate,
              children: [], // Stop at grandchildren
            };
          }),
        });

        await delay(100); // Rate limit protection
      }

      const epicDates = {
        startDate: startDateField ? epic.fields[startDateField] : null,
        endDate: endDateField ? epic.fields[endDateField] : epic.fields.duedate
      };

      epicsWithFullHierarchy.push({
        id: epic.id,
        key: epic.key,
        summary: epic.fields.summary,
        description: epic.fields.description,
        status: epic.fields.status?.name,
        created: epic.fields.created,
        startDate: epicDates.startDate,
        endDate: epicDates.endDate,
        children,
      });
    }

    return jsonResponse(epicsWithFullHierarchy);
  } catch (err) {
    console.error('Failed to fetch epic details:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}
