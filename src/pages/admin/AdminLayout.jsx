import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { applyAdminHeaderTheme } from '../../utils/adminTheme';
import { ensureDefaultMenuTheme, fetchMenuTheme } from '../../services/menu';
import {
  DEFAULT_PRIMARY_COLOR,
  resolveThemeColor,
} from '../../utils/menuThemeDefaults';
import { usePageTitle } from '../../hooks/usePageTitle';
import '../../styles/admin.css';
import '../../styles/admin-embedded.css';

function ProfileDropdown({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const userEmail = user?.email || user?.user_metadata?.email || 'Admin';
  const firstLetter = userEmail.charAt(0).toUpperCase();
  const menuUrl = `${window.location.origin}/menu?admin_id=${user?.id || ''}`;
  const staffLoginUrl = `${window.location.origin}/staff`;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="profile-container" ref={dropdownRef}>
      <div
        className="profile-icon"
        id="profileIcon"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        {firstLetter}
      </div>
      <div className={`profile-dropdown${open ? ' show' : ''}`} id="profileDropdown">
        <div className="profile-email" id="profileEmail">
          {userEmail}
        </div>
        <div
          className="profile-dropdown-item menu-url"
          style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', cursor: 'pointer' }}
          onClick={() => {
            setOpen(false);
            window.open(menuUrl, '_blank');
          }}
        >
          My Menu
        </div>
        <div
          className="profile-dropdown-item staff-login-url"
          style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', cursor: 'pointer' }}
          onClick={() => {
            setOpen(false);
            window.open(staffLoginUrl, '_blank');
          }}
        >
          Staff Login
        </div>
        <div
          className="profile-dropdown-item"
          style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', cursor: 'pointer' }}
          onClick={() => {
            setOpen(false);
            navigate('/admin/manage-menu/category');
          }}
        >
          Manage Menu
        </div>
        <div className="profile-dropdown-item logout" id="logoutOption" onClick={onSignOut}>
          Logout
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const containerRef = useRef(null);
  const [overlayActive, setOverlayActive] = useState(false);
  const isManageMenu = location.pathname.startsWith('/admin/manage-menu');
  const isOrdersRoute = location.pathname === '/admin' || location.pathname === '/admin/';
  const isDashboardRoute = location.pathname.startsWith('/admin/dashboard');

  usePageTitle('Your Admin Panel');

  useEffect(() => {
    if (!user?.id) return undefined;

    let cancelled = false;

    async function loadAdminTheme() {
      try {
        await ensureDefaultMenuTheme(user.id);
        if (cancelled) return;

        const data = await fetchMenuTheme(user.id);
        if (cancelled || !data) return;
        applyAdminHeaderTheme(
          resolveThemeColor(data?.admin_side_color, data?.button_color, DEFAULT_PRIMARY_COLOR),
        );
      } catch {
        if (!cancelled) applyAdminHeaderTheme(DEFAULT_PRIMARY_COLOR);
      }
    }

    loadAdminTheme();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (window.location.hash === '#manage-menu') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      navigate('/admin/manage-menu/category', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    function setSidebarPosition() {
      const header = document.querySelector('header.admin-header');
      const sidebar = sidebarRef.current;
      if (header && sidebar) {
        const headerHeight = header.offsetHeight;
        sidebar.style.top = `${headerHeight}px`;
        sidebar.style.height = `calc(100vh - ${headerHeight}px)`;
      }
    }

    setSidebarPosition();
    window.addEventListener('resize', setSidebarPosition);
    return () => window.removeEventListener('resize', setSidebarPosition);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const container = containerRef.current;
    if (!sidebar || !container) return undefined;

    if (isManageMenu) {
      // Restore classes React may not re-apply after imperative classList edits on other routes
      sidebar.classList.add('collapsed');
      container.classList.add('full-width');
      return undefined;
    }

    if (window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
      container.classList.add('full-width');
    }

    function updateContainerWidth() {
      if (!sidebar || !container || isManageMenu) return;
      if (sidebar.classList.contains('collapsed')) {
        container.classList.add('full-width');
      } else {
        container.classList.remove('full-width');
      }
    }

    function handleDocumentClick(event) {
      if (window.innerWidth <= 768 || isManageMenu) return;
      if (!sidebar.contains(event.target) && !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
        updateContainerWidth();
      }
    }

    let hoverTimeout;
    function handleMouseEnter() {
      if (window.innerWidth <= 768) return;
      clearTimeout(hoverTimeout);
      if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        updateContainerWidth();
      }
    }

    function handleMouseLeave() {
      if (window.innerWidth <= 768) return;
      hoverTimeout = setTimeout(() => {
        if (!sidebar.matches(':hover')) {
          sidebar.classList.add('collapsed');
          updateContainerWidth();
        }
      }, 200);
    }

    document.addEventListener('click', handleDocumentClick);
    sidebar.addEventListener('mouseenter', handleMouseEnter);
    sidebar.addEventListener('mouseleave', handleMouseLeave);
    updateContainerWidth();

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      sidebar.removeEventListener('mouseenter', handleMouseEnter);
      sidebar.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(hoverTimeout);
    };
  }, [isManageMenu]);

  function handleOrdersTabClick() {
    navigate('/admin');
    if (window.innerWidth <= 768 && sidebarRef.current) {
      sidebarRef.current.classList.add('mobile-hidden');
      setOverlayActive(false);
    } else if (window.innerWidth > 768 && sidebarRef.current) {
      setTimeout(() => {
        if (!sidebarRef.current?.matches(':hover')) {
          sidebarRef.current?.classList.add('collapsed');
          containerRef.current?.classList.add('full-width');
        }
      }, 300);
    }
  }

  function handleDashboardTabClick() {
    navigate('/admin/dashboard');
    if (window.innerWidth <= 768 && sidebarRef.current) {
      sidebarRef.current.classList.add('mobile-hidden');
      setOverlayActive(false);
    } else if (window.innerWidth > 768 && sidebarRef.current) {
      setTimeout(() => {
        if (!sidebarRef.current?.matches(':hover')) {
          sidebarRef.current?.classList.add('collapsed');
          containerRef.current?.classList.add('full-width');
        }
      }, 300);
    }
  }

  function toggleMobileSidebar() {
    const manageMenuSidebar = document.querySelector('#manageMenuSection .layout .sidebar');
    if (isManageMenu && manageMenuSidebar) {
      manageMenuSidebar.classList.toggle('mobile-hidden');
      setOverlayActive(!manageMenuSidebar.classList.contains('mobile-hidden'));
      return;
    }

    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    sidebar.classList.toggle('mobile-hidden');
    setOverlayActive(!sidebar.classList.contains('mobile-hidden'));
  }

  function closeOverlay() {
    setOverlayActive(false);
    const manageMenuSidebar = document.querySelector('#manageMenuSection .layout .sidebar');
    if (isManageMenu && manageMenuSidebar) {
      manageMenuSidebar.classList.add('mobile-hidden');
      return;
    }
    if (sidebarRef.current) {
      sidebarRef.current.classList.add('mobile-hidden');
    }
    document.getElementById('profileDropdown')?.classList.remove('show');
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <button type="button" className="menu-toggle" id="menuToggle" aria-label="Toggle menu" onClick={toggleMobileSidebar}>
          ☰
        </button>
        Your Admin Panel
        <ProfileDropdown user={user} onSignOut={signOut} />
      </header>

      <div className={`overlay${overlayActive ? ' active' : ''}`} id="overlay" onClick={closeOverlay} />

      <div className="layout">
        <aside
          className="sidebar collapsed"
          id="sidebar"
          ref={sidebarRef}
          style={isManageMenu ? { display: 'none' } : undefined}
        >
          <nav>
            <ul className="side-list">
              <li>
                <button
                  type="button"
                  className={`sidebar-tab${isOrdersRoute ? ' active' : ''}`}
                  data-tab="orders"
                  title="Orders"
                  onClick={handleOrdersTabClick}
                >
                  <span className="sidebar-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM7 8h10v2H7V8zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                    </svg>
                  </span>
                  <span className="sidebar-text">Orders</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-tab${isDashboardRoute ? ' active' : ''}`}
                  data-tab="dashboard"
                  title="Dashboard"
                  onClick={handleDashboardTabClick}
                >
                  <span className="sidebar-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                    </svg>
                  </span>
                  <span className="sidebar-text">Dashboard</span>
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <div
          className={`container full-width${isManageMenu ? ' manage-menu-active' : ''}`}
          ref={containerRef}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
