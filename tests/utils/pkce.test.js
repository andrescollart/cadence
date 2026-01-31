import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  base64UrlEncode,
} from '../../src/utils/oauth/pkce.js';

describe('PKCE Utilities', () => {
  describe('generateCodeVerifier', () => {
    it('generates a string of correct length', () => {
      const verifier = generateCodeVerifier();
      // RFC 7636 requires 43-128 characters
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('generates URL-safe characters only', () => {
      const verifier = generateCodeVerifier();
      // Only unreserved characters: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('generates unique values on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('generates a valid SHA-256 base64url challenge', async () => {
      const verifier = 'test_verifier_string_for_pkce';
      const challenge = await generateCodeChallenge(verifier);

      // Base64url encoded SHA-256 is 43 characters
      expect(challenge.length).toBe(43);
      // Base64url uses only these characters (no padding)
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('produces consistent output for same input', async () => {
      const verifier = 'consistent_test_verifier';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('produces different output for different input', async () => {
      const challenge1 = await generateCodeChallenge('verifier_one');
      const challenge2 = await generateCodeChallenge('verifier_two');
      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('generateState', () => {
    it('generates a string of reasonable length', () => {
      const state = generateState();
      expect(state.length).toBeGreaterThanOrEqual(16);
      expect(state.length).toBeLessThanOrEqual(64);
    });

    it('generates URL-safe characters only', () => {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('generates unique values on each call', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('base64UrlEncode', () => {
    it('encodes without padding', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = base64UrlEncode(buffer);
      expect(encoded).not.toContain('=');
    });

    it('replaces + with -', () => {
      // Input that produces + in standard base64
      const buffer = new Uint8Array([251, 239]); // produces "++" in base64
      const encoded = base64UrlEncode(buffer);
      expect(encoded).not.toContain('+');
    });

    it('replaces / with _', () => {
      // Input that produces / in standard base64
      const buffer = new Uint8Array([255, 255]); // produces "//" in base64
      const encoded = base64UrlEncode(buffer);
      expect(encoded).not.toContain('/');
    });
  });
});
