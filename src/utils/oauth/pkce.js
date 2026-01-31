/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
 * RFC 7636: https://tools.ietf.org/html/rfc7636
 */

/**
 * Base64url encode a buffer (no padding, URL-safe characters)
 * @param {Uint8Array} buffer - The buffer to encode
 * @returns {string} Base64url encoded string
 */
export function base64UrlEncode(buffer) {
  // Convert buffer to base64
  let base64 = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    base64 += String.fromCharCode(bytes[i]);
  }

  // Convert to base64 and make URL-safe
  return btoa(base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a cryptographically random code verifier
 * RFC 7636 requires 43-128 characters from unreserved character set
 * @returns {string} Random code verifier
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate the code challenge from a code verifier using S256 method
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} Base64url encoded SHA-256 hash
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns {string} Random state string
 */
export function generateState() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}
