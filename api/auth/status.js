const ATLASSIAN_USER_URL = 'https://api.atlassian.com/me';

/**
 * Parse cookies from request headers
 */
function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
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
 * Returns authentication status and user info (if authenticated)
 * Never exposes raw tokens to the frontend
 */
export default async function handler(request) {
  const cookies = parseCookies(request);
  const accessToken = cookies.access_token;
  const tokenExpires = cookies.token_expires;

  if (!accessToken) {
    return new Response(
      JSON.stringify({
        authenticated: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check if token is expired
  const isExpired = tokenExpires && Date.now() > parseInt(tokenExpires, 10);
  if (isExpired) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        expired: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Fetch user info from Atlassian
    const userResponse = await fetch(ATLASSIAN_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          error: 'Failed to fetch user info',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const user = await userResponse.json();

    return new Response(
      JSON.stringify({
        authenticated: true,
        user: {
          id: user.account_id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Status check error:', err);
    return new Response(
      JSON.stringify({
        authenticated: false,
        error: 'Status check failed',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
