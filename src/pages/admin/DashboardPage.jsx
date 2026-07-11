import { useCallback, useEffect, useState } from 'react';
import { OrdersBarChart, RevenueLineChart } from '../../components/admin/DashboardCharts';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDashboardStats } from '../../services/dashboard';
import '../../styles/admin-dashboard.css';

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatCard({ label, value, tone = 'default' }) {
  return (
    <div className={`dashboard-stat-card tone-${tone}`}>
      <div className="dashboard-stat-label">{label}</div>
      <div className="dashboard-stat-value">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchDashboardStats(user.id);
      setStats(next);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError(err?.message || 'Failed to load dashboard stats.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const trend = stats?.last7Days || [];

  return (
    <div className="dashboard-page" id="dashboardSection">
      {error ? <div className="dashboard-error">{error}</div> : null}

      {loading && !stats ? (
        <div className="dashboard-loading">Loading dashboard…</div>
      ) : (
        <>
          <section className="dashboard-section">
            <h2>All Time</h2>
            <div className="dashboard-grid">
              <StatCard label="Total Orders" value={formatCount(stats?.allTimeTotalOrders)} />
              <StatCard
                label="Total Completed Orders"
                value={formatCount(stats?.allTimeCompletedOrders)}
                tone="success"
              />
              <StatCard
                label="Total Cancelled Orders"
                value={formatCount(stats?.allTimeCancelledOrders)}
                tone="danger"
              />
              <StatCard
                label="Total Revenue (Completed Orders)"
                value={formatCurrency(stats?.allTimeRevenueCompleted)}
                tone="success"
              />
              <StatCard
                label="Total Revenue (Cancelled Orders)"
                value={formatCurrency(stats?.allTimeRevenueCancelled)}
                tone="danger"
              />
            </div>
          </section>

          <section className="dashboard-section">
            <h2>Today</h2>
            <div className="dashboard-grid">
              <StatCard label="Today's Orders" value={formatCount(stats?.todayOrders)} />
              <StatCard
                label="Today's Cancelled Orders"
                value={formatCount(stats?.todayCancelledOrders)}
                tone="danger"
              />
              <StatCard
                label="Today's Revenue (Completed Orders)"
                value={formatCurrency(stats?.todayRevenueCompleted)}
                tone="success"
              />
              <StatCard
                label="Today's Revenue (Cancelled Orders)"
                value={formatCurrency(stats?.todayRevenueCancelled)}
                tone="danger"
              />
            </div>
          </section>

          <section className="dashboard-section">
            <h2>Last 7 Days</h2>
            <div className="dashboard-charts">
              <div className="dashboard-chart-card">
                <h3>Orders</h3>
                <OrdersBarChart data={trend} />
              </div>
              <div className="dashboard-chart-card">
                <h3>Revenue (Completed Orders)</h3>
                <RevenueLineChart data={trend} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
