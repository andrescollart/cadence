/**
 * Shared authentication utilities for JIRA API routes (Node.js serverless)
 */

/**
 * Parse cookies from request headers
 */
export function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

/**
 * Get access token from request cookies
 * Returns null if not authenticated
 */
export function getAccessToken(req) {
  const cookies = parseCookies(req);
  return cookies.access_token || null;
}

/**
 * Make an authenticated request to the Atlassian API
 */
export async function atlassianFetch(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}
