export const config = { runtime: 'edge' };

/**
 * Clears all authentication cookies
 */
export default async function handler() {
  const clearCookieOptions = ['Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'].join('; ');

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.append('Set-Cookie', `access_token=; ${clearCookieOptions}`);
  headers.append('Set-Cookie', `refresh_token=; ${clearCookieOptions}`);
  headers.append('Set-Cookie', `token_expires=; ${clearCookieOptions}`);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
}
