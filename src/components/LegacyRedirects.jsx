import { Navigate, useLocation } from 'react-router-dom';

const LEGACY_PATH_MAP = {
  '/index.html': '/',
  '/admin-side/admin.html': '/admin',
  '/user-side/menu.html': '/menu',
  '/user-side/my_orders.html': '/orders',
  '/staff-side/staff_login.html': '/staff',
  '/staff-side/staff_dashboard.html': '/staff/dashboard',
  '/staff-side/place_order.html': '/staff/place-order',
  '/staff-side/orders_by_me.html': '/staff/orders-by-me',
  '/staff-side/all_orders.html': '/staff/all-orders',
};

function redirectTarget(pathname) {
  const normalized = pathname.replace(/\\/g, '/').toLowerCase();
  return LEGACY_PATH_MAP[normalized] || null;
}

export function LegacyRedirectRoute() {
  const location = useLocation();
  const target = redirectTarget(location.pathname);

  if (!target) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

export function legacyRoutePaths() {
  return Object.keys(LEGACY_PATH_MAP);
}
