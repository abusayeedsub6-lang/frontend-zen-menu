import { parsePrice } from '../../utils/restaurant';

export default function CartModal({
  isOpen,
  cart,
  isPlacingOrder,
  onClose,
  onAdd,
  onChangeQty,
  onPlaceOrder,
}) {
  if (!isOpen) return null;

  const cartItems = Object.values(cart);
  const itemCount = cartItems.length;

  return (
    <div
      className="modal-overlay"
      id="cartModal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content cart-modal">
        <div className="cart-modal-header">
          <h3>Cart</h3>
          <button type="button" className="close-modal-btn" id="closeCartModal" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="cart-modal-body">
          <div className="cart-items" id="modalCartItems">
            {itemCount === 0 ? (
              <p className="empty-cart">Cart is empty</p>
            ) : (
              cartItems.map((item, index) => {
                const price = parsePrice(item.price);
                const serialNumber = index + 1;

                return (
                  <div key={item.name} className="cart-item">
                    <div className="cart-item-info">
                      <strong>
                        {serialNumber}. {item.name}
                      </strong>
                      <span>
                        {price.toFixed(2)} × {item.qty}
                      </span>
                    </div>
                    <div className="cart-item-actions">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => onChangeQty(item.name, -1)}
                      >
                        −
                      </button>
                      <span className="qty-display">{item.qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => onAdd(item.name, price, item.image, item.dish_id)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="cart-footer">
            <button
              type="button"
              className="place-order-btn"
              id="modalPlaceOrderBtn"
              disabled={itemCount === 0 || isPlacingOrder}
              onClick={onPlaceOrder}
            >
              {isPlacingOrder ? 'Placing...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
