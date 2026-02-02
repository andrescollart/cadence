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
 * Handles OAuth callback from Atlassian
 * Validates state, exchanges code for tokens, stores tokens in HTTP-only cookies
 */
export default async function handler(req, res) {
  const { code, state, error, error_description: errorDescription } = req.query;

  // Handle OAuth errors from Atlassian
  if (error) {
    return res.redirect(`/?auth=error&message=${encodeURIComponent(errorDescription || error)}`);
  }

  // Validate required parameters
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // Get cookies for PKCE validation
  const cookies = parseCookies(req);
  const storedState = cookies.oauth_state;
  const codeVerifier = cookies.pkce_verifier;

  // Validate state (CSRF protection)
  if (!state || state !== storedState) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  // Validate PKCE verifier
  if (!codeVerifier) {
    return res.status(400).json({ error: 'Missing PKCE verifier' });
  }

  // Exchange code for tokens
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

  // Derive redirect URI from request (must match what was used in login)
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

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
      return res.redirect(
        `/?auth=error&message=${encodeURIComponent(errorData.error_description || 'Token exchange failed')}`
      );
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

    // Set cookies and redirect
    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; ${accessTokenOptions}`,
      `refresh_token=${tokens.refresh_token}; ${refreshTokenOptions}`,
      `token_expires=${Date.now() + tokens.expires_in * 1000}; ${accessTokenOptions}`,
      `pkce_verifier=; ${clearCookieOptions}`,
      `oauth_state=; ${clearCookieOptions}`,
    ]);

    res.redirect('/?auth=success');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`/?auth=error&message=${encodeURIComponent('Authentication failed')}`);
  }
}
