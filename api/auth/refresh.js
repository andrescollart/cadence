const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';

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
 * Refreshes the access token using the refresh token
 */
export default async function handler(req, res) {
  const cookies = parseCookies(req);
  const refreshToken = cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

  try {
    const tokenResponse = await fetch(ATLASSIAN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token refresh failed:', errorData);
      return res.status(401).json({ error: 'Token refresh failed' });
    }

    const tokens = await tokenResponse.json();

    // Cookie options
    const isProduction = process.env.NODE_ENV === 'production';
    const accessTokenOptions = [
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${tokens.expires_in || 3600}`,
      isProduction ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    const refreshTokenOptions = [
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${60 * 60 * 24 * 30}`, // 30 days
      isProduction ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    const cookiesToSet = [
      `access_token=${tokens.access_token}; ${accessTokenOptions}`,
      `token_expires=${Date.now() + tokens.expires_in * 1000}; ${accessTokenOptions}`,
    ];

    if (tokens.refresh_token) {
      cookiesToSet.push(`refresh_token=${tokens.refresh_token}; ${refreshTokenOptions}`);
    }

    res.setHeader('Set-Cookie', cookiesToSet);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
}
