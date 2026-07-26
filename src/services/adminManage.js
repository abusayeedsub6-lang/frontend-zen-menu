import { adminApiRequest, ApiError } from '../lib/api';

export async function fetchAdminCategories() {
  const data = await adminApiRequest('/admin/categories');
  return data.categories || [];
}

export async function createAdminCategory(name) {
  const data = await adminApiRequest('/admin/categories', {
    method: 'POST',
    body: { name },
  });
  return data.category;
}

export async function updateAdminCategory(id, name) {
  const data = await adminApiRequest(`/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { name },
  });
  return data.category;
}

export async function deleteAdminCategory(id, { force = false } = {}) {
  try {
    await adminApiRequest(`/admin/categories/${encodeURIComponent(id)}?force=${force ? 'true' : 'false'}`, {
      method: 'DELETE',
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 409 || error.code === 'CATEGORY_IN_USE')) {
      const enriched = new Error(error.message);
      enriched.code = 'CATEGORY_IN_USE';
      throw enriched;
    }
    throw error;
  }
}

export async function reorderAdminCategories(orderedIds) {
  const data = await adminApiRequest('/admin/categories/order', {
    method: 'PUT',
    body: { orderedIds },
  });
  return data.categories || [];
}

export async function fetchAdminDishes() {
  const data = await adminApiRequest('/admin/dishes');
  return data.dishes || [];
}

export async function createAdminDish(payload) {
  const data = await adminApiRequest('/admin/dishes', { method: 'POST', body: payload });
  return data.dish;
}

export async function updateAdminDish(id, payload) {
  const data = await adminApiRequest(`/admin/dishes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
  return data.dish;
}

export async function deleteAdminDish(id) {
  await adminApiRequest(`/admin/dishes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchAdminTheme() {
  const data = await adminApiRequest('/admin/theme');
  return data.theme;
}

export async function saveAdminTheme(theme) {
  const data = await adminApiRequest('/admin/theme', { method: 'PUT', body: theme });
  return data.theme;
}

export async function fetchAdminStaff() {
  const data = await adminApiRequest('/admin/staff');
  return data.staff || [];
}

export async function createAdminStaffMember({ staffName, pin, phone = null }) {
  const data = await adminApiRequest('/admin/staff', {
    method: 'POST',
    body: { staffName, pin, phone },
  });
  return data.staff;
}

export async function deleteAdminStaffMember(id) {
  await adminApiRequest(`/admin/staff/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
