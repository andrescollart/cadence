import { getAccessToken, atlassianFetch } from './_auth.js';

/**
 * Get projects for a specific Atlassian cloud site
 * Query params: cloudId (required)
 */
export default async function handler(req, res) {
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { cloudId } = req.query;

  if (!cloudId) {
    return res.status(400).json({ error: 'Missing cloudId parameter' });
  }

  try {
    const projectsUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`;
    const data = await atlassianFetch(accessToken, projectsUrl);

    // Return simplified project list
    return res.status(200).json(
      data.values.map((project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        avatarUrl: project.avatarUrls?.['48x48'],
        style: project.style,
      }))
    );
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    return res.status(500).json({ error: err.message });
  }
}
