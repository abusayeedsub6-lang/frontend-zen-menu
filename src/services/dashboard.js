import { supabase } from '../lib/supabase';

const PAID_METHODS = new Set(['cash', 'upi', 'card']);
const TREND_DAYS = 7;

function parsePrice(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function getOrderTotal(order) {
  const items = order.order_items || [];
  if (items.length > 0) {
    return items.reduce(
      (sum, item) => sum + parsePrice(item.price) * (parseInt(item.quantity, 10) || 1),
      0,
    );
  }
  return parsePrice(order.total_amount);
}

function isCancelled(order) {
  return order.cancelled === true;
}

function isCompleted(order) {
  return !isCancelled(order) && PAID_METHODS.has(order.payment_method);
}

function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isToday(isoDate) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const start = startOfTodayLocal();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
}

function toDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

function buildEmptyTrend() {
  const today = startOfTodayLocal();
  const days = [];
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push({
      key: toDayKey(date),
      label: formatDayLabel(date),
      orders: 0,
      revenue: 0,
    });
  }
  return days;
}

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
    last7Days: buildEmptyTrend(),
  };
}

export async function fetchDashboardStats(userId) {
  if (!supabase || !userId) {
    return emptyStats();
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      total_amount,
      payment_method,
      cancelled,
      created_at,
      order_items (
        price,
        quantity
      )
    `,
    )
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const stats = emptyStats();
  const list = orders || [];
  const trendByKey = new Map(stats.last7Days.map((day) => [day.key, day]));
  const trendStart = new Date(startOfTodayLocal());
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  for (const order of list) {
    const total = getOrderTotal(order);
    const cancelled = isCancelled(order);
    const completed = isCompleted(order);
    const today = isToday(order.created_at);

    stats.allTimeTotalOrders += 1;

    if (completed) {
      stats.allTimeCompletedOrders += 1;
      stats.allTimeRevenueCompleted += total;
    }

    if (cancelled) {
      stats.allTimeCancelledOrders += 1;
      stats.allTimeRevenueCancelled += total;
    }

    if (today) {
      stats.todayOrders += 1;

      if (cancelled) {
        stats.todayCancelledOrders += 1;
        stats.todayRevenueCancelled += total;
      }

      if (completed) {
        stats.todayRevenueCompleted += total;
      }
    }

    const createdAt = order.created_at ? new Date(order.created_at) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= trendStart) {
      const day = trendByKey.get(toDayKey(createdAt));
      if (day) {
        day.orders += 1;
        if (completed) {
          day.revenue += total;
        }
      }
    }
  }

  return stats;
}
