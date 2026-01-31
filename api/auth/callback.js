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
 * Handles OAuth callback from Atlassian
 * Validates state, exchanges code for tokens, stores tokens in HTTP-only cookies
 */
export default async function handler(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OAuth errors from Atlassian
  if (error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/?auth=error&message=${encodeURIComponent(errorDescription || error)}`,
      },
    });
  }

  // Validate required parameters
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get cookies for PKCE validation
  const cookies = parseCookies(request);
  const storedState = cookies.oauth_state;
  const codeVerifier = cookies.pkce_verifier;

  // Validate state (CSRF protection)
  if (!state || state !== storedState) {
    return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate PKCE verifier
  if (!codeVerifier) {
    return new Response(JSON.stringify({ error: 'Missing PKCE verifier' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Exchange code for tokens
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
  const redirectUri = process.env.ATLASSIAN_REDIRECT_URI;

  try {
    const tokenResponse = await fetch(ATLASSIAN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/?auth=error&message=${encodeURIComponent(errorData.error_description || 'Token exchange failed')}`,
        },
      });
    }

    const tokens = await tokenResponse.json();

    // Cookie options for tokens
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

    // Clear PKCE cookies
    const clearCookieOptions = ['Path=/', 'Max-Age=0'].join('; ');

    // Build response with cookies
    const headers = new Headers();
    headers.set('Location', '/?auth=success');
    headers.append('Set-Cookie', `access_token=${tokens.access_token}; ${accessTokenOptions}`);
    headers.append('Set-Cookie', `refresh_token=${tokens.refresh_token}; ${refreshTokenOptions}`);
    headers.append(
      'Set-Cookie',
      `token_expires=${Date.now() + tokens.expires_in * 1000}; ${accessTokenOptions}`
    );
    headers.append('Set-Cookie', `pkce_verifier=; ${clearCookieOptions}`);
    headers.append('Set-Cookie', `oauth_state=; ${clearCookieOptions}`);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/?auth=error&message=${encodeURIComponent('Authentication failed')}`,
      },
    });
  }
}
