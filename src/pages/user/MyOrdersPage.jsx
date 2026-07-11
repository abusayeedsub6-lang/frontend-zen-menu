import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OrderCard from '../../components/user/OrderCard';
import { CancelOrderModal, GetBillModal, RemoveItemModal } from '../../components/user/OrderModals';
import { useRestaurantContext } from '../../hooks/useRestaurantContext';
import { useRestaurantTheme } from '../../hooks/useRestaurantTheme';
import { usePageTitle } from '../../hooks/usePageTitle';
import { supabase } from '../../lib/supabase';
import {
  cancelOrderInDatabase,
  fetchOrdersFromSupabase,
  mergeOrders,
  removeOrderItemFromDatabase,
  updateOrderPaymentMethod,
} from '../../services/customerOrders';
import '../../styles/user.css';
import '../../styles/my-orders.css';

export default function MyOrdersPage() {
  const { adminId, tableNumber, menuPath } = useRestaurantContext();
  useRestaurantTheme(adminId, { applyHeader: false });
  usePageTitle('My Orders');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState(null);
  const [pendingBillOrderId, setPendingBillOrderId] = useState(null);
  const [pendingRemoveItem, setPendingRemoveItem] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!adminId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const localStorageOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');

    try {
      let allOrders = localStorageOrders;

      const supabaseOrders = await fetchOrdersFromSupabase();
      if (supabaseOrders) {
        allOrders = mergeOrders(supabaseOrders, localStorageOrders);
        localStorage.setItem('customerOrders', JSON.stringify(allOrders));
      }

      const ordersToRender = allOrders.filter((order) => order && order.user_id === adminId);
      setOrders(ordersToRender);
    } catch (loadError) {
      console.error('Error syncing with Supabase:', loadError);
      const ordersToRender = localStorageOrders.filter(
        (order) => order && order.user_id === adminId,
      );
      setOrders(ordersToRender);
      if (ordersToRender.length === 0) {
        setError('Error loading orders. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!supabase) return undefined;

    const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
    if (customerOrders.length === 0) return undefined;

    const channel = supabase
      .channel('customer_orders_channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const orderId = payload.new.id;
          const storedOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
          const hasOrder = storedOrders.some((order) => order.id === orderId);
          if (hasOrder) loadOrders();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const orderId = payload.new.id;
          const storedOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
          const hasOrder = storedOrders.some((order) => order.id === orderId);
          if (hasOrder) loadOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function handleConfirmCancel() {
    if (!pendingCancelOrderId) return;

    const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
    const order = customerOrders.find((o) => o.id === pendingCancelOrderId);
    if (order?.cancelled === true) {
      setPendingCancelOrderId(null);
      return;
    }

    setIsCancelling(true);
    try {
      await cancelOrderInDatabase(pendingCancelOrderId);

      const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
      const updatedOrders = customerOrders.map((order) =>
        order.id === pendingCancelOrderId ? { ...order, cancelled: true } : order,
      );
      localStorage.setItem('customerOrders', JSON.stringify(updatedOrders));
      await loadOrders();
    } catch (cancelError) {
      console.error('Error cancelling order:', cancelError);
      alert('Error: Could not cancel order. Please try again.');
    } finally {
      setIsCancelling(false);
      setPendingCancelOrderId(null);
    }
  }

  async function handleConfirmGetBill() {
    if (!pendingBillOrderId) return;

    const orderId = pendingBillOrderId;
    setPendingBillOrderId(null);

    try {
      const paymentMethod = 'unpaid_pay_at_counter';
      await updateOrderPaymentMethod(orderId, paymentMethod);

      const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
      const orderIndex = customerOrders.findIndex((order) => order.id === orderId);
      if (orderIndex !== -1) {
        customerOrders[orderIndex].payment_method = paymentMethod;
        customerOrders[orderIndex].payment_completed = false;
        localStorage.setItem('customerOrders', JSON.stringify(customerOrders));
      }

      await loadOrders();
    } catch (billError) {
      console.error('Error updating order payment method:', billError);
      alert('Error updating order. Please try again.');
    }
  }

  async function handleConfirmRemoveItem() {
    if (!pendingRemoveItem?.orderId || !pendingRemoveItem?.itemId) return;

    const { orderId, itemId } = pendingRemoveItem;
    setIsRemovingItem(true);

    try {
      const newTotal = await removeOrderItemFromDatabase(orderId, itemId);

      const customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
      const updatedOrders = customerOrders.map((order) => {
        if (order.id !== orderId) return order;
        const nextItems = (order.order_items || []).filter(
          (item) => String(item.id) !== String(itemId),
        );
        return {
          ...order,
          order_items: nextItems,
          total_amount: newTotal,
        };
      });
      localStorage.setItem('customerOrders', JSON.stringify(updatedOrders));
      await loadOrders();
      setPendingRemoveItem(null);
    } catch (removeError) {
      console.error('Error removing item:', removeError);
      alert('Error removing item. Please try again.');
    } finally {
      setIsRemovingItem(false);
    }
  }

  return (
    <>
      <header>
        <h1>My Orders</h1>
        <p>View your order history</p>
        <Link to={menuPath} className="menu-btn" id="menuBtn">
          Menu
        </Link>
      </header>

      <div className="orders-container">
        <div className="orders-grid" id="ordersGrid">
          {!adminId ? (
            <div className="empty-state">
              Open a restaurant&apos;s menu and tap Orders to see your orders for that restaurant.
            </div>
          ) : loading ? (
            <div className="loading-state">Loading orders...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              No orders yet for this restaurant. Your orders here will appear after you place them from
              this menu.
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                sessionTableNumber={tableNumber}
                onCancel={setPendingCancelOrderId}
                onGetBill={setPendingBillOrderId}
                onRemoveItem={setPendingRemoveItem}
              />
            ))
          )}
        </div>
      </div>

      <CancelOrderModal
        isOpen={Boolean(pendingCancelOrderId)}
        isProcessing={isCancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setPendingCancelOrderId(null)}
      />

      <RemoveItemModal
        isOpen={Boolean(pendingRemoveItem)}
        dishName={pendingRemoveItem?.dishName}
        isProcessing={isRemovingItem}
        onConfirm={handleConfirmRemoveItem}
        onCancel={() => setPendingRemoveItem(null)}
      />

      <GetBillModal
        isOpen={Boolean(pendingBillOrderId)}
        onConfirm={handleConfirmGetBill}
        onCancel={() => setPendingBillOrderId(null)}
      />
    </>
  );
}
