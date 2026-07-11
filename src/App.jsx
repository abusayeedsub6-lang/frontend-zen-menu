import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/admin/ProtectedRoute';
import { LegacyRedirectRoute, legacyRoutePaths } from './components/LegacyRedirects';
import PageLoader from './components/PageLoader';
import ProtectedStaffRoute from './components/staff/ProtectedStaffRoute';
import { AuthProvider } from './contexts/AuthContext';
import { StaffAuthProvider } from './contexts/StaffAuthContext';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const OrderSummaryPage = lazy(() => import('./pages/admin/OrderSummaryPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const ManageMenuPage = lazy(() => import('./pages/admin/ManageMenuPage'));
const MenuPage = lazy(() => import('./pages/user/MenuPage'));
const MyOrdersPage = lazy(() => import('./pages/user/MyOrdersPage'));
const StaffLayout = lazy(() => import('./pages/staff/StaffLayout'));
const StaffLoginPage = lazy(() => import('./pages/staff/StaffLoginPage'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const PlaceOrderPage = lazy(() => import('./pages/staff/PlaceOrderPage'));
const OrdersByMePage = lazy(() => import('./pages/staff/OrdersByMePage'));
const AllOrdersPage = lazy(() => import('./pages/staff/AllOrdersPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OrderSummaryPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="manage-menu" element={<ManageMenuPage />} />
            </Route>

            <Route path="/menu" element={<MenuPage />} />
            <Route path="/menu/:restaurantId" element={<MenuPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />

            {legacyRoutePaths().map((legacyPath) => (
              <Route key={legacyPath} path={legacyPath} element={<LegacyRedirectRoute />} />
            ))}

            <Route
              path="/staff"
              element={
                <StaffAuthProvider>
                  <StaffLayout />
                </StaffAuthProvider>
              }
            >
              <Route index element={<StaffLoginPage />} />
              <Route
                element={
                  <ProtectedStaffRoute>
                    <Outlet />
                  </ProtectedStaffRoute>
                }
              >
                <Route path="dashboard" element={<StaffDashboard />} />
                <Route path="place-order" element={<PlaceOrderPage />} />
                <Route path="orders-by-me" element={<OrdersByMePage />} />
                <Route path="all-orders" element={<AllOrdersPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
