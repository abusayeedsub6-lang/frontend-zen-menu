import { apiRequest } from '../lib/api';

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

export async function placeOrderFromCart(cart, adminId, tableNumber) {
  if (!adminId) {
    throw new Error('Restaurant information not found');
  }

  if (Object.keys(cart).length === 0) {
    throw new Error('Your kart is empty');
  }

  const existingUnpaidOrder = findExistingUnpaidOrder(adminId);

  const data = await apiRequest('/orders', {
    method: 'POST',
    body: {
      adminId,
      tableNumber: tableNumber || null,
      existingOrderId: existingUnpaidOrder?.id || null,
      items: cartToItems(cart),
    },
  });

  localStorage.setItem('hasOrders', 'true');
  if (data.order) {
    upsertLocalOrder(data.order);
  }

  return data.displayOrderNumber || String(data.orderNumber ?? '').padStart(2, '0');
}
