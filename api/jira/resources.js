export const config = { runtime: 'edge' };

import {
  getAccessToken,
  unauthorizedResponse,
  jsonResponse,
  atlassianFetch,
} from './_auth.js';

const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

/**
 * Get accessible Atlassian resources (sites) for the authenticated user
 */
export default async function handler(request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  try {
    const resources = await atlassianFetch(accessToken, ATLASSIAN_RESOURCES_URL);

    // Return simplified resource list
    return jsonResponse(
      resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        url: resource.url,
        avatarUrl: resource.avatarUrl,
      }))
    );
  } catch (err) {
    console.error('Failed to fetch resources:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}
