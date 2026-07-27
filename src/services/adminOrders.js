import { adminApiRequest } from '../lib/api';

export async function fetchAdminOrders() {
  const data = await adminApiRequest('/admin/orders');
  return data.orders || [];
}

export async function cancelAdminOrder(orderId) {
  return adminApiRequest(`/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'PATCH',
  });
}

export async function updateAdminOrderPayment(orderId, paymentMethod) {
  return adminApiRequest(`/admin/orders/${encodeURIComponent(orderId)}/payment`, {
    method: 'PATCH',
    body: { paymentMethod },
  });
}

export async function removeAdminOrderItem(orderId, itemId) {
  const data = await adminApiRequest(
    `/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
  return data.newTotal;
}
