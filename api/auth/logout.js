/**
 * Clears all authentication cookies
 */
export default async function handler(req, res) {
  const clearCookieOptions = ['Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'].join('; ');

  res.setHeader('Set-Cookie', [
    `access_token=; ${clearCookieOptions}`,
    `refresh_token=; ${clearCookieOptions}`,
    `token_expires=; ${clearCookieOptions}`,
  ]);

  res.status(200).json({ success: true });
}
