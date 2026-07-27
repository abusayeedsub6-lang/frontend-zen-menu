import { adminApiRequest, apiRequest } from '../lib/api';

export async function fetchMenuTheme(adminId) {
  if (!adminId) return null;

  const data = await apiRequest(`/restaurants/${encodeURIComponent(adminId)}/theme`);
  return data.theme ?? null;
}

/** Create default theme for a new admin, or backfill missing colors/names. */
export async function ensureDefaultMenuTheme(userId) {
  if (!userId) return null;

  const data = await adminApiRequest('/admin/theme/defaults', {
    method: 'POST',
  });
  return data.theme ?? null;
}

export async function fetchCategories(adminId) {
  if (!adminId) {
    throw new Error('admin_id is required to load categories');
  }

  const data = await apiRequest(`/restaurants/${encodeURIComponent(adminId)}/categories`);
  return data.categories ?? [];
}

export async function fetchDishes(adminId) {
  if (!adminId) {
    throw new Error('admin_id is required to load dishes');
  }

  const data = await apiRequest(`/restaurants/${encodeURIComponent(adminId)}/dishes`);
  return data.dishes ?? [];
}

export async function hasRestaurantOrders(adminId) {
  if (!adminId) return false;

  try {
    const data = await apiRequest(`/restaurants/${encodeURIComponent(adminId)}/has-orders`);
    return Boolean(data.hasOrders);
  } catch {
    return false;
  }
}
