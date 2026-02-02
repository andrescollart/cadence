export const config = { runtime: 'edge' };

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../../src/utils/oauth/pkce.js';

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize';

/**
 * Initiates Atlassian OAuth 2.0 authorization flow with PKCE
 * Sets HTTP-only cookies for PKCE verifier and state, then redirects to Atlassian
 */
export default async function handler(request) {
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const scopes = process.env.ATLASSIAN_SCOPES || 'read:jira-work offline_access';

  if (!clientId) {
    return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Derive redirect URI from request
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Build authorization URL
  const authUrl = new URL(ATLASSIAN_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('prompt', 'consent');

  // Cookie options - secure in production, lax for CSRF protection
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${60 * 10}`, // 10 minutes for OAuth flow
    isProduction ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  // Create response with redirect and cookies
  const headers = new Headers();
  headers.set('Location', authUrl.toString());
  headers.append('Set-Cookie', `pkce_verifier=${codeVerifier}; ${cookieOptions}`);
  headers.append('Set-Cookie', `oauth_state=${state}; ${cookieOptions}`);

  return new Response(null, {
    status: 302,
    headers,
  });
}
