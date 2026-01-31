import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('ATLASSIAN_CLIENT_ID', 'test_client_id');
vi.stubEnv('ATLASSIAN_REDIRECT_URI', 'http://localhost:5173/api/auth/callback');
vi.stubEnv('ATLASSIAN_SCOPES', 'read:jira-work offline_access');
vi.stubEnv('AUTH_SECRET', 'test_secret');

describe('/api/auth/login', () => {
  let handler;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../api/auth/login.js');
    handler = module.default;
  });

  it('redirects to Atlassian authorization URL', async () => {
    const mockRequest = new Request('http://localhost:5173/api/auth/login');
    const response = await handler(mockRequest);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('https://auth.atlassian.com/authorize');
  });

  it('includes required OAuth parameters in redirect URL', async () => {
    const mockRequest = new Request('http://localhost:5173/api/auth/login');
    const response = await handler(mockRequest);

    const location = new URL(response.headers.get('Location'));
    expect(location.searchParams.get('client_id')).toBe('test_client_id');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/api/auth/callback'
    );
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toContain('read:jira-work');
  });

  it('includes PKCE code_challenge parameter', async () => {
    const mockRequest = new Request('http://localhost:5173/api/auth/login');
    const response = await handler(mockRequest);

    const location = new URL(response.headers.get('Location'));
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes state parameter for CSRF protection', async () => {
    const mockRequest = new Request('http://localhost:5173/api/auth/login');
    const response = await handler(mockRequest);

    const location = new URL(response.headers.get('Location'));
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(location.searchParams.get('state').length).toBeGreaterThan(10);
  });

  it('sets HTTP-only cookies for state and verifier', async () => {
    const mockRequest = new Request('http://localhost:5173/api/auth/login');
    const response = await handler(mockRequest);

    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThanOrEqual(2);

    const hasPkceVerifier = cookies.some((c) => c.includes('pkce_verifier='));
    const hasOauthState = cookies.some((c) => c.includes('oauth_state='));

    expect(hasPkceVerifier).toBe(true);
    expect(hasOauthState).toBe(true);

    // Check security attributes
    cookies.forEach((cookie) => {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });
  });

  it('uses audience parameter for Atlassian API', async () => {
    const mockRequest = new Request('http://localhost:5173/api/auth/login');
    const response = await handler(mockRequest);

    const location = new URL(response.headers.get('Location'));
    expect(location.searchParams.get('audience')).toBe('api.atlassian.com');
  });
});
