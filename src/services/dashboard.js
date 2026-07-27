import { adminApiRequest } from '../lib/api';

function emptyStats() {
  return {
    allTimeTotalOrders: 0,
    allTimeCompletedOrders: 0,
    allTimeCancelledOrders: 0,
    allTimeRevenueCompleted: 0,
    allTimeRevenueCancelled: 0,
    todayOrders: 0,
    todayCancelledOrders: 0,
    todayRevenueCompleted: 0,
    todayRevenueCancelled: 0,
    last7Days: [],
  };
}

export async function fetchDashboardStats(userId) {
  if (!userId) return emptyStats();

  const data = await adminApiRequest('/admin/dashboard/stats');
  return data.stats || emptyStats();
}
