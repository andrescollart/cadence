/**
 * Mock Atlassian OAuth responses for testing
 */

export const mockTokenResponse = {
  access_token: 'mock_access_token_12345',
  refresh_token: 'mock_refresh_token_67890',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'read:jira-work read:jira-user write:jira-work offline_access',
};

export const mockUserResponse = {
  account_id: 'mock_account_id',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.png',
};

export const mockAccessibleResources = [
  {
    id: 'cloud_id_12345',
    name: 'Test Site',
    url: 'https://test-site.atlassian.net',
    scopes: ['read:jira-work', 'read:jira-user', 'write:jira-work'],
    avatarUrl: 'https://example.com/site-avatar.png',
  },
];

export const mockProjects = [
  {
    id: '10000',
    key: 'TEST',
    name: 'Test Project',
    projectTypeKey: 'software',
  },
  {
    id: '10001',
    key: 'DEMO',
    name: 'Demo Project',
    projectTypeKey: 'software',
  },
];

export const mockEpics = [
  {
    id: '10100',
    key: 'TEST-1',
    fields: {
      summary: 'Epic 1: User Authentication',
      description: '`GANTT_CONFIG: {"feEffortDays": 10, "beEffortDays": 5}`',
      issuetype: { name: 'Epic' },
      status: { name: 'In Progress' },
      created: '2024-01-01T00:00:00.000Z',
    },
  },
  {
    id: '10101',
    key: 'TEST-2',
    fields: {
      summary: 'Epic 2: Payment Integration',
      description: '`GANTT_CONFIG: {"feEffortDays": 15, "beEffortDays": 20}`',
      issuetype: { name: 'Epic' },
      status: { name: 'To Do' },
      created: '2024-01-15T00:00:00.000Z',
    },
  },
];

/**
 * Create a mock fetch function that returns Atlassian responses
 */
export function createMockFetch(overrides = {}) {
  return vi.fn().mockImplementation((url, options = {}) => {
    // Token endpoint
    if (url.includes('oauth/token')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(overrides.token || mockTokenResponse),
      });
    }

    // User info endpoint
    if (url.includes('/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(overrides.user || mockUserResponse),
      });
    }

    // Accessible resources
    if (url.includes('accessible-resources')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(overrides.resources || mockAccessibleResources),
      });
    }

    // Projects
    if (url.includes('/project')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(overrides.projects || mockProjects),
      });
    }

    // Default: 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  });
}

/**
 * Create mock request/response objects for API route testing
 */
export function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:5175/api/auth/login');

  return {
    method: options.method || 'GET',
    url: url.toString(),
    headers: new Map(Object.entries(options.headers || {})),
    cookies: options.cookies || {},
    query: Object.fromEntries(url.searchParams),
    body: options.body || null,
  };
}

export function createMockResponse() {
  const headers = new Map();
  const cookies = [];
  let statusCode = 200;
  let body = null;
  let redirectUrl = null;

  return {
    status: (code) => {
      statusCode = code;
      return this;
    },
    setHeader: (name, value) => {
      headers.set(name, value);
      return this;
    },
    cookie: (name, value, options) => {
      cookies.push({ name, value, options });
      return this;
    },
    clearCookie: (name, options) => {
      cookies.push({ name, value: '', options: { ...options, maxAge: 0 } });
      return this;
    },
    redirect: (url) => {
      redirectUrl = url;
      return this;
    },
    json: (data) => {
      body = data;
      return this;
    },
    // Getters for assertions
    _getStatusCode: () => statusCode,
    _getHeaders: () => Object.fromEntries(headers),
    _getCookies: () => cookies,
    _getBody: () => body,
    _getRedirectUrl: () => redirectUrl,
  };
}
