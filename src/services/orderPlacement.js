import { supabase } from '../lib/supabase';
import { parsePrice } from '../utils/restaurant';

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

async function mergeItemsIntoExistingOrder(
  existingOrder,
  cart,
  newItemsTotal,
  tableNumber,
  adminId,
) {
  const orderId = existingOrder.id;
  const existingOrderNumber = existingOrder.order_number;
  const existingTotal = parseFloat(existingOrder.total_amount || 0) || 0;

  if (tableNumber) {
    const { error: rpcErr } = await supabase.rpc('update_order_table_number', {
      p_order_id: orderId,
      p_table_number: String(tableNumber),
    });
    if (rpcErr) {
      const { error: updateErr } = await supabase
        .from('orders')
        .update({ table_number: String(tableNumber) })
        .eq('id', orderId);
      if (updateErr) console.warn('Could not set table_number on order:', updateErr.message);
    }
  }

  let existingItems = [];
  const { data: dbItems, error: fetchItemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (!fetchItemsError && dbItems) {
    existingItems = dbItems;
  } else if (existingOrder.order_items && Array.isArray(existingOrder.order_items)) {
    existingItems = existingOrder.order_items;
  }

  const newOrderItems = Object.values(cart).map((item) => {
    const price = parsePrice(item.price);
    return {
      order_id: orderId,
      dish_id: item.dish_id || null,
      dish_name: item.name || 'Unknown Item',
      price: parseFloat(price).toFixed(2),
      quantity: parseInt(item.qty, 10) || 1,
    };
  });

  const insertPromises = newOrderItems.map((item) =>
    supabase.rpc('insert_order_item', {
      p_order_id: orderId,
      p_dish_id: item.dish_id,
      p_dish_name: item.dish_name,
      p_price: item.price,
      p_quantity: item.quantity,
    }),
  );

  const itemsResults = await Promise.all(insertPromises);
  const insertItemsError = itemsResults.find((result) => result.error)?.error;
  if (insertItemsError) {
    console.error('Error inserting merged order items:', insertItemsError);
  }

  const updatedTotal = existingTotal + parseFloat(newItemsTotal);
  const { error: updateOrderError } = await supabase
    .from('orders')
    .update({ total_amount: updatedTotal.toFixed(2) })
    .eq('id', orderId);

  if (updateOrderError) {
    console.warn('Could not update order total:', updateOrderError.message);
  }

  // Prefer DB rows so newly added items have real ids + created_at for the 7-min remove window
  let refreshedItems = null;
  const { data: dbRefreshedItems, error: refreshError } = await supabase
    .from('order_items')
    .select('id, dish_id, dish_name, price, quantity, created_at')
    .eq('order_id', orderId);

  if (!refreshError && dbRefreshedItems) {
    refreshedItems = dbRefreshedItems;
  }

  let customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  const orderIndex = customerOrders.findIndex((o) => o.id === orderId);
  const addedAt = new Date().toISOString();
  const fallbackNewItems = newOrderItems.map((item, index) => ({
    id: `${orderId}_item_${Date.now()}_${index}`,
    dish_id: item.dish_id,
    dish_name: item.dish_name,
    price: item.price,
    quantity: parseInt(item.quantity, 10) || 1,
    created_at: addedAt,
  }));

  if (orderIndex >= 0) {
    const existingOrderData = customerOrders[orderIndex];
    const existingLocalItems = existingOrderData.order_items || [];
    customerOrders[orderIndex] = {
      ...existingOrderData,
      total_amount: updatedTotal.toFixed(2),
      order_items: refreshedItems || [...existingLocalItems, ...fallbackNewItems],
      table_number: tableNumber || existingOrderData.table_number || null,
    };
  } else {
    customerOrders.unshift({
      id: orderId,
      user_id: existingOrder.user_id || adminId || null,
      order_number: existingOrderNumber,
      total_amount: updatedTotal.toFixed(2),
      payment_method: existingOrder.payment_method || 'unpaid',
      created_at: existingOrder.created_at || new Date().toISOString(),
      table_number: tableNumber || null,
      order_items:
        refreshedItems ||
        newOrderItems.map((item, index) => ({
          id: `${orderId}_item_${index}`,
          dish_id: item.dish_id,
          dish_name: item.dish_name,
          price: item.price,
          quantity: parseInt(item.quantity, 10) || 1,
          created_at: addedAt,
        })),
    });
  }

  localStorage.setItem('customerOrders', JSON.stringify(customerOrders));
  return String(existingOrderNumber).padStart(2, '0');
}

export async function placeOrderFromCart(cart, adminId, tableNumber) {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  if (!adminId) {
    throw new Error('Restaurant information not found');
  }

  if (Object.keys(cart).length === 0) {
    throw new Error('Your kart is empty');
  }

  let subtotal = 0;
  Object.values(cart).forEach((item) => {
    subtotal += parsePrice(item.price) * (item.qty || 1);
  });
  const total = subtotal;
  const paymentMethod = 'unpaid_new';

  const existingUnpaidOrder = findExistingUnpaidOrder(adminId);
  if (existingUnpaidOrder) {
    return mergeItemsIntoExistingOrder(existingUnpaidOrder, cart, total, tableNumber, adminId);
  }

  let nextOrderNumber = 1;
  const { data: maxOrderData, error: maxOrderError } = await supabase
    .from('orders')
    .select('order_number')
    .eq('user_id', adminId)
    .not('order_number', 'is', null)
    .order('order_number', { ascending: false })
    .limit(1);

  if (!maxOrderError && maxOrderData && maxOrderData.length > 0) {
    const maxOrderNum = maxOrderData[0].order_number;
    if (typeof maxOrderNum === 'number') {
      nextOrderNumber = maxOrderNum + 1;
    } else if (typeof maxOrderNum === 'string') {
      const numMatch = maxOrderNum.match(/\d+/);
      if (numMatch) {
        const numPart = parseInt(numMatch[0], 10);
        nextOrderNumber = numPart >= 1000 ? numPart - 1000 + 1 : numPart + 1;
      }
    }
  }

  let orderId = null;
  const { data: rpcResult, error: orderErrorWithNum } = await supabase.rpc('insert_order', {
    p_user_id: adminId,
    p_total_amount: parseFloat(total).toFixed(2),
    p_payment_method: paymentMethod,
    p_order_number: nextOrderNumber,
  });

  if (!orderErrorWithNum && rpcResult) {
    if (typeof rpcResult === 'object' && rpcResult.order_id) {
      orderId = rpcResult.order_id;
      nextOrderNumber = rpcResult.order_number;
    } else if (typeof rpcResult === 'string') {
      orderId = rpcResult;
    } else {
      orderId = rpcResult;
    }
  } else {
    const { data: orderIdResult, error: orderError } = await supabase.rpc('insert_order', {
      p_user_id: adminId,
      p_total_amount: parseFloat(total).toFixed(2),
      p_payment_method: paymentMethod,
    });

    if (orderError || !orderIdResult) {
      throw new Error(orderError?.message || 'Error saving order');
    }

    if (typeof orderIdResult === 'object' && orderIdResult.order_id) {
      orderId = orderIdResult.order_id;
      nextOrderNumber = orderIdResult.order_number;
    } else if (typeof orderIdResult === 'string') {
      orderId = orderIdResult;
    } else {
      throw new Error('Unexpected RPC return format');
    }
  }

  const orderItems = Object.values(cart).map((item) => {
    const price = parsePrice(item.price);
    return {
      order_id: orderId,
      dish_id: item.dish_id || null,
      dish_name: item.name || 'Unknown Item',
      price: parseFloat(price).toFixed(2),
      quantity: parseInt(item.qty, 10) || 1,
    };
  });

  const insertPromises = orderItems.map((item) =>
    supabase.rpc('insert_order_item', {
      p_order_id: orderId,
      p_dish_id: item.dish_id,
      p_dish_name: item.dish_name,
      p_price: item.price,
      p_quantity: item.quantity,
    }),
  );

  const itemsResults = await Promise.all(insertPromises);
  const itemsError = itemsResults.find((result) => result.error)?.error;
  if (itemsError) {
    throw new Error(itemsError.message || 'Error saving order items');
  }

  if (tableNumber) {
    const { error: rpcErr } = await supabase.rpc('update_order_table_number', {
      p_order_id: orderId,
      p_table_number: String(tableNumber),
    });
    if (rpcErr) {
      const { error: updateErr } = await supabase
        .from('orders')
        .update({ table_number: String(tableNumber) })
        .eq('id', orderId);
      if (updateErr) console.warn('Could not set table_number on order:', updateErr.message);
    }
  }

  const displayOrderNumber = String(nextOrderNumber).padStart(2, '0');
  localStorage.setItem('hasOrders', 'true');

  const orderData = {
    id: orderId,
    user_id: adminId,
    order_number: nextOrderNumber,
    total_amount: parseFloat(total).toFixed(2),
    payment_method: paymentMethod,
    created_at: new Date().toISOString(),
    table_number: tableNumber || null,
    order_items: orderItems.map((item, index) => ({
      id: `${orderId}_item_${index}`,
      dish_id: item.dish_id,
      dish_name: item.dish_name,
      price: item.price,
      quantity: parseInt(item.quantity, 10) || 1,
      created_at: new Date().toISOString(),
    })),
  };

  const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  customerOrders.unshift(orderData);
  localStorage.setItem('customerOrders', JSON.stringify(customerOrders));

  return displayOrderNumber;
}
