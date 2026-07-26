import { apiRequest } from '../lib/api';

export function mergeOrders(apiOrders, localStorageOrders) {
  if (!apiOrders || apiOrders.length === 0) {
    return localStorageOrders;
  }

  const apiMap = new Map();
  apiOrders.forEach((order) => {
    apiMap.set(order.id, order);
  });

  const merged = localStorageOrders.map((localOrder) => {
    const apiOrder = apiMap.get(localOrder.id);
    if (!apiOrder) return localOrder;

    const apiItemCount = (apiOrder.order_items && apiOrder.order_items.length) || 0;
    const localItemCount = (localOrder.order_items && localOrder.order_items.length) || 0;
    const orderItems =
      apiItemCount >= localItemCount && apiOrder.order_items && apiOrder.order_items.length > 0
        ? apiOrder.order_items
        : localOrder.order_items || [];
    const totalAmount =
      apiItemCount >= localItemCount &&
      apiOrder.total_amount != null &&
      apiOrder.total_amount !== ''
        ? apiOrder.total_amount
        : localOrder.total_amount != null && localOrder.total_amount !== ''
          ? localOrder.total_amount
          : apiOrder.total_amount;

    return {
      ...localOrder,
      ...apiOrder,
      payment_method: apiOrder.payment_method || localOrder.payment_method,
      payment_completed: localOrder.payment_completed,
      order_items: orderItems,
      total_amount: totalAmount,
    };
  });

  apiOrders.forEach((apiOrder) => {
    if (!localStorageOrders.find((lo) => lo.id === apiOrder.id)) {
      merged.push({
        ...apiOrder,
        payment_completed: false,
      });
    }
  });

  merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return merged;
}

export async function fetchCustomerOrders() {
  const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  if (customerOrders.length === 0) return null;

  const orderIds = customerOrders.map((order) => order.id).filter(Boolean);
  if (orderIds.length === 0) return null;

  const data = await apiRequest(`/orders?ids=${encodeURIComponent(orderIds.join(','))}`);
  return data.orders || [];
}

export async function cancelCustomerOrder(orderId) {
  await apiRequest(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'PATCH',
  });
}

export async function updateOrderPaymentMethod(orderId, paymentMethod) {
  await apiRequest(`/orders/${encodeURIComponent(orderId)}/payment`, {
    method: 'PATCH',
    body: { paymentMethod },
  });
  return true;
}

/** UI helper — backend enforces the same rules in orderRules.js */
export function isOrderCancellable(order) {
  if (order.cancelled === true) return false;

  if (
    order.payment_method &&
    (order.payment_method === 'upi' ||
      order.payment_method === 'cash' ||
      order.payment_method === 'card' ||
      order.payment_method === 'unpaid_pay_at_counter')
  ) {
    return false;
  }

  if (order.payment_completed === true) return false;

  if (order.created_at) {
    const orderDate = new Date(order.created_at);
    const now = new Date();
    const diffInMinutes = (now - orderDate) / (1000 * 60);
    if (diffInMinutes > 10) return false;
  }

  return true;
}

/** UI helper — backend enforces the same rules in orderRules.js */
export function canRemoveOrderItem(order, item = null) {
  if (!order || order.cancelled === true) return false;

  const isPaid =
    order.payment_method === 'upi' ||
    order.payment_method === 'cash' ||
    order.payment_method === 'card';

  if (isPaid) return false;

  const timestamp = item?.created_at || order.created_at;
  if (!timestamp) return false;

  const addedAt = new Date(timestamp);
  if (Number.isNaN(addedAt.getTime())) return false;

  const diffInMinutes = (Date.now() - addedAt.getTime()) / (1000 * 60);
  return diffInMinutes <= 7;
}

export async function removeCustomerOrderItem(orderId, itemId) {
  const data = await apiRequest(
    `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
  return data.newTotal;
}
