import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function StaffDashboard() {
  const { staffName, logout } = useStaffAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  usePageTitle('Staff Dashboard');

  const initial = staffName ? staffName.charAt(0).toUpperCase() : 'S';

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <header className="staff-header">
        <div className="header-content">
          <h1>Staff Dashboard</h1>
          <div className="staff-info">
            <div className="profile-container" ref={dropdownRef}>
              <button
                type="button"
                id="profileIcon"
                className="profile-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((open) => !open);
                }}
              >
                <span id="staffInitial">{initial}</span>
              </button>
              <div
                className="profile-dropdown"
                id="profileDropdown"
                style={{ display: dropdownOpen ? 'block' : 'none' }}
              >
                <div className="profile-dropdown-content">
                  <div className="profile-email" id="profileEmail">
                    {staffName}
                  </div>
                  <button type="button" className="profile-dropdown-item" id="logoutBtn" onClick={logout}>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-container">
        <div className="dashboard-grid">
          <div className="dashboard-card" id="placeOrderCard">
            <div className="card-icon">📝</div>
            <h2>Place Order</h2>
            <p>Create orders for customers</p>
            <Link to="/staff/place-order" className="card-action-btn">
              Start
            </Link>
          </div>

          <div className="dashboard-card" id="ordersByMeCard">
            <div className="card-icon">👤</div>
            <h2>Orders by Me</h2>
            <p>View orders you placed</p>
            <Link to="/staff/orders-by-me" className="card-action-btn">
              View
            </Link>
          </div>

          <div className="dashboard-card" id="allOrdersCard">
            <div className="card-icon">📋</div>
            <h2>All Orders</h2>
            <p>View all orders (last 48 hours)</p>
            <Link to="/staff/all-orders" className="card-action-btn">
              View
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
