import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearCart, loadCart, parsePrice, saveCart } from '../utils/restaurant';
import { placeOrderFromCart } from '../services/orderPlacement';

const CartContext = createContext(null);

export function CartProvider({ adminId, children }) {
  const [cart, setCartState] = useState(() => loadCart(adminId));
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => {
    setCartState(loadCart(adminId));
  }, [adminId]);

  const setCart = useCallback(
    (nextCart) => {
      const updated = typeof nextCart === 'function' ? nextCart(loadCart(adminId)) : nextCart;
      saveCart(adminId, updated);
      setCartState(updated);
    },
    [adminId],
  );

  const addToCart = useCallback(
    (dishName, price, image, dishId) => {
      setCart((current) => {
        const next = { ...current };
        if (next[dishName]) {
          next[dishName] = { ...next[dishName], qty: next[dishName].qty + 1 };
        } else {
          next[dishName] = {
            name: dishName,
            price,
            qty: 1,
            image,
            dish_id: dishId,
          };
        }
        return next;
      });
    },
    [setCart],
  );

  const changeQty = useCallback(
    (dishName, delta) => {
      setCart((current) => {
        const next = { ...current };
        if (!next[dishName]) return current;
        next[dishName] = { ...next[dishName], qty: next[dishName].qty + delta };
        if (next[dishName].qty <= 0) {
          delete next[dishName];
        }
        return next;
      });
    },
    [setCart],
  );

  const itemCount = useMemo(() => Object.keys(cart).length, [cart]);

  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => {
      return sum + parsePrice(item.price) * (item.qty || 1);
    }, 0);
  }, [cart]);

  const placeOrder = useCallback(
    async (tableNumber) => {
      if (Object.keys(cart).length === 0) {
        throw new Error('Your kart is empty');
      }

      setIsPlacingOrder(true);
      try {
        await placeOrderFromCart(cart, adminId, tableNumber);
        clearCart(adminId);
        setCartState({});
        localStorage.setItem('hasOrders', 'true');
      } finally {
        setIsPlacingOrder(false);
      }
    },
    [adminId, cart],
  );

  const value = useMemo(
    () => ({
      cart,
      addToCart,
      changeQty,
      itemCount,
      cartTotal,
      placeOrder,
      isPlacingOrder,
    }),
    [cart, addToCart, changeQty, itemCount, cartTotal, placeOrder, isPlacingOrder],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
