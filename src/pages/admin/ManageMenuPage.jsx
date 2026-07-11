import { useEffect, useRef } from 'react';
import { bootstrapManageMenu, teardownManageMenu } from '../../admin/legacy/manageMenu';
import manageMenuMarkup from './manageMenuMarkup.html?raw';

export default function ManageMenuPage() {
  const mountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cancelled) return;
      await bootstrapManageMenu();
      mountedRef.current = true;
    }

    init();

    return () => {
      cancelled = true;
      if (mountedRef.current) {
        teardownManageMenu();
        mountedRef.current = false;
      }
    };
  }, []);

  return (
    <div id="manageMenuSection" style={{ display: 'block' }}>
      <div dangerouslySetInnerHTML={{ __html: manageMenuMarkup }} />
    </div>
  );
}
