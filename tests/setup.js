import '@testing-library/jest-dom';

// Mock crypto for PKCE generation in Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: async (algorithm, data) => {
        const { createHash } = await import('crypto');
        const hash = createHash('sha256');
        hash.update(Buffer.from(data));
        return hash.digest().buffer;
      },
    },
  };
}

// Mock window.location for OAuth redirect tests
if (typeof window !== 'undefined') {
  delete window.location;
  window.location = {
    href: 'http://localhost:5175',
    origin: 'http://localhost:5175',
    pathname: '/',
    search: '',
    assign: vi.fn(),
    replace: vi.fn(),
  };
}
