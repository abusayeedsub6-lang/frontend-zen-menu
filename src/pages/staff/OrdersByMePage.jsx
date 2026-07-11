import { useEffect, useRef } from 'react';
import { bootstrapOrdersByMe, teardownOrdersByMe } from '../../staff/legacy/ordersByMe';
import ordersByMeMarkup from './ordersByMeMarkup.html?raw';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function OrdersByMePage() {
  const mountedRef = useRef(false);

  usePageTitle('Orders by Me - Staff');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cancelled) return;
      await bootstrapOrdersByMe();
      mountedRef.current = true;
    }

    init();

    return () => {
      cancelled = true;
      if (mountedRef.current) {
        teardownOrdersByMe();
        mountedRef.current = false;
      }
    };
  }, []);

  return <div id="staffOrdersByMeRoot" dangerouslySetInnerHTML={{ __html: ordersByMeMarkup.trim() }} />;
}
