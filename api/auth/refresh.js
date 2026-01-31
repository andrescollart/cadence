const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';

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
 * Refreshes the access token using the refresh token
 */
export default async function handler(request) {
  const cookies = parseCookies(request);
  const refreshToken = cookies.refresh_token;

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: 'No refresh token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
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

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.append('Set-Cookie', `access_token=${tokens.access_token}; ${accessTokenOptions}`);
    if (tokens.refresh_token) {
      headers.append('Set-Cookie', `refresh_token=${tokens.refresh_token}; ${refreshTokenOptions}`);
    }
    headers.append(
      'Set-Cookie',
      `token_expires=${Date.now() + tokens.expires_in * 1000}; ${accessTokenOptions}`
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
