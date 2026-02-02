import { getAccessToken } from './_auth.js';

/**
 * Get available fields from JIRA, filtered to date-like fields
 * Query params: cloudId (required), projectKey (optional - for sample values)
 */
export default async function handler(req, res) {
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { cloudId, projectKey } = req.query;

  if (!cloudId) {
    return res.status(400).json({ error: 'Missing cloudId parameter' });
  }

  try {
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;

    // Fetch all fields
    const response = await fetch(`${baseUrl}/field`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JIRA API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const allFields = await response.json();

    // Filter to date fields and commonly useful fields
    let dateFields = allFields
      .filter((field) => {
        const schema = field.schema;
        if (!schema) return false;

        // Include date and datetime fields
        if (schema.type === 'date' || schema.type === 'datetime') return true;

        // Include fields with "date" in the name
        if (field.name.toLowerCase().includes('date')) return true;

        return false;
      })
      .map((field) => ({
        id: field.id,
        key: field.key,
        name: field.name,
        type: field.schema?.type || 'unknown',
        custom: field.custom || false,
        sample: null,
      }));

    // If projectKey provided, fetch sample issues to get example values
    if (projectKey) {
      try {
        // Fetch a few recent issues with date fields populated
        const searchResponse = await fetch(`${baseUrl}/search/jql`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jql: `project = ${projectKey} ORDER BY updated DESC`,
            fields: dateFields.map((f) => f.id),
            maxResults: 10,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const issues = searchData.issues || [];

          // For each field, find the first non-null sample value
          dateFields = dateFields.map((field) => {
            for (const issue of issues) {
              const value = issue.fields[field.id];
              if (value) {
                // Format the sample value
                let sample = value;
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                  // Format date nicely
                  sample = value.split('T')[0];
                }
                return { ...field, sample, sampleIssue: issue.key };
              }
            }
            return field;
          });
        }
      } catch (sampleErr) {
        console.warn('Failed to fetch sample values:', sampleErr.message);
        // Continue without samples
      }
    }

    // Sort: standard fields first, then custom fields alphabetically
    dateFields.sort((a, b) => {
      if (a.custom !== b.custom) return a.custom ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    console.log(`Found ${dateFields.length} date fields`);

    return res.status(200).json(dateFields);
  } catch (err) {
    console.error('Failed to fetch fields:', err);
    return res.status(500).json({ error: err.message });
  }
}
