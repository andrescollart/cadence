import {
  getAccessToken,
  unauthorizedResponse,
  jsonResponse,
  atlassianFetch,
} from './_auth.js';

/**
 * Get projects for a specific Atlassian cloud site
 * Query params: cloudId (required)
 */
export default async function handler(request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const cloudId = url.searchParams.get('cloudId');

  if (!cloudId) {
    return jsonResponse({ error: 'Missing cloudId parameter' }, 400);
  }

  try {
    const projectsUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`;
    const data = await atlassianFetch(accessToken, projectsUrl);

    // Return simplified project list
    return jsonResponse(
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
    return jsonResponse({ error: err.message }, 500);
  }
}
