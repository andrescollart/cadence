const ATLASSIAN_USER_URL = 'https://api.atlassian.com/me';

/**
 * Parse cookies from request headers
 */
function parseCookies(req) {
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
 * Returns authentication status and user info (if authenticated)
 * Never exposes raw tokens to the frontend
 */
export default async function handler(req, res) {
  const cookies = parseCookies(req);
  const accessToken = cookies.access_token;
  const tokenExpires = cookies.token_expires;

  if (!accessToken) {
    return res.status(200).json({ authenticated: false });
  }

  // Check if token is expired
  const isExpired = tokenExpires && Date.now() > parseInt(tokenExpires, 10);
  if (isExpired) {
    return res.status(200).json({ authenticated: false, expired: true });
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
      return res.status(200).json({
        authenticated: false,
        error: 'Failed to fetch user info',
      });
    }

    const user = await userResponse.json();

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.account_id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error('Status check error:', err);
    return res.status(200).json({
      authenticated: false,
      error: 'Status check failed',
    });
  }
}
