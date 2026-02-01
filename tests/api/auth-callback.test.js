import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
vi.stubEnv('ATLASSIAN_CLIENT_ID', 'test_client_id');
vi.stubEnv('ATLASSIAN_CLIENT_SECRET', 'test_client_secret');
vi.stubEnv('ATLASSIAN_REDIRECT_URI', 'http://localhost:5175/api/auth/callback');
vi.stubEnv('AUTH_SECRET', 'test_secret');

describe('/api/auth/callback', () => {
  let handler;
  let mockFetch;

  beforeEach(async () => {
    vi.resetModules();

    // Mock successful token exchange
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
    });
    global.fetch = mockFetch;

    const module = await import('../../api/auth/callback.js');
    handler = module.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error when code is missing', async () => {
    const url = 'http://localhost:5175/api/auth/callback?state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('code');
  });

  it('returns error when state does not match', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=wrong_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=correct_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('state');
  });

  it('returns error when PKCE verifier is missing', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state',
      },
    });

    const response = await handler(mockRequest);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('verifier');
  });

  it('exchanges code for tokens with correct parameters', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    await handler(mockRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.atlassian.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.grant_type).toBe('authorization_code');
    expect(callBody.client_id).toBe('test_client_id');
    expect(callBody.client_secret).toBe('test_client_secret');
    expect(callBody.code).toBe('auth_code');
    expect(callBody.code_verifier).toBe('test_verifier');
    expect(callBody.redirect_uri).toBe('http://localhost:5175/api/auth/callback');
  });

  it('sets access token in HTTP-only cookie on success', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);
    const cookies = response.headers.getSetCookie();

    const accessTokenCookie = cookies.find((c) => c.includes('access_token='));
    expect(accessTokenCookie).toBeTruthy();
    expect(accessTokenCookie).toContain('HttpOnly');
    expect(accessTokenCookie).toContain('SameSite=Strict');
  });

  it('sets refresh token in HTTP-only cookie on success', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);
    const cookies = response.headers.getSetCookie();

    const refreshTokenCookie = cookies.find((c) => c.includes('refresh_token='));
    expect(refreshTokenCookie).toBeTruthy();
    expect(refreshTokenCookie).toContain('HttpOnly');
  });

  it('clears PKCE cookies after successful exchange', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);
    const cookies = response.headers.getSetCookie();

    // Check that PKCE cookies are being cleared (Max-Age=0 or expired)
    const clearedVerifier = cookies.find(
      (c) => c.includes('pkce_verifier=') && (c.includes('Max-Age=0') || c.includes('Max-Age=-1'))
    );
    const clearedState = cookies.find(
      (c) => c.includes('oauth_state=') && (c.includes('Max-Age=0') || c.includes('Max-Age=-1'))
    );

    expect(clearedVerifier).toBeTruthy();
    expect(clearedState).toBeTruthy();
  });

  it('redirects to app root on success', async () => {
    const url = 'http://localhost:5175/api/auth/callback?code=auth_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/?auth=success');
  });

  it('handles token exchange errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Code expired',
        }),
    });

    const url = 'http://localhost:5175/api/auth/callback?code=expired_code&state=test_state';
    const mockRequest = new Request(url, {
      headers: {
        Cookie: 'oauth_state=test_state; pkce_verifier=test_verifier',
      },
    });

    const response = await handler(mockRequest);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('auth=error');
  });
});
