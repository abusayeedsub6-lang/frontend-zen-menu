import { apiRequest } from '../lib/api';
import { getStaffToken } from './staffAuth';

function requireToken() {
  const token = getStaffToken();
  if (!token) {
    throw new Error('Staff session expired. Please log in again.');
  }
  return token;
}

export async function fetchStaffOrders({ hours = null } = {}) {
  const token = requireToken();
  const query = hours == null ? '' : `?hours=${encodeURIComponent(hours)}`;
  const data = await apiRequest(`/staff/orders${query}`, { token });
  return data.orders || [];
}

export async function fetchMyStaffOrders() {
  const token = requireToken();
  const data = await apiRequest('/staff/orders/mine', { token });
  return data.orders || [];
}

export async function fetchStaffOrderStatuses(orderIds) {
  const token = requireToken();
  const ids = (orderIds || []).filter(Boolean);
  if (ids.length === 0) return [];
  const data = await apiRequest(`/staff/orders/status?ids=${encodeURIComponent(ids.join(','))}`, {
    token,
  });
  return data.orders || [];
}

export async function placeStaffOrder({ items, tableNumber = null, existingOrderId = null }) {
  const token = requireToken();
  return apiRequest('/staff/orders', {
    method: 'POST',
    token,
    body: { items, tableNumber, existingOrderId },
  });
}

export async function cancelStaffOrder(orderId) {
  const token = requireToken();
  return apiRequest(`/staff/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'PATCH',
    token,
  });
}

export async function updateStaffOrderPayment(orderId, paymentMethod) {
  const token = requireToken();
  return apiRequest(`/staff/orders/${encodeURIComponent(orderId)}/payment`, {
    method: 'PATCH',
    token,
    body: { paymentMethod },
  });
}

export async function removeStaffOrderItem(orderId, itemId) {
  const token = requireToken();
  const data = await apiRequest(
    `/staff/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE', token },
  );
  return data.newTotal;
}
