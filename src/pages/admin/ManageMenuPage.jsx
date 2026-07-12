import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  activateManageMenuTab,
  bootstrapManageMenu,
  isManageMenuTab,
  teardownManageMenu,
} from '../../admin/legacy/manageMenu';
import manageMenuMarkup from './manageMenuMarkup.html?raw';

function tabFromPathname(pathname) {
  const segment = pathname.split('/').filter(Boolean).pop();
  return isManageMenuTab(segment) ? segment : 'category';
}

export default function ManageMenuPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const hostRef = useRef(null);
  const mountedRef = useRef(false);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    window.__manageMenuNavigate = (nextTab) => {
      navigate(`/admin/manage-menu/${nextTab}`);
    };
    return () => {
      delete window.__manageMenuNavigate;
    };
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    const initialTab = tabFromPathname(window.location.pathname);

    async function init() {
      if (!hostRef.current) return;
      hostRef.current.innerHTML = manageMenuMarkup;

      await bootstrapManageMenu(initialTab);
      if (cancelled) return;

      bootstrappedRef.current = true;
      mountedRef.current = true;
      // Re-apply current URL tab (handles Strict Mode remount / late param)
      activateManageMenuTab(tabFromPathname(window.location.pathname));
    }

    init();

    return () => {
      cancelled = true;
      teardownManageMenu();
      mountedRef.current = false;
      bootstrappedRef.current = false;
      if (hostRef.current) {
        hostRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    if (!isManageMenuTab(tab)) {
      navigate('/admin/manage-menu/category', { replace: true });
      return;
    }
    activateManageMenuTab(tab);
  }, [tab, navigate]);

  if (tab && !isManageMenuTab(tab)) {
    return <Navigate to="/admin/manage-menu/category" replace />;
  }

  return (
    <div id="manageMenuSection" style={{ display: 'block' }}>
      <div ref={hostRef} />
    </div>
  );
}
