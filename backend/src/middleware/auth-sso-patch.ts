// This gets prepended to existing auth.ts
import { Request } from 'express';

// Add cookie token check before existing logic
export function extractToken(req: Request): string | null {
  // Check cookie first (SSO from Portal)
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }
  
  // Check Authorization header (direct login)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}
