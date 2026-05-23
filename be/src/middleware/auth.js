import { supabase, supabaseAdmin } from '../config/supabase.js';

/**
 * Helper to manually parse a specific cookie from request headers.
 * Eliminates the need for an external cookie-parser dependency.
 */
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    const key = parts[0]?.trim();
    const val = parts.slice(1).join('=')?.trim();
    if (key) acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
  return cookies[name] || null;
}

/**
 * Express middleware to authenticate Supabase users.
 * Supports standard Bearer JWT tokens AND Cookie-based sessions (host_id/user_id) seamlessly.
 */
export async function requireAuth(req, res, next) {
  // 1. Try traditional Bearer Token authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        return next();
      }
    } catch (err) {
      console.error('[Auth Middleware] Bearer token verification failed:', err);
    }
  }

  // 2. Try Cookie-based authentication (supporting Session-less lightweight host tracking)
  const cookieUserId = getCookie(req, 'host_id') || getCookie(req, 'user_id');
  if (cookieUserId) {
    try {
      // Verify that this user ID exists in the database
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('user_id')
        .eq('user_id', cookieUserId)
        .maybeSingle();

      if (!error && user) {
        req.user = { id: user.user_id };
        return next();
      }
    } catch (err) {
      console.error('[Auth Middleware] Cookie user verification failed:', err);
    }
  }

  // If both methods fail, return 401 Unauthorized
  return res.status(401).json({ error: 'Unauthorized: Session is invalid or has expired' });
}
