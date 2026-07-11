import { useEffect, useRef } from 'react';
import { bootstrapAllOrders, teardownAllOrders } from '../../staff/legacy/allOrders';
import allOrdersMarkup from './allOrdersMarkup.html?raw';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function AllOrdersPage() {
  const mountedRef = useRef(false);

  usePageTitle('All Orders - Staff');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cancelled) return;
      await bootstrapAllOrders();
      mountedRef.current = true;
    }

    init();

    return () => {
      cancelled = true;
      if (mountedRef.current) {
        teardownAllOrders();
        mountedRef.current = false;
      }
    };
  }, []);

  return <div id="staffAllOrdersRoot" dangerouslySetInnerHTML={{ __html: allOrdersMarkup.trim() }} />;
}
