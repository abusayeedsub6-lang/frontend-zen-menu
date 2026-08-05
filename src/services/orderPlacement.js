import { ApiError, apiRequest } from '../lib/api';

function isUnpaidOrder(order) {
  return (
    (order.payment_method === 'unpaid_new' || order.payment_method === 'unpaid_pay_at_counter') &&
    !order.cancelled
  );
}

function findExistingUnpaidOrder(adminId) {
  const localCustomerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  if (localCustomerOrders.length === 0) return null;

  const unpaidOrderForThisRestaurant = localCustomerOrders.find(
    (order) => isUnpaidOrder(order) && order.user_id === adminId,
  );

  if (!unpaidOrderForThisRestaurant) return null;

  const orderCreatedAt = new Date(unpaidOrderForThisRestaurant.created_at);
  const now = new Date();
  const minutesSinceOrder = (now - orderCreatedAt) / (1000 * 60);

  if (minutesSinceOrder <= 90) {
    return unpaidOrderForThisRestaurant;
  }

  return null;
}

function cartToItems(cart) {
  return Object.values(cart).map((item) => ({
    dish_id: item.dish_id || null,
    name: item.name || 'Unknown Item',
    price: item.price,
    qty: item.qty || 1,
  }));
}

function upsertLocalOrder(order) {
  if (!order?.id) return;

  const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  const index = customerOrders.findIndex((o) => o.id === order.id);
  if (index >= 0) {
    customerOrders[index] = {
      ...customerOrders[index],
      ...order,
      payment_completed: customerOrders[index].payment_completed,
    };
  } else {
    customerOrders.unshift({
      ...order,
      payment_completed: false,
    });
  }
  localStorage.setItem('customerOrders', JSON.stringify(customerOrders));
}

function markLocalOrderClosed(orderId) {
  if (!orderId) return;

  const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  const index = customerOrders.findIndex((order) => order.id === orderId);
  if (index < 0) return;

  customerOrders[index] = {
    ...customerOrders[index],
    cancelled: true,
  };
  localStorage.setItem('customerOrders', JSON.stringify(customerOrders));
}

function isMergeRejectedError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('not open for merging') ||
    message.includes('too old to merge') ||
    message.includes('existing order not found') ||
    message.includes('does not belong to this restaurant')
  );
}

async function postOrder({ adminId, tableNumber, existingOrderId, items }) {
  return apiRequest('/orders', {
    method: 'POST',
    body: {
      adminId,
      tableNumber: tableNumber || null,
      existingOrderId: existingOrderId || null,
      items,
    },
  });
}

export async function placeOrderFromCart(cart, adminId, tableNumber) {
  if (!adminId) {
    throw new Error('Restaurant information not found');
  }

  if (Object.keys(cart).length === 0) {
    throw new Error('Your kart is empty');
  }

  const items = cartToItems(cart);
  const existingUnpaidOrder = findExistingUnpaidOrder(adminId);
  const existingOrderId = existingUnpaidOrder?.id || null;

  let data;
  try {
    data = await postOrder({
      adminId,
      tableNumber,
      existingOrderId,
      items,
    });
  } catch (error) {
    // Stale local unpaid order (e.g. admin cancelled) — close it locally and place a new order.
    if (existingOrderId && error instanceof ApiError && isMergeRejectedError(error)) {
      markLocalOrderClosed(existingOrderId);
      data = await postOrder({
        adminId,
        tableNumber,
        existingOrderId: null,
        items,
      });
    } else {
      throw error;
    }
  }

  localStorage.setItem('hasOrders', 'true');
  if (data.order) {
    upsertLocalOrder(data.order);
  }

  return data.displayOrderNumber || String(data.orderNumber ?? '').padStart(2, '0');
}
