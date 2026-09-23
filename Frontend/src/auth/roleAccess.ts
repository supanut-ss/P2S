export type Role = 'staff' | 'finance' | 'admin';

/**
 * Single source of truth for which roles can reach which route — both the nav (what's
 * shown) and RoleRoute (what's actually reachable by typing the URL) read from this, so
 * they can't drift apart. Roles map to the actions each role can actually perform on that
 * screen (matches the backend's own [Authorize(Roles = ...)] gates):
 * - staff: places orders, scans deliveries, withdraws stock, and requests reimbursement
 *   (but can't approve/pay it — those buttons are separately gated in ReimbursementsPage).
 * - finance: approves/pays reimbursements, resolves cancellations, and views inventory
 *   (read-only in practice — the withdraw action isn't gated out, but finance's own
 *   reimbursement math depends on knowing what's actually in stock).
 * - admin: everything, including Master data.
 */
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/': ['staff', 'finance', 'admin'],
  '/orders': ['staff', 'admin'],
  '/reimbursements': ['staff', 'finance', 'admin'],
  '/scan': ['staff', 'admin'],
  '/inventory': ['staff', 'finance', 'admin'],
  '/cancellations': ['finance', 'admin'],
  '/admin': ['admin'],
};

export function canAccessRoute(role: string | undefined, path: string): boolean {
  const allowed = ROUTE_ROLES[path];
  return allowed ? allowed.includes(role as Role) : true;
}
