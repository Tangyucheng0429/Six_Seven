/**
 * Session cookies for host_id / user_id.
 * secure + SameSite=None only when FRONTEND_URL is HTTPS (required by browsers).
 * On http:// IP deploy, use lax + non-secure so cookies work on same-origin nginx.
 */
export function sessionCookieOptions() {
  const frontend = (process.env.FRONTEND_URL || '').trim();
  const isHttps = frontend.startsWith('https://');

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
