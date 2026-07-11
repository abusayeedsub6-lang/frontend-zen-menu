import { useEffect, useRef } from 'react';
import { bootstrapPlaceOrder, teardownPlaceOrder } from '../../staff/legacy/placeOrder';
import placeOrderMarkup from './placeOrderMarkup.html?raw';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function PlaceOrderPage() {
  const mountedRef = useRef(false);

  usePageTitle('Place Order - Staff');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cancelled) return;
      await bootstrapPlaceOrder();
      mountedRef.current = true;
    }

    init();

    return () => {
      cancelled = true;
      if (mountedRef.current) {
        teardownPlaceOrder();
        mountedRef.current = false;
      }
    };
  }, []);

  return <div id="staffPlaceOrderRoot" dangerouslySetInnerHTML={{ __html: placeOrderMarkup.trim() }} />;
}
