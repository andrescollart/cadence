import { getAccessToken, atlassianFetch } from './_auth.js';

const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

/**
 * Get accessible Atlassian resources (sites) for the authenticated user
 */
export default async function handler(req, res) {
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const resources = await atlassianFetch(accessToken, ATLASSIAN_RESOURCES_URL);

    // Return simplified resource list
    return res.status(200).json(
      resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        url: resource.url,
        avatarUrl: resource.avatarUrl,
      }))
    );
  } catch (err) {
    console.error('Failed to fetch resources:', err);
    return res.status(500).json({ error: err.message });
  }
}
