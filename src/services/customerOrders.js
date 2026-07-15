import { supabase } from '../lib/supabase';

export function mergeOrders(supabaseOrders, localStorageOrders) {
  if (!supabaseOrders || supabaseOrders.length === 0) {
    return localStorageOrders;
  }

  const supabaseMap = new Map();
  supabaseOrders.forEach((order) => {
    supabaseMap.set(order.id, order);
  });

  const merged = localStorageOrders.map((localOrder) => {
    const supabaseOrder = supabaseMap.get(localOrder.id);
    if (!supabaseOrder) return localOrder;

    const supabaseItemCount = (supabaseOrder.order_items && supabaseOrder.order_items.length) || 0;
    const localItemCount = (localOrder.order_items && localOrder.order_items.length) || 0;
    const orderItems =
      supabaseItemCount >= localItemCount &&
      supabaseOrder.order_items &&
      supabaseOrder.order_items.length > 0
        ? supabaseOrder.order_items
        : localOrder.order_items || [];
    const totalAmount =
      supabaseItemCount >= localItemCount &&
      supabaseOrder.total_amount != null &&
      supabaseOrder.total_amount !== ''
        ? supabaseOrder.total_amount
        : localOrder.total_amount != null && localOrder.total_amount !== ''
          ? localOrder.total_amount
          : supabaseOrder.total_amount;

    return {
      ...localOrder,
      ...supabaseOrder,
      payment_method: supabaseOrder.payment_method || localOrder.payment_method,
      payment_completed: localOrder.payment_completed,
      order_items: orderItems,
      total_amount: totalAmount,
    };
  });

  supabaseOrders.forEach((supabaseOrder) => {
    if (!localStorageOrders.find((lo) => lo.id === supabaseOrder.id)) {
      merged.push({
        ...supabaseOrder,
        payment_completed: false,
      });
    }
  });

  merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return merged;
}

export async function fetchOrdersFromSupabase() {
  if (!supabase) return null;

  const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
  if (customerOrders.length === 0) return null;

  const orderIds = customerOrders.map((order) => order.id).filter(Boolean);
  if (orderIds.length === 0) return null;

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      user_id,
      order_number,
      total_amount,
      payment_method,
      created_at,
      cancelled,
      table_number,
      order_items (
        id,
        dish_id,
        dish_name,
        price,
        quantity,
        created_at
      )
    `)
    .in('id', orderIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders from Supabase:', error);
    return null;
  }

  if (orders && orders.length > 0) {
    const ids = orders.map((o) => o.id).filter(Boolean);
    if (ids.length > 0) {
      const { data: allItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, dish_id, dish_name, price, quantity, order_id, created_at')
        .in('order_id', ids);

      if (!itemsError && allItems) {
        const itemsByOrderId = new Map();
        allItems.forEach((item) => {
          if (!itemsByOrderId.has(item.order_id)) {
            itemsByOrderId.set(item.order_id, []);
          }
          itemsByOrderId.get(item.order_id).push(item);
        });

        orders.forEach((order) => {
          if (order.id && itemsByOrderId.has(order.id)) {
            order.order_items = itemsByOrderId.get(order.id);
          } else if (!order.order_items) {
            order.order_items = [];
          }
        });
      }
    }
  }

  return orders || [];
}

export async function cancelOrderInDatabase(orderId) {
  if (!supabase) {
    throw new Error('Supabase library not loaded');
  }

  let updateSucceeded = false;

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_order_cancelled', {
      p_order_id: orderId,
      p_cancelled: true,
    });

    if (!rpcError && (rpcData === true || rpcData === null)) {
      updateSucceeded = true;
    }
  } catch (rpcException) {
    console.warn('RPC cancel exception:', rpcException.message);
  }

  if (!updateSucceeded) {
    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({ cancelled: true })
      .eq('id', orderId)
      .select('id');

    if (updateError) {
      if (
        updateError.code === 'PGRST301' ||
        updateError.message?.includes('permission') ||
        updateError.message?.includes('policy')
      ) {
        throw new Error(
          'You do not have permission to cancel this order. This may be due to database security settings.',
        );
      }
      throw new Error('Could not cancel order in database. Please try again or contact support.');
    }

    updateSucceeded = Boolean(updateData && updateData.length > 0) || true;
  }

  if (!updateSucceeded) {
    throw new Error('Could not cancel order');
  }
}

export async function updateOrderPaymentMethod(orderId, paymentMethod) {
  if (!supabase) return false;

  let updateSucceeded = false;

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_order_payment_method', {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
    });

    if (!rpcError && rpcData === true) {
      updateSucceeded = true;
    }
  } catch (rpcErr) {
    console.warn('RPC update failed, trying direct update:', rpcErr);
  }

  if (!updateSucceeded) {
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_method: paymentMethod })
      .eq('id', orderId);

    if (!updateError) {
      updateSucceeded = true;
    }
  }

  return updateSucceeded;
}

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

export function canRemoveOrderItem(order, item = null) {
  if (!order || order.cancelled === true) return false;

  const isPaid =
    order.payment_method === 'upi' ||
    order.payment_method === 'cash' ||
    order.payment_method === 'card';

  if (isPaid) return false;

  // Use the item's own add time so freshly added items stay removable
  // even if the parent order is older than 7 minutes.
  const timestamp = item?.created_at || order.created_at;
  if (!timestamp) return false;

  const addedAt = new Date(timestamp);
  if (Number.isNaN(addedAt.getTime())) return false;

  const diffInMinutes = (Date.now() - addedAt.getTime()) / (1000 * 60);
  return diffInMinutes <= 7;
}

export async function removeOrderItemFromDatabase(orderId, itemId) {
  if (!supabase) {
    throw new Error('Supabase library not loaded');
  }

  const { data: itemRow, error: itemFetchError } = await supabase
    .from('order_items')
    .select('id, created_at, order_id')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .maybeSingle();

  if (itemFetchError) {
    throw itemFetchError;
  }
  if (!itemRow) {
    throw new Error('Order item not found');
  }

  const { data: orderRow, error: orderFetchError } = await supabase
    .from('orders')
    .select('id, payment_method, cancelled, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderFetchError) {
    throw orderFetchError;
  }
  if (!orderRow || !canRemoveOrderItem(orderRow, itemRow)) {
    throw new Error('This item can no longer be removed');
  }

  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId)
    .eq('order_id', orderId);

  if (deleteError) {
    throw deleteError;
  }

  const { data: remainingItems, error: itemsError } = await supabase
    .from('order_items')
    .select('price, quantity')
    .eq('order_id', orderId);

  if (itemsError) {
    throw itemsError;
  }

  const newTotal = (remainingItems || []).reduce((sum, item) => {
    return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1);
  }, 0);

  const { error: updateError } = await supabase
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', orderId);

  if (updateError) {
    throw updateError;
  }

  return newTotal;
}
