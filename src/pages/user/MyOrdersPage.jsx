import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OrderCard from '../../components/user/OrderCard';
import { CancelOrderModal, GetBillModal, RemoveItemModal } from '../../components/user/OrderModals';
import { useRestaurantContext } from '../../hooks/useRestaurantContext';
import { useRestaurantTheme } from '../../hooks/useRestaurantTheme';
import { usePageTitle } from '../../hooks/usePageTitle';
import { startPolling } from '../../lib/polling';
import {
  cancelCustomerOrder,
  fetchCustomerOrders,
  mergeOrders,
  removeCustomerOrderItem,
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

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!adminId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    const localStorageOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');

    try {
      let allOrders = localStorageOrders;

      const apiOrders = await fetchCustomerOrders();
      if (apiOrders) {
        allOrders = mergeOrders(apiOrders, localStorageOrders);
        localStorage.setItem('customerOrders', JSON.stringify(allOrders));
      }

      const ordersToRender = allOrders.filter((order) => order && order.user_id === adminId);
      setOrders(ordersToRender);
    } catch (loadError) {
      console.error('Error syncing orders:', loadError);
      const ordersToRender = localStorageOrders.filter(
        (order) => order && order.user_id === adminId,
      );
      setOrders(ordersToRender);
      if (ordersToRender.length === 0) {
        setError('Error loading orders. Please refresh the page.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Phase 5: orders are not selectable by anon after RLS — poll the API instead of Realtime.
  useEffect(() => {
    if (!adminId || orders.length === 0) return undefined;
    return startPolling(() => loadOrders({ silent: true }), 8000);
  }, [adminId, orders.length, loadOrders]);

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
      await cancelCustomerOrder(pendingCancelOrderId);

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
      const newTotal = await removeCustomerOrderItem(orderId, itemId);

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
        <div className="header-content">
          <h1>My Orders</h1>
          <p>View your order history</p>
        </div>
        <Link to={menuPath} className="menu-btn" id="menuBtn" aria-label="Back to menu">
          <img src="/icons/back-exit.svg" alt="" className="menu-btn-icon" width="14" height="14" />
          <span className="menu-btn-label">Menu</span>
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
              No orders.
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
