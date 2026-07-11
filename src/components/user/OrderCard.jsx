import {
  formatDateTime,
  formatOrderNumber,
  formatPaymentMethod,
} from '../../utils/format';
import { canRemoveOrderItem, isOrderCancellable } from '../../services/customerOrders';

export default function OrderCard({ order, sessionTableNumber, onCancel, onGetBill, onRemoveItem }) {
  const orderDisplayText = formatOrderNumber(order.order_number);
  const dateTime = formatDateTime(order.created_at);
  const orderItems = order.order_items || [];
  const isCancelled = order.cancelled === true;
  const cardClass = isCancelled ? 'order-card cancelled' : 'order-card';
  const orderIdClass = isCancelled ? 'order-id cancelled' : 'order-id';
  const canCancel = isOrderCancellable(order);
  const canRemoveItems = canRemoveOrderItem(order);

  const isPaid =
    order.payment_method &&
    order.payment_method !== 'unpaid_new' &&
    order.payment_method !== 'unpaid_pay_at_counter' &&
    (order.payment_method === 'upi' ||
      order.payment_method === 'cash' ||
      order.payment_method === 'card');

  const isPayAtCounter = order.payment_method === 'unpaid_pay_at_counter' && !isCancelled;
  const shouldShowTotal = isPaid && !isCancelled;

  const tableNumberDisplay =
    (order.table_number != null && order.table_number !== '' ? String(order.table_number) : '') ||
    (sessionTableNumber != null && sessionTableNumber !== '' ? String(sessionTableNumber) : '');

  let rightContent = null;
  if (isCancelled) {
    rightContent = <span className="payment-badge cancelled">Cancelled</span>;
  } else if (isPaid && order.payment_method) {
    rightContent = (
      <span className="payment-badge paid">{formatPaymentMethod(order.payment_method)}</span>
    );
  } else if (isPayAtCounter) {
    rightContent = <span className="payment-badge unpaid">Please wait...</span>;
  } else {
    rightContent = (
      <button type="button" className="get-bill-btn" onClick={() => onGetBill(order.id)}>
        Get Bill
      </button>
    );
  }

  return (
    <div className={cardClass} data-order-id={order.id} data-order-number={order.order_number || ''}>
      <div className="order-header">
        <div className="order-header-left">
          <div className={orderIdClass}>
            ORD <span className="order-number">#{orderDisplayText}</span>
          </div>
          <div className="order-table-line">Table: {tableNumberDisplay}</div>
        </div>
        <div className="order-header-right">
          {rightContent}
          {canCancel ? (
            <button
              type="button"
              className="cancel-order-btn"
              onClick={() => onCancel(order.id)}
              title="Cancel order"
              aria-label="Cancel order"
            />
          ) : null}
        </div>
      </div>
      <div className="order-date">{dateTime}</div>
      <div className="order-items">
        {orderItems.length === 0 ? (
          <div className="order-item">
            <div className="order-item-serial" />
            <div className="order-item-info">
              <strong>No items found</strong>
            </div>
          </div>
        ) : (
          orderItems.map((item, index) => {
            const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1);
            const itemPrice = parseFloat(item.price || 0).toFixed(2);
            return (
              <div key={item.id || `${order.id}-${index}`} className="order-item">
                <div className="order-item-serial">{index + 1}.</div>
                <div className="order-item-info">
                  <strong>{item.dish_name || 'Unknown Item'}</strong>
                  <span>
                    {itemPrice} x {item.quantity || 1}
                  </span>
                </div>
                <div className="order-item-price">{itemTotal.toFixed(2)}</div>
                {canRemoveItems && item.id ? (
                  <button
                    type="button"
                    className="remove-item-btn"
                    title="Remove item"
                    aria-label={`Remove ${item.dish_name || 'item'}`}
                    onClick={() =>
                      onRemoveItem({
                        orderId: order.id,
                        itemId: item.id,
                        dishName: item.dish_name || 'this dish',
                      })
                    }
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {shouldShowTotal ? (
        <div className="order-total">
          <span className="total-label">Total</span>
          <span className="total-amount">{parseFloat(order.total_amount || 0).toFixed(2)}</span>
        </div>
      ) : null}
    </div>
  );
}
