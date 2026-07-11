import { useEffect, useRef } from 'react';
import { bootstrapOrderSummary, teardownOrderSummary } from '../../admin/legacy/orderSummary';
import orderSummaryMarkup from './orderSummaryMarkup.html?raw';
import '../../styles/admin-order-summary.css';

export default function OrderSummaryPage() {
  const mountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cancelled) return;
      await bootstrapOrderSummary();
      mountedRef.current = true;
    }

    init();

    return () => {
      cancelled = true;
      if (mountedRef.current) {
        teardownOrderSummary();
        mountedRef.current = false;
      }
    };
  }, []);

  return (
    <div id="ordersSection" style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: orderSummaryMarkup }} />
  );
}
