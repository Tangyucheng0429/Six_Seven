import { supabase } from '../config/supabase.js';

/**
 * Express middleware to authenticate Supabase users.
 * Supports standard login sessions and Anonymous Sign-In sessions seamlessly by validating the JWT token.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Session is invalid or has expired' });
    }

    // Inject user object into request
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware] Token verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
}
