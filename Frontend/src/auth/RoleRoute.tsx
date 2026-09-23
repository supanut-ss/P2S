import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { canAccessRoute } from './roleAccess';

/**
 * Backs up the nav-hiding in AppLayout with an actual route guard — hiding a menu item
 * doesn't stop someone from typing the URL directly. Redirects to the dashboard rather than
 * showing a blank/broken page, since the destination page's own data fetches would 403
 * against the backend's matching [Authorize(Roles = ...)] gate anyway.
 */
export function RoleRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!canAccessRoute(user?.role, location.pathname)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
