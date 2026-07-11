export function resolveAdminId(searchParams, routeRestaurantId) {
  const adminId = searchParams.get('admin_id') || routeRestaurantId || null;

  if (adminId) {
    localStorage.setItem('admin_id', adminId);
    return adminId;
  }

  return localStorage.getItem('admin_id') || null;
}

export function resolveTableNumber(searchParams, adminId) {
  const tableFromUrl = searchParams.get('table_number');

  if (tableFromUrl !== null && tableFromUrl !== undefined && tableFromUrl !== '') {
    const key = adminId ? `table_number_${adminId}` : 'table_number';
    localStorage.setItem(key, tableFromUrl);
    return tableFromUrl;
  }

  if (adminId) {
    return localStorage.getItem(`table_number_${adminId}`) || null;
  }

  return localStorage.getItem('table_number') || null;
}

export function buildRestaurantQuery(adminId, tableNumber) {
  const params = new URLSearchParams();
  if (adminId) params.set('admin_id', adminId);
  if (tableNumber) params.set('table_number', tableNumber);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getCartKey(adminId) {
  return adminId ? `cart_${adminId}` : 'cart';
}

export function loadCart(adminId) {
  const cartKey = getCartKey(adminId);
  return JSON.parse(localStorage.getItem(cartKey) || '{}');
}

export function saveCart(adminId, cart) {
  const cartKey = getCartKey(adminId);
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

export function clearCart(adminId) {
  const cartKey = getCartKey(adminId);
  localStorage.removeItem(cartKey);
}

export function parsePrice(price) {
  return parseFloat(String(price).replace(/[₹$,]/g, '').trim()) || 0;
}

export const FALLBACK_DISH_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='Arial' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
