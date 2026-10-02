const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date;
}

function buildDateFilter(startDate, endDate, column = 'created_at') {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (startDate) {
    conditions.push(`${column} >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`${column} <= $${idx++}`);
    params.push(endDate);
  }

  return { conditions, params };
}

function renumberConditions(conditions, startIdx) {
  let idx = startIdx;
  return conditions.map(c => c.replace(/\$\d+/g, () => `$${idx++}`));
}

function orderRevenueExpr(alias = null) {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}total_amount, 0) - COALESCE(${prefix}tax_amount, 0)`;
}

async function getOrderReport(filters = {}) {
  const { start_date, end_date, status, group_by = 'day' } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date));
  const baseIdx = params.length + 1;

  if (status) {
    conditions.push(`status = $${baseIdx}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let dateGroup;
  switch (group_by) {
    case 'week': dateGroup = "DATE_TRUNC('week', created_at)"; break;
    case 'month': dateGroup = "DATE_TRUNC('month', created_at)"; break;
    default: dateGroup = "DATE_TRUNC('day', created_at)";
  }

  const result = await pool.query(
    `SELECT ${dateGroup} as period,
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(${orderRevenueExpr()}) as revenue,
            AVG(${orderRevenueExpr()}) as avg_order_value
     FROM orders ${whereClause}
     GROUP BY ${dateGroup}
     ORDER BY period DESC`,
    params
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(*) as total_orders,
        SUM(${orderRevenueExpr()}) as total_revenue,
        AVG(${orderRevenueExpr()}) as avg_order_value,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
     FROM orders ${whereClause}`,
    params
  );

  return {
    data: result.rows.map(r => ({
      period: r.period,
      total_orders: parseInt(r.total_orders),
      completed: parseInt(r.completed),
      cancelled: parseInt(r.cancelled),
      pending: parseInt(r.pending),
      processing: parseInt(r.processing),
      revenue: parseFloat(r.revenue || 0),
      avg_order_value: parseFloat(r.avg_order_value || 0),
    })),
    summary: summaryResult.rows[0],
  };
}

async function getPaymentReport(filters = {}) {
  const { start_date, end_date, status, method } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date));
  const baseIdx = params.length + 1;

  if (status) {
    conditions.push(`p.status = $${baseIdx++}`);
    params.push(status);
  }
  if (method) {
    conditions.push(`p.method = $${baseIdx++}`);
    params.push(method);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT p.method, p.status,
            COUNT(*) as count,
            SUM(p.amount) as total_amount,
            AVG(p.amount) as avg_amount
     FROM payments p
     JOIN orders o ON p.order_id = o.order_id
     ${whereClause}
     GROUP BY p.method, p.status
     ORDER BY p.method, p.status`,
    params
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
     FROM payments p
     JOIN orders o ON p.order_id = o.order_id
     ${whereClause}`,
    params
  );

  return {
    data: result.rows.map(r => ({
      method: r.method,
      status: r.status,
      count: parseInt(r.count),
      total_amount: parseFloat(r.total_amount || 0),
      avg_amount: parseFloat(r.avg_amount || 0),
    })),
    summary: summaryResult.rows[0],
  };
}

async function getAppointmentReport(filters = {}) {
  const { start_date, end_date, status, service_id, payment_method } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date), 'scheduled_at');
  let baseIdx = params.length + 1;

  if (status) {
    conditions.push(`a.status = $${baseIdx++}`);
    params.push(status);
  }
  if (payment_method) {
    conditions.push(`a.payment_method = $${baseIdx++}`);
    params.push(payment_method);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT s.name as service_name, a.status, a.payment_method,
            COUNT(*) as count,
            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count
     FROM appointments a
     JOIN services s ON s.service_id::text = ANY(a.services)
     ${whereClause}
     GROUP BY s.name, a.status, a.payment_method
     ORDER BY s.name, a.status`,
    params
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'ready_for_pickup' THEN 1 ELSE 0 END) as ready_for_pickup,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
     FROM appointments a
     ${whereClause}`,
    params
  );

  const serviceStats = await pool.query(
    `SELECT s.name, s.service_id, COUNT(*) as total_appointments
     FROM appointments a
     JOIN services s ON s.service_id::text = ANY(a.services)
     ${whereClause}
     GROUP BY s.name, s.service_id
     ORDER BY total_appointments DESC
     LIMIT 10`,
    params
  );

  const paymentMethodStats = await pool.query(
    `SELECT 
        a.payment_method as method,
        COUNT(*) as count,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count
     FROM appointments a
     ${whereClause}
     GROUP BY a.payment_method
     ORDER BY count DESC`,
    params
  );

  return {
    data: result.rows,
    summary: summaryResult.rows[0],
    top_services: serviceStats.rows,
    by_payment_method: paymentMethodStats.rows.map(r => ({
      method: r.method,
      count: parseInt(r.count, 10),
      completed_count: parseInt(r.completed_count, 10),
    })),
  };
}

async function getServiceReport(filters = {}) {
  const { start_date, end_date } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date), 'a.scheduled_at');
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT s.name, s.price, s.duration_minutes,
            COUNT(a.appointment_id) as total_bookings,
            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_bookings,
            SUM(s.price * CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as total_revenue
     FROM services s
     LEFT JOIN appointments a ON s.service_id = a.service_id
     ${whereClause}
     GROUP BY s.service_id, s.name, s.price, s.duration_minutes
     ORDER BY total_bookings DESC`,
    params
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(DISTINCT s.service_id) as total_services,
        SUM(s.price * (SELECT COUNT(*) FROM appointments a WHERE a.service_id = s.service_id AND a.status = 'completed')) as total_revenue
     FROM services s`,
    []
  );

  return {
    data: result.rows.map(r => ({
      name: r.name,
      price: parseFloat(r.price),
      duration_minutes: parseInt(r.duration_minutes),
      total_bookings: parseInt(r.total_bookings),
      completed_bookings: parseInt(r.completed_bookings),
      total_revenue: parseFloat(r.total_revenue || 0),
    })),
    summary: summaryResult.rows[0],
  };
}

async function getProductReport(filters = {}) {
  const { start_date, end_date, category_id, limit = 10 } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date), 'o.created_at');
  const baseIdx = params.length + 1;

  if (category_id) {
    conditions.push(`p.category_id = $${baseIdx++}`);
    params.push(category_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT p.product_id, p.name, p.price, c.name as category_name,
            SUM(oi.quantity) as total_sold,
            SUM(oi.quantity * oi.unit_price) as total_revenue,
            i.stock as current_stock
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     LEFT JOIN order_items oi ON p.product_id = oi.product_id
     LEFT JOIN orders o ON oi.order_id = o.order_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     ${whereClause}
     GROUP BY p.product_id, p.name, p.price, c.name, i.stock
     ORDER BY total_sold DESC
     LIMIT $${baseIdx}`,
    [...params, parseInt(limit)]
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(DISTINCT p.product_id) as total_products,
        SUM(i.stock) as total_stock,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     LEFT JOIN order_items oi ON p.product_id = oi.product_id
     LEFT JOIN orders o ON oi.order_id = o.order_id
     ${whereClause}`,
    params
  );

  const lowStock = await pool.query(
    `SELECT p.product_id, p.name, i.stock, i.low_stock_threshold, i.max_stock
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     WHERE i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), i.max_stock * 0.10)
       AND p.is_active = true
     ORDER BY i.stock ASC
     LIMIT 10`
  );

  return {
    data: result.rows.map(r => ({
      product_id: r.product_id,
      name: r.name,
      price: parseFloat(r.price),
      category_name: r.category_name,
      total_sold: parseInt(r.total_sold || 0),
      total_revenue: parseFloat(r.total_revenue || 0),
      current_stock: parseInt(r.current_stock),
    })),
    summary: summaryResult.rows[0],
    low_stock_products: lowStock.rows,
  };
}

async function getCartReport(filters = {}) {
  const { start_date, end_date } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date));
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const cartStats = await pool.query(
    `SELECT 
        COUNT(DISTINCT c.cart_id) as total_carts,
        COUNT(DISTINCT ci.cart_item_id) as total_items,
        SUM(c.subtotal) as total_value,
        AVG(c.subtotal) as avg_cart_value
     FROM carts c
     LEFT JOIN cart_items ci ON c.cart_id = ci.cart_id
     ${whereClause}`,
    params
  );

  const productBreakdown = await pool.query(
    `SELECT p.name, p.category_id,
            COUNT(ci.cart_item_id) as times_added,
            SUM(ci.quantity) as total_quantity
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.product_id
     JOIN carts c ON ci.cart_id = c.cart_id
     ${whereClause}
     GROUP BY p.name, p.category_id
     ORDER BY times_added DESC
     LIMIT 10`,
    params
  );

  const abandonedCarts = await pool.query(
    `SELECT c.cart_id, c.user_id, c.subtotal, c.created_at,
            COUNT(ci.cart_item_id) as item_count
     FROM carts c
     LEFT JOIN cart_items ci ON c.cart_id = ci.cart_id
     WHERE c.updated_at < now() - interval '24 hours'
     GROUP BY c.cart_id, c.user_id, c.subtotal, c.created_at
     HAVING COUNT(ci.cart_item_id) > 0
     ORDER BY c.updated_at DESC
     LIMIT 10`
  );

  return {
    summary: cartStats.rows[0],
    popular_products: productBreakdown.rows,
    abandoned_carts: abandonedCarts.rows.map(r => ({
      cart_id: r.cart_id,
      user_id: r.user_id,
      value: parseFloat(r.subtotal),
      item_count: parseInt(r.item_count),
      created_at: r.created_at,
    })),
  };
}

async function getUserReport(filters = {}) {
  const { start_date, end_date, role } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date));
  const baseIdx = params.length + 1;

  if (role) {
    conditions.push(`role = $${baseIdx++}`);
    params.push(role);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const userStats = await pool.query(
    `SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) as customers,
        SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active
     FROM users ${whereClause}`,
    params
  );

  const newUsers = await pool.query(
    `SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as count
     FROM users ${whereClause}
     GROUP BY DATE_TRUNC('day', created_at)
     ORDER BY date DESC
     LIMIT 30`,
    params
  );

  const topCustomers = await pool.query(
    `SELECT u.user_id, u.email, 
            CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as name,
            COUNT(o.order_id) as total_orders,
            SUM(o.total_amount) as total_spent
     FROM users u
     LEFT JOIN orders o ON u.user_id = o.user_id
     WHERE u.role = 'customer'
     GROUP BY u.user_id, u.email, u.first_name, u.middle_name, u.last_name
     HAVING COUNT(o.order_id) > 0
     ORDER BY total_spent DESC
     LIMIT 10`
  );

  return {
    summary: userStats.rows[0],
    new_users_trend: newUsers.rows,
    top_customers: topCustomers.rows.map(r => ({
      user_id: r.user_id,
      email: r.email,
      name: r.name,
      total_orders: parseInt(r.total_orders),
      total_spent: parseFloat(r.total_spent || 0),
    })),
  };
}

async function getDashboardSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString();

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [todayOrders, yesterdayOrders, monthOrders, todayRevenue, monthRevenue, activeUsers, pendingAppointments, pendingPayments] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM orders WHERE created_at >= $1`, [todayStr]),
    pool.query(`SELECT COUNT(*) as count FROM orders WHERE created_at >= $1 AND created_at < $2`, [yesterdayStr, todayStr]),
    pool.query(`SELECT COUNT(*) as count, SUM(${orderRevenueExpr()}) as revenue FROM orders WHERE created_at >= $1`, [thisMonthStart]),
    pool.query(`SELECT SUM(${orderRevenueExpr()}) as revenue FROM orders WHERE created_at >= $1 AND status = 'delivered'`, [todayStr]),
    pool.query(`SELECT SUM(${orderRevenueExpr()}) as revenue FROM orders WHERE created_at >= $1 AND status = 'delivered'`, [thisMonthStart]),
    pool.query(`SELECT COUNT(*) as count FROM users WHERE is_active = true`),
    pool.query(`SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'`),
    pool.query(`SELECT COUNT(*) as count FROM payments WHERE status = 'pending'`),
  ]);

  return {
    today_orders: parseInt(todayOrders.rows[0].count || 0),
    yesterday_orders: parseInt(yesterdayOrders.rows[0].count || 0),
    month_orders: parseInt(monthOrders.rows[0].count || 0),
    month_revenue: parseFloat(monthOrders.rows[0].revenue || 0),
    today_revenue: parseFloat(todayRevenue.rows[0].revenue || 0),
    month_revenue_total: parseFloat(monthRevenue.rows[0].revenue || 0),
    active_users: parseInt(activeUsers.rows[0].count || 0),
    pending_appointments: parseInt(pendingAppointments.rows[0].count || 0),
    pending_payments: parseInt(pendingPayments.rows[0].count || 0),
  };
}

async function getRevenueReport(filters = {}) {
  const { start_date, end_date, group_by = 'day' } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date));
  const baseIdx = params.length + 1;

  let dateGroup;
  switch (group_by) {
    case 'week': dateGroup = "DATE_TRUNC('week', o.created_at)"; break;
    case 'month': dateGroup = "DATE_TRUNC('month', o.created_at)"; break;
    case 'year': dateGroup = "DATE_TRUNC('year', o.created_at)"; break;
    default: dateGroup = "DATE_TRUNC('day', o.created_at)";
  }

  const result = await pool.query(
    `SELECT ${dateGroup} as period,
            SUM(${orderRevenueExpr('o')}) as revenue,
            COUNT(o.order_id) as orders,
            AVG(${orderRevenueExpr('o')}) as avg_order_value
     FROM orders o
     WHERE o.status = 'delivered'
     ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
     GROUP BY ${dateGroup}
     ORDER BY period DESC`,
    params
  );

  const totalResult = await pool.query(
    `SELECT 
        SUM(${orderRevenueExpr()}) as total_revenue,
        AVG(${orderRevenueExpr()}) as overall_avg_order,
        COUNT(*) as total_orders
     FROM orders
     WHERE status = 'delivered'
     ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}`,
    params
  );

  return {
    data: result.rows.map(r => ({
      period: r.period,
      revenue: parseFloat(r.revenue || 0),
      orders: parseInt(r.orders),
      avg_order_value: parseFloat(r.avg_order_value || 0),
    })),
    summary: totalResult.rows[0],
  };
}

async function getSalesReport(filters = {}) {
  const {
    start_date, end_date,
    report_type = 'all',
    order_type, payment_method,
    status, payment_status,
    staff_id, refund_type,
    search, sort_by = 'date', sort_order = 'desc',
    page = 1, limit = 10,
  } = filters;

  const startDate = parseDate(start_date);
  const endDate = parseDate(end_date);
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const hasDateRange = !!(startDate || endDate);

  // Common date condition builders
  function dateCond(column, params, startVal, endVal) {
    const conds = [];
    if (startVal) {
      params.push(startVal);
      conds.push(`${column} >= $${params.length}`);
    }
    if (endVal) {
      params.push(endVal);
      conds.push(`${column} <= $${params.length}`);
    }
    return conds.length > 0 ? conds.join(' AND ') : '1=1';
  }

  // 1. Fetch Staff List for POS Cashier Filter metadata
  const staffListQ = pool.query(
    `SELECT DISTINCT u.user_id, CONCAT(u.first_name, ' ', u.last_name) AS name, u.role
     FROM users u
     WHERE u.role IN ('staff', 'admin', 'super_admin') AND u.is_active = true
     ORDER BY name ASC`
  );

  // 2. Fetch baseline channel totals for high-level KPIs & backwards compatibility
  const posParams = [];
  const posDateClause = dateCond('ps.created_at', posParams, startDate, endDate);
  const walkInStatsQ = pool.query(
    `SELECT
       COUNT(CASE WHEN ps.status = 'completed' AND ps.payment_status = 'verified' THEN 1 END)::int AS completed_transactions,
       COALESCE(SUM(CASE WHEN ps.status = 'completed' AND ps.payment_status = 'verified' THEN ps.total_amount ELSE 0 END), 0)::numeric AS gross,
       COUNT(CASE WHEN ps.status IN ('voided', 'returned') THEN 1 END)::int AS adjustment_count,
       COALESCE(SUM(CASE WHEN ps.status IN ('voided', 'returned') THEN ps.total_amount ELSE 0 END), 0)::numeric AS adjustments
     FROM pos_sales ps
     WHERE ps.deleted_at IS NULL AND ${posDateClause}`,
    posParams
  );

  const orderParams = [];
  const orderDateClause = dateCond('o.created_at', orderParams, startDate, endDate);
  const orderStatsQ = pool.query(
    `SELECT
       -- Online product orders
       COUNT(CASE WHEN o.order_type = 'product' AND o.payment_status = 'approved' AND o.status != 'cancelled' THEN 1 END)::int AS online_transactions,
       COALESCE(SUM(CASE WHEN o.order_type = 'product' AND o.payment_status = 'approved' AND o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0)::numeric AS online_gross,
       -- Customization orders
       COUNT(CASE WHEN o.order_type = 'customization' AND o.payment_status = 'approved' AND o.status != 'cancelled' THEN 1 END)::int AS cust_transactions,
       COALESCE(SUM(CASE WHEN o.order_type = 'customization' AND o.payment_status = 'approved' AND o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0)::numeric AS cust_gross
     FROM orders o
     WHERE o.deleted_at IS NULL AND ${orderDateClause}`,
    orderParams
  );

  const refundParams = [];
  const refundDateClause = dateCond('rr.created_at', refundParams, startDate, endDate);
  const refundStatsQ = pool.query(
    `SELECT
       COUNT(*)::int AS refund_count,
       COALESCE(SUM(COALESCE(rr.approved_amount, rr.refunded_amount, rr.amount_requested, 0)), 0)::numeric AS total_refunds,
       COALESCE(SUM(CASE WHEN o.order_type = 'product' THEN COALESCE(rr.approved_amount, rr.refunded_amount, rr.amount_requested, 0) ELSE 0 END), 0)::numeric AS online_refunds,
       COALESCE(SUM(CASE WHEN o.order_type = 'customization' OR rr.project_id IS NOT NULL THEN COALESCE(rr.approved_amount, rr.refunded_amount, rr.amount_requested, 0) ELSE 0 END), 0)::numeric AS cust_refunds
     FROM refund_requests rr
     LEFT JOIN orders o ON o.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processing', 'refunded') AND ${refundDateClause}`,
    refundParams
  );

  // Appointment baseline stats (revenue = sum of service prices for completed appointments)
  const apptParams = [];
  const apptDateClause = dateCond('a.scheduled_at', apptParams, startDate, endDate);
  const apptStatsQ = pool.query(
    `SELECT
       COUNT(CASE WHEN a.status = 'completed' THEN 1 END)::int AS completed_transactions,
       COALESCE(SUM(
         CASE WHEN a.status = 'completed' THEN (
           SELECT COALESCE(SUM(s.price), 0)
           FROM services s
           WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
         ) ELSE 0 END
       ), 0)::numeric AS gross
     FROM appointments a
     WHERE a.deleted_at IS NULL AND ${apptDateClause}`,
    apptParams
  );

  // 3. Payment methods & daily trends (includes appointments)
  const trendParams = [];
  const trendDateClauseOrder = dateCond('o.created_at', trendParams, startDate, endDate);
  const trendDateClausePos = dateCond('ps.created_at', trendParams, startDate, endDate);
  const trendDateClauseAppt = dateCond('a.scheduled_at', trendParams, startDate, endDate);
  const dailyTrendQ = pool.query(
    `WITH combined_days AS (
       SELECT DATE_TRUNC('day', o.created_at) AS day, o.total_amount AS revenue, 1 AS tx
       FROM orders o
       WHERE o.deleted_at IS NULL AND o.payment_status = 'approved' AND o.status != 'cancelled'
         AND ${trendDateClauseOrder}
       UNION ALL
       SELECT DATE_TRUNC('day', ps.created_at) AS day, ps.total_amount AS revenue, 1 AS tx
       FROM pos_sales ps
       WHERE ps.deleted_at IS NULL AND ps.status = 'completed' AND ps.payment_status = 'verified'
         AND ${trendDateClausePos}
       UNION ALL
       SELECT DATE_TRUNC('day', a.scheduled_at) AS day,
         COALESCE((
           SELECT SUM(s.price)
           FROM services s
           WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
         ), 0) AS revenue,
         1 AS tx
       FROM appointments a
       WHERE a.deleted_at IS NULL AND a.status = 'completed'
         AND ${trendDateClauseAppt}
     )
     SELECT day AS date,
            COALESCE(SUM(revenue), 0)::numeric AS gross,
            COUNT(*)::int AS transactions
     FROM combined_days
     GROUP BY day
     ORDER BY day ASC
     LIMIT 90`,
    trendParams
  );

  // 4. Build Context-Aware Transactions Query
  let txItems = [];
  let totalRecords = 0;
  const numLimit = Math.max(1, parseInt(limit, 10) || 50);
  const numPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (numPage - 1) * numLimit;

  const validSortCols = {
    date: 'date',
    amount: 'gross_amount',
    identifier: 'transaction_number',
    status: 'status',
    customer: 'customer_name',
  };
  const resolvedSort = validSortCols[sort_by] || 'date';
  const resolvedDir = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  if (report_type === 'online') {
    const qParams = [];
    const qConds = [`o.deleted_at IS NULL`, `o.order_type = 'product'`];

    if (startDate) { qParams.push(startDate); qConds.push(`o.created_at >= $${qParams.length}`); }
    if (endDate) { qParams.push(endDate); qConds.push(`o.created_at <= $${qParams.length}`); }
    if (status && status !== 'all') { qParams.push(status); qConds.push(`o.status = $${qParams.length}`); }
    if (payment_status && payment_status !== 'all') { qParams.push(payment_status); qConds.push(`o.payment_status = $${qParams.length}`); }
    if (payment_method && payment_method !== 'all') {
      qParams.push(payment_method);
      qConds.push(`EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.method::text = $${qParams.length})`);
    }
    if (search && search.trim()) {
      qParams.push(`%${search.trim()}%`);
      const sIdx = qParams.length;
      qConds.push(`(o.order_number ILIKE $${sIdx} OR u.first_name ILIKE $${sIdx} OR u.last_name ILIKE $${sIdx} OR u.email ILIKE $${sIdx})`);
    }

    const whereSql = qConds.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM orders o LEFT JOIN users u ON o.user_id = u.user_id WHERE ${whereSql}`,
      qParams
    );
    totalRecords = countRes.rows[0]?.total || 0;

    const dataQ = await pool.query(
      `SELECT
         o.order_id AS id,
         o.order_number AS transaction_number,
         o.created_at AS date,
         'online' AS channel,
         CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
         u.email AS customer_email,
         o.status::text AS status,
         o.payment_status::text AS payment_status,
         COALESCE((SELECT p.method::text FROM payments p WHERE p.order_id = o.order_id AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 1), 'gcash') AS payment_method,
         COALESCE((SELECT SUM(oi.quantity)::int FROM order_items oi WHERE oi.order_id = o.order_id AND oi.deleted_at IS NULL), 0)::int AS item_count,
         o.subtotal::numeric AS subtotal,
         o.discount_amount::numeric AS discount_amount,
         o.shipping_cost::numeric AS shipping_cost,
         o.tax_amount::numeric AS tax_amount,
         o.total_amount::numeric AS gross_amount,
         COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0)::numeric AS adjustment_amount,
         (o.total_amount - COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0))::numeric AS net_amount,
         o.notes
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.user_id
       WHERE ${whereSql}
       ORDER BY ${resolvedSort} ${resolvedDir}
       LIMIT ${numLimit} OFFSET ${offset}`,
      qParams
    );
    txItems = dataQ.rows;

  } else if (report_type === 'pos') {
    const qParams = [];
    const qConds = [`ps.deleted_at IS NULL`];

    if (startDate) { qParams.push(startDate); qConds.push(`ps.created_at >= $${qParams.length}`); }
    if (endDate) { qParams.push(endDate); qConds.push(`ps.created_at <= $${qParams.length}`); }
    if (status && status !== 'all') { qParams.push(status); qConds.push(`ps.status::text = $${qParams.length}`); }
    if (payment_method && payment_method !== 'all') { qParams.push(payment_method); qConds.push(`ps.payment_method::text = $${qParams.length}`); }
    if (staff_id && staff_id !== 'all') { qParams.push(staff_id); qConds.push(`ps.staff_id = $${qParams.length}`); }
    if (search && search.trim()) {
      qParams.push(`%${search.trim()}%`);
      const sIdx = qParams.length;
      qConds.push(`(ps.sale_number ILIKE $${sIdx} OR ps.customer_name ILIKE $${sIdx} OR u.first_name ILIKE $${sIdx} OR u.last_name ILIKE $${sIdx})`);
    }

    const whereSql = qConds.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM pos_sales ps LEFT JOIN users u ON ps.staff_id = u.user_id WHERE ${whereSql}`,
      qParams
    );
    totalRecords = countRes.rows[0]?.total || 0;

    const dataQ = await pool.query(
      `SELECT
         ps.sale_id AS id,
         ps.sale_number AS transaction_number,
         ps.created_at AS date,
         'walkIn' AS channel,
         CONCAT(u.first_name, ' ', u.last_name) AS staff_name,
         ps.staff_id,
         COALESCE(ps.customer_name, 'Walk-in Customer') AS customer_name,
         ps.customer_phone,
         ps.status::text AS status,
         ps.payment_status::text AS payment_status,
         ps.payment_method::text AS payment_method,
         COALESCE((SELECT SUM(psi.quantity)::int FROM pos_sale_items psi WHERE psi.sale_id = ps.sale_id AND psi.deleted_at IS NULL), 0)::int AS item_count,
         ps.subtotal::numeric AS subtotal,
         ps.discount_amount::numeric AS discount_amount,
         ps.tax_amount::numeric AS tax_amount,
         ps.total_amount::numeric AS gross_amount,
         (CASE WHEN ps.status IN ('voided', 'returned') THEN ps.total_amount ELSE COALESCE(ps.refund_amount, 0) END)::numeric AS adjustment_amount,
         (CASE WHEN ps.status IN ('voided', 'returned') THEN 0 ELSE (ps.total_amount - COALESCE(ps.refund_amount, 0)) END)::numeric AS net_amount,
         ps.notes,
         ps.void_reason,
         ps.return_reason
       FROM pos_sales ps
       LEFT JOIN users u ON ps.staff_id = u.user_id
       WHERE ${whereSql}
       ORDER BY ${resolvedSort} ${resolvedDir}
       LIMIT ${numLimit} OFFSET ${offset}`,
      qParams
    );
    txItems = dataQ.rows;

  } else if (report_type === 'customization') {
    const qParams = [];
    const qConds = [`o.deleted_at IS NULL`, `o.order_type = 'customization'`];

    if (startDate) { qParams.push(startDate); qConds.push(`o.created_at >= $${qParams.length}`); }
    if (endDate) { qParams.push(endDate); qConds.push(`o.created_at <= $${qParams.length}`); }
    if (status && status !== 'all') {
      qParams.push(status);
      qConds.push(`(o.customization_status = $${qParams.length} OR o.status::text = $${qParams.length})`);
    }
    if (payment_status && payment_status !== 'all') { qParams.push(payment_status); qConds.push(`o.payment_status = $${qParams.length}`); }
    if (payment_method && payment_method !== 'all') {
      qParams.push(payment_method);
      qConds.push(`EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.method::text = $${qParams.length})`);
    }
    if (search && search.trim()) {
      qParams.push(`%${search.trim()}%`);
      const sIdx = qParams.length;
      qConds.push(`(o.order_number ILIKE $${sIdx} OR u.first_name ILIKE $${sIdx} OR u.last_name ILIKE $${sIdx} OR u.email ILIKE $${sIdx})`);
    }

    const whereSql = qConds.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM orders o LEFT JOIN users u ON o.user_id = u.user_id WHERE ${whereSql}`,
      qParams
    );
    totalRecords = countRes.rows[0]?.total || 0;

    const dataQ = await pool.query(
      `SELECT
         o.order_id AS id,
         o.order_number AS transaction_number,
         o.created_at AS date,
         'customization' AS channel,
         CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
         u.email AS customer_email,
         COALESCE(o.customization_status, o.status::text) AS status,
         o.payment_status::text AS payment_status,
         COALESCE((SELECT p.method::text FROM payments p WHERE p.order_id = o.order_id AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 1), 'bank_transfer') AS payment_method,
         o.total_amount::numeric AS gross_amount,
         COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0)::numeric AS adjustment_amount,
         (o.total_amount - COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0))::numeric AS net_amount,
         o.notes
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.user_id
       WHERE ${whereSql}
       ORDER BY ${resolvedSort} ${resolvedDir}
       LIMIT ${numLimit} OFFSET ${offset}`,
      qParams
    );
    txItems = dataQ.rows;

  } else if (report_type === 'appointments') {
    const qParams = [];
    const qConds = [`a.deleted_at IS NULL`];

    if (startDate) { qParams.push(startDate); qConds.push(`a.scheduled_at >= $${qParams.length}`); }
    if (endDate) { qParams.push(endDate); qConds.push(`a.scheduled_at <= $${qParams.length}`); }
    if (status && status !== 'all') { qParams.push(status); qConds.push(`a.status::text = $${qParams.length}`); }
    if (payment_method && payment_method !== 'all') { qParams.push(payment_method); qConds.push(`a.payment_method::text = $${qParams.length}`); }
    if (payment_status && payment_status !== 'all') { qParams.push(payment_status); qConds.push(`a.payment_status::text = $${qParams.length}`); }
    if (search && search.trim()) {
      qParams.push(`%${search.trim()}%`);
      const sIdx = qParams.length;
      qConds.push(`(a.reference_code ILIKE $${sIdx} OR a.customer_name ILIKE $${sIdx} OR a.customer_email ILIKE $${sIdx} OR u.first_name ILIKE $${sIdx} OR u.last_name ILIKE $${sIdx})`);
    }

    const whereSql = qConds.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.user_id
       WHERE ${whereSql}`,
      qParams
    );
    totalRecords = countRes.rows[0]?.total || 0;

    // Determine sort column
    const apptSortMap = {
      date: 'a.scheduled_at',
      amount: 'gross_amount',
      identifier: 'transaction_number',
      status: 'a.status',
      customer: 'customer_name',
    };
    const apptSort = apptSortMap[sort_by] || 'a.scheduled_at';

    const dataQ = await pool.query(
      `SELECT
         a.appointment_id AS id,
         COALESCE(a.reference_code, CONCAT('APT-', a.appointment_id::text)) AS transaction_number,
         a.scheduled_at AS date,
         'appointment' AS channel,
         COALESCE(a.customer_name, CONCAT(u.first_name, ' ', u.last_name), 'Walk-in Customer') AS customer_name,
         COALESCE(a.customer_email, u.email) AS customer_email,
         COALESCE(a.customer_phone, u.phone) AS customer_phone,
         a.status::text AS status,
         a.payment_status::text AS payment_status,
         COALESCE(a.payment_method::text, 'gcash') AS payment_method,
         COALESCE((
           SELECT string_agg(s.name, ', ' ORDER BY s.name)
           FROM services s
           WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
         ), 'Service Appointment') AS service_names,
         COALESCE((
           SELECT SUM(s.price)
           FROM services s
           WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
         ), 0)::numeric AS gross_amount,
         0::numeric AS adjustment_amount,
         COALESCE((
           SELECT SUM(s.price)
           FROM services s
           WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
         ), 0)::numeric AS net_amount,
         a.notes
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.user_id
       WHERE ${whereSql}
       ORDER BY ${apptSort} ${resolvedDir}
       LIMIT ${numLimit} OFFSET ${offset}`,
      qParams
    );
    txItems = dataQ.rows;

  } else if (report_type === 'refunds') {
    const qParams = [];
    const qConds = [`1=1`];

    if (startDate) { qParams.push(startDate); qConds.push(`date >= $${qParams.length}`); }
    if (endDate) { qParams.push(endDate); qConds.push(`date <= $${qParams.length}`); }
    if (status && status !== 'all') { qParams.push(status); qConds.push(`status = $${qParams.length}`); }
    if (refund_type && refund_type !== 'all') { qParams.push(refund_type); qConds.push(`adjustment_type = $${qParams.length}`); }
    if (search && search.trim()) {
      qParams.push(`%${search.trim()}%`);
      const sIdx = qParams.length;
      qConds.push(`(transaction_number ILIKE $${sIdx} OR customer_name ILIKE $${sIdx} OR related_number ILIKE $${sIdx} OR reason ILIKE $${sIdx})`);
    }

    const whereSql = qConds.join(' AND ');

    const refundUnionQuery = `
      WITH unified_refunds AS (
        -- Refund requests
        SELECT
          rr.refund_request_id AS id,
          COALESCE(rr.request_number, CONCAT('REF-', SUBSTRING(rr.refund_request_id::text, 1, 8))) AS transaction_number,
          rr.created_at AS date,
          CASE
            WHEN rr.project_id IS NOT NULL OR o.order_type = 'customization' THEN 'customization'
            ELSE 'online'
          END AS channel,
          COALESCE(o.order_number, 'Direct Project') AS related_number,
          CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
          COALESCE(rr.refund_type, 'money_refund') AS adjustment_type,
          COALESCE(rr.reason, 'Customer Refund') AS reason,
          rr.status::text AS status,
          COALESCE(rr.amount_requested, 0)::numeric AS gross_amount,
          COALESCE(rr.approved_amount, rr.refunded_amount, rr.amount_requested, 0)::numeric AS adjustment_amount,
          COALESCE(rr.approved_amount, rr.refunded_amount, rr.amount_requested, 0)::numeric AS net_amount,
          rr.refund_method AS payment_method,
          CONCAT(pb.first_name, ' ', pb.last_name) AS staff_name
        FROM refund_requests rr
        LEFT JOIN users u ON rr.user_id = u.user_id
        LEFT JOIN users pb ON rr.processed_by = pb.user_id
        LEFT JOIN orders o ON rr.order_id = o.order_id

        UNION ALL

        -- POS Voids and Returns
        SELECT
          ps.sale_id AS id,
          ps.sale_number AS transaction_number,
          COALESCE(ps.returned_at, ps.voided_at, ps.created_at) AS date,
          'walkIn' AS channel,
          ps.sale_number AS related_number,
          COALESCE(ps.customer_name, 'Walk-in Customer') AS customer_name,
          ps.status::text AS adjustment_type,
          COALESCE(ps.void_reason, ps.return_reason, 'POS Sale Adjustment') AS reason,
          ps.status::text AS status,
          ps.total_amount::numeric AS gross_amount,
          ps.total_amount::numeric AS adjustment_amount,
          ps.total_amount::numeric AS net_amount,
          ps.payment_method::text AS payment_method,
          CONCAT(st.first_name, ' ', st.last_name) AS staff_name
        FROM pos_sales ps
        LEFT JOIN users st ON ps.staff_id = st.user_id
        WHERE ps.status IN ('voided', 'returned') AND ps.deleted_at IS NULL
      )
    `;

    const countRes = await pool.query(
      `${refundUnionQuery} SELECT COUNT(*)::int AS total FROM unified_refunds WHERE ${whereSql}`,
      qParams
    );
    totalRecords = countRes.rows[0]?.total || 0;

    const dataQ = await pool.query(
      `${refundUnionQuery}
       SELECT * FROM unified_refunds
       WHERE ${whereSql}
       ORDER BY ${resolvedSort} ${resolvedDir}
       LIMIT ${numLimit} OFFSET ${offset}`,
      qParams
    );
    txItems = dataQ.rows;

  } else {
    // report_type === 'all'
    const qParams = [];
    const qConds = [`1=1`];

    if (startDate) { qParams.push(startDate); qConds.push(`date >= $${qParams.length}`); }
    if (endDate) { qParams.push(endDate); qConds.push(`date <= $${qParams.length}`); }
    if (order_type && order_type !== 'all') { qParams.push(order_type); qConds.push(`channel = $${qParams.length}`); }
    if (payment_method && payment_method !== 'all') { qParams.push(payment_method); qConds.push(`payment_method = $${qParams.length}`); }
    if (status && status !== 'all') { qParams.push(status); qConds.push(`status = $${qParams.length}`); }
    if (search && search.trim()) {
      qParams.push(`%${search.trim()}%`);
      const sIdx = qParams.length;
      qConds.push(`(transaction_number ILIKE $${sIdx} OR customer_name ILIKE $${sIdx})`);
    }

    const whereSql = qConds.join(' AND ');

    const allUnionQuery = `
      WITH unified_sales AS (
        -- Online Orders
        SELECT
          o.order_id AS id,
          o.order_number AS transaction_number,
          o.created_at AS date,
          'online' AS channel,
          CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
          COALESCE((SELECT p.method::text FROM payments p WHERE p.order_id = o.order_id AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 1), 'gcash') AS payment_method,
          o.status::text AS status,
          o.total_amount::numeric AS gross_amount,
          COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0)::numeric AS adjustment_amount,
          (o.total_amount - COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0))::numeric AS net_amount,
          NULL AS staff_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        WHERE o.deleted_at IS NULL AND o.order_type = 'product'

        UNION ALL

        -- POS Sales
        SELECT
          ps.sale_id AS id,
          ps.sale_number AS transaction_number,
          ps.created_at AS date,
          'walkIn' AS channel,
          COALESCE(ps.customer_name, 'Walk-in Customer') AS customer_name,
          ps.payment_method::text AS payment_method,
          ps.status::text AS status,
          ps.total_amount::numeric AS gross_amount,
          (CASE WHEN ps.status IN ('voided', 'returned') THEN ps.total_amount ELSE COALESCE(ps.refund_amount, 0) END)::numeric AS adjustment_amount,
          (CASE WHEN ps.status IN ('voided', 'returned') THEN 0 ELSE (ps.total_amount - COALESCE(ps.refund_amount, 0)) END)::numeric AS net_amount,
          CONCAT(st.first_name, ' ', st.last_name) AS staff_name
        FROM pos_sales ps
        LEFT JOIN users st ON ps.staff_id = st.user_id
        WHERE ps.deleted_at IS NULL

        UNION ALL

        -- Customization
        SELECT
          o.order_id AS id,
          o.order_number AS transaction_number,
          o.created_at AS date,
          'customization' AS channel,
          CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
          COALESCE((SELECT p.method::text FROM payments p WHERE p.order_id = o.order_id AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 1), 'bank_transfer') AS payment_method,
          COALESCE(o.customization_status, o.status::text) AS status,
          o.total_amount::numeric AS gross_amount,
          COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0)::numeric AS adjustment_amount,
          (o.total_amount - COALESCE((SELECT SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved', 'refunded', 'processing')), 0))::numeric AS net_amount,
          NULL AS staff_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        WHERE o.deleted_at IS NULL AND o.order_type = 'customization'

        UNION ALL

        -- Appointments
        SELECT
          a.appointment_id AS id,
          COALESCE(a.reference_code, CONCAT('APT-', a.appointment_id::text)) AS transaction_number,
          a.scheduled_at AS date,
          'appointment' AS channel,
          COALESCE(a.customer_name, CONCAT(u.first_name, ' ', u.last_name), 'Walk-in Customer') AS customer_name,
          COALESCE(a.payment_method::text, 'gcash') AS payment_method,
          a.status::text AS status,
          COALESCE((
            SELECT SUM(s.price)
            FROM services s
            WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
          ), 0)::numeric AS gross_amount,
          0::numeric AS adjustment_amount,
          COALESCE((
            SELECT SUM(s.price)
            FROM services s
            WHERE s.service_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(a.services)))
          ), 0)::numeric AS net_amount,
          NULL AS staff_name
        FROM appointments a
        LEFT JOIN users u ON a.user_id = u.user_id
        WHERE a.deleted_at IS NULL
      )
    `;

    const countRes = await pool.query(
      `${allUnionQuery} SELECT COUNT(*)::int AS total FROM unified_sales WHERE ${whereSql}`,
      qParams
    );
    totalRecords = countRes.rows[0]?.total || 0;

    const dataQ = await pool.query(
      `${allUnionQuery}
       SELECT * FROM unified_sales
       WHERE ${whereSql}
       ORDER BY ${resolvedSort} ${resolvedDir}
       LIMIT ${numLimit} OFFSET ${offset}`,
      qParams
    );
    txItems = dataQ.rows;
  }

  // Await the baseline and breakdown promises
  const [staffListR, walkInStatsR, orderStatsR, refundStatsR, apptStatsR, dailyTrendR] = await Promise.all([
    staffListQ,
    walkInStatsQ,
    orderStatsQ,
    refundStatsQ,
    apptStatsQ,
    dailyTrendQ,
  ]);

  const walkInStats = walkInStatsR.rows[0] || {};
  const orderStats = orderStatsR.rows[0] || {};
  const refundStats = refundStatsR.rows[0] || {};
  const apptStats = apptStatsR.rows[0] || {};

  const walkInGross = parseFloat(walkInStats.gross || 0);
  const walkInTx = parseInt(walkInStats.completed_transactions || 0, 10);
  const walkInAdj = parseFloat(walkInStats.adjustments || 0);

  const onlineGross = parseFloat(orderStats.online_gross || 0);
  const onlineTx = parseInt(orderStats.online_transactions || 0, 10);
  const onlineAdj = parseFloat(refundStats.online_refunds || 0);

  const custGross = parseFloat(orderStats.cust_gross || 0);
  const custTx = parseInt(orderStats.cust_transactions || 0, 10);
  const custAdj = parseFloat(refundStats.cust_refunds || 0);

  const apptGross = parseFloat(apptStats.gross || 0);
  const apptTx = parseInt(apptStats.completed_transactions || 0, 10);
  const apptAdj = 0;

  // Compute Active Report KPIs based on report_type
  let reportGross = 0;
  let reportAdj = 0;
  let reportTx = 0;

  if (report_type === 'online') {
    reportGross = onlineGross;
    reportAdj = onlineAdj;
    reportTx = onlineTx;
  } else if (report_type === 'pos') {
    reportGross = walkInGross;
    reportAdj = walkInAdj;
    reportTx = walkInTx;
  } else if (report_type === 'customization') {
    reportGross = custGross;
    reportAdj = custAdj;
    reportTx = custTx;
  } else if (report_type === 'appointments') {
    reportGross = apptGross;
    reportAdj = apptAdj;
    reportTx = apptTx;
  } else if (report_type === 'refunds') {
    reportGross = parseFloat(refundStats.total_refunds || 0) + walkInAdj;
    reportAdj = reportGross;
    reportTx = parseInt(refundStats.refund_count || 0, 10) + parseInt(walkInStats.adjustment_count || 0, 10);
  } else {
    // all
    reportGross = walkInGross + onlineGross + custGross + apptGross;
    reportAdj = walkInAdj + onlineAdj + custAdj;
    reportTx = walkInTx + onlineTx + custTx + apptTx;
  }

  const reportNet = reportGross - reportAdj;
  const avgTx = reportTx > 0 ? reportGross / reportTx : 0;
  const adjRate = reportGross > 0 ? (reportAdj / reportGross) * 100 : 0;

  // Format transactions
  const formattedTransactions = (txItems || []).map((t) => ({
    id: t.id,
    transaction_number: t.transaction_number,
    date: t.date ? new Date(t.date).toISOString() : null,
    channel: t.channel,
    customer_name: t.customer_name || 'Guest / Walk-in',
    customer_email: t.customer_email || null,
    customer_phone: t.customer_phone || null,
    status: t.status,
    payment_status: t.payment_status || null,
    payment_method: t.payment_method || 'gcash',
    item_count: t.item_count !== undefined ? parseInt(t.item_count, 10) : null,
    subtotal: parseFloat(t.subtotal || 0),
    discount_amount: parseFloat(t.discount_amount || 0),
    shipping_cost: parseFloat(t.shipping_cost || 0),
    tax_amount: parseFloat(t.tax_amount || 0),
    gross_amount: parseFloat(t.gross_amount || 0),
    adjustment_amount: parseFloat(t.adjustment_amount || 0),
    net_amount: parseFloat(t.net_amount || 0),
    staff_name: t.staff_name || null,
    staff_id: t.staff_id || null,
    adjustment_type: t.adjustment_type || null,
    related_number: t.related_number || null,
    reason: t.reason || null,
    notes: t.notes || null,
  }));

  // Daily Trend formatted
  const formattedDailyTrend = (dailyTrendR.rows || []).map((r) => ({
    date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    revenue: parseFloat(r.gross || 0),
    gross: parseFloat(r.gross || 0),
    net: parseFloat(r.gross || 0),
    transactions: parseInt(r.transactions || 0, 10),
  }));

  return {
    reportType: report_type,
    summary: {
      grossSales: Number(reportGross.toFixed(2)),
      totalAdjustments: Number(reportAdj.toFixed(2)),
      netSales: Number(reportNet.toFixed(2)),
      totalTransactions: reportTx,
      averagePerTransaction: Number(avgTx.toFixed(2)),
      adjustmentRate: Number(adjRate.toFixed(1)),
    },
    // Top-level legacy fields for backwards compatibility with widgets
    grossSales: Number(reportGross.toFixed(2)),
    totalAdjustments: Number(reportAdj.toFixed(2)),
    netSales: Number(reportNet.toFixed(2)),
    totalTransactions: reportTx,
    averagePerTransaction: Number(avgTx.toFixed(2)),
    customizationOrders: custTx,
    channels: {
      walkIn: {
        gross: Number(walkInGross.toFixed(2)),
        adjustments: Number(walkInAdj.toFixed(2)),
        net: Number((walkInGross - walkInAdj).toFixed(2)),
        transactions: walkInTx,
      },
      online: {
        gross: Number(onlineGross.toFixed(2)),
        adjustments: Number(onlineAdj.toFixed(2)),
        net: Number((onlineGross - onlineAdj).toFixed(2)),
        transactions: onlineTx,
      },
      customization: {
        gross: Number(custGross.toFixed(2)),
        adjustments: Number(custAdj.toFixed(2)),
        net: Number((custGross - custAdj).toFixed(2)),
        transactions: custTx,
      },
      appointments: {
        gross: Number(apptGross.toFixed(2)),
        adjustments: 0,
        net: Number(apptGross.toFixed(2)),
        transactions: apptTx,
      },
    },
    dailyTrend: formattedDailyTrend,
    transactions: formattedTransactions,
    pagination: {
      page: numPage,
      limit: numLimit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / numLimit) || 1,
    },
    metadata: {
      staffList: (staffListR.rows || []).map((s) => ({
        id: s.user_id,
        name: s.name || 'Staff Member',
        role: s.role,
      })),
      reportType: report_type,
    },
  };
}

async function getSalesCustomerBreakdown(filters = {}) {
  const {
    start_date, end_date, group_by = 'category',
    channel, status, payment_status, payment_method, order_type, region, salesperson,
  } = filters;
  const groupBy = ['product', 'category', 'region', 'salesperson', 'status', 'payment_status', 'channel', 'payment_method'].includes(group_by)
    ? group_by
    : 'category';
  const groupExpressions = {
    region: 'region',
    salesperson: 'salesperson',
    status: 'status',
    payment_status: 'payment_status',
    channel: 'channel',
    payment_method: 'payment_method',
  };
  const params = [
    parseDate(start_date),
    parseDate(end_date),
    status || null,
    payment_status || null,
    payment_method || null,
    channel || null,
    order_type || null,
    region || null,
    salesperson || null,
  ];
  const filtersSql = `
    ($1::timestamptz IS NULL OR sale_date >= $1::timestamptz)
    AND ($2::timestamptz IS NULL OR sale_date < $2::date + INTERVAL '1 day')
    AND ($3::text IS NULL OR status = $3)
    AND ($4::text IS NULL OR payment_status = $4)
    AND ($5::text IS NULL OR payment_method = $5)
    AND ($6::text IS NULL OR channel = $6)
    AND ($7::text IS NULL OR order_type = $7)
    AND ($8::text IS NULL OR region ILIKE '%' || $8 || '%')
    AND ($9::text IS NULL OR salesperson ILIKE '%' || $9 || '%')`;

  const salesCte = `WITH sales AS (
    SELECT
      'order' AS source_type, o.order_id::text AS source_id, o.order_id::text AS event_id,
      COALESCE(o.user_id::text, 'guest-order:' || o.order_id::text) AS customer_id,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), 'Guest customer') AS customer_name,
      o.created_at AS sale_date,
      ${orderRevenueExpr('o')}::numeric AS amount,
      CASE WHEN o.order_type = 'customization' THEN 'customization' ELSE 'online' END AS channel,
      o.order_type::text AS order_type,
      o.status::text AS status,
      o.payment_status::text AS payment_status,
      COALESCE((SELECT p.method::text FROM payments p WHERE p.order_id = o.order_id AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 1), 'unknown') AS payment_method,
      COALESCE(NULLIF(CONCAT_WS(', ', addr.city, addr.province), ''), 'Unknown') AS region,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', staff.first_name, staff.last_name)), ''), 'Unassigned') AS salesperson,
      o.shipping_address_id::text AS address_id,
      o.reviewed_by::text AS salesperson_id
    FROM orders o
    LEFT JOIN users u ON u.user_id = o.user_id
    LEFT JOIN addresses addr ON addr.address_id = o.shipping_address_id AND addr.deleted_at IS NULL
    LEFT JOIN users staff ON staff.user_id = o.reviewed_by
    WHERE o.deleted_at IS NULL AND o.status != 'cancelled' AND o.payment_status = 'approved'

    UNION ALL

    SELECT
      'pos' AS source_type, ps.sale_id::text AS source_id, ps.sale_id::text AS event_id,
      'pos:' || COALESCE(NULLIF(ps.customer_phone, ''), LOWER(NULLIF(ps.customer_name, '')), ps.sale_id::text) AS customer_id,
      COALESCE(NULLIF(BTRIM(ps.customer_name), ''), 'Walk-in customer') AS customer_name,
      ps.created_at AS sale_date,
      (ps.total_amount - ps.discount_amount)::numeric AS amount,
      'walk_in' AS channel, 'product'::text AS order_type,
      ps.status::text AS status, ps.payment_status::text AS payment_status,
      ps.payment_method::text AS payment_method, 'Walk-in / POS'::text AS region,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', staff.first_name, staff.last_name)), ''), 'Unassigned') AS salesperson,
      NULL::text AS address_id, ps.staff_id::text AS salesperson_id
    FROM pos_sales ps
    LEFT JOIN users staff ON staff.user_id = ps.staff_id
    WHERE ps.deleted_at IS NULL AND ps.status = 'completed' AND ps.payment_status = 'verified'

    UNION ALL

    SELECT
      'appointment' AS source_type, a.appointment_id::text AS source_id, a.appointment_id::text AS event_id,
      COALESCE(a.user_id::text, 'appointment:' || LOWER(a.customer_email)) AS customer_id,
      COALESCE(NULLIF(BTRIM(a.customer_name), ''), 'Appointment customer') AS customer_name,
      a.scheduled_at AS sale_date,
      COALESCE((SELECT SUM(s.price) FROM services s WHERE s.service_id::text IN (SELECT jsonb_array_elements_text(a.services))), 0)::numeric AS amount,
      'appointments' AS channel, 'service'::text AS order_type,
      a.status::text AS status, a.payment_status::text AS payment_status,
      CASE WHEN a.payment_method IN ('e_wallet') THEN 'gcash' WHEN a.payment_method IN ('e_bank') THEN 'bank_transfer' ELSE COALESCE(a.payment_method, 'unknown') END AS payment_method,
      'Unknown'::text AS region, 'Unassigned'::text AS salesperson,
      NULL::text AS address_id, NULL::text AS salesperson_id
    FROM appointments a
    WHERE a.deleted_at IS NULL AND a.status != 'cancelled' AND a.payment_method IS NOT NULL
  ), customer_items AS (
    SELECT s.*, COALESCE(p.name, oi.product_name, 'Product') AS product_name,
           COALESCE(cat.name, 'Uncategorized') AS category_name,
           cat.category_id::text AS item_category_id,
           (oi.quantity * oi.unit_price)::numeric AS item_amount
    FROM sales s
    JOIN order_items oi ON s.source_type = 'order' AND oi.order_id::text = s.source_id AND oi.deleted_at IS NULL
    LEFT JOIN products p ON p.product_id = oi.product_id
    LEFT JOIN categories cat ON cat.category_id = p.category_id

    UNION ALL

    SELECT s.*, COALESCE(p.name, psi.item_name, 'Product') AS product_name,
           COALESCE(cat.name, 'Uncategorized') AS category_name,
           cat.category_id::text AS item_category_id,
           COALESCE(psi.subtotal, psi.quantity * psi.unit_price)::numeric AS item_amount
    FROM sales s
    JOIN pos_sale_items psi ON s.source_type = 'pos' AND psi.sale_id::text = s.source_id AND psi.deleted_at IS NULL
    LEFT JOIN products p ON p.product_id = psi.product_id
    LEFT JOIN categories cat ON cat.category_id = p.category_id

    UNION ALL

    SELECT s.*, COALESCE(sv.name, 'Service') AS product_name,
           'Services'::text AS category_name, NULL::text AS item_category_id,
           COALESCE(sv.price, 0)::numeric AS item_amount
    FROM sales s
    JOIN appointments a ON s.source_type = 'appointment' AND a.appointment_id::text = s.source_id
    CROSS JOIN LATERAL (
      SELECT service.name, service.price
      FROM services service
      WHERE service.service_id::text IN (SELECT jsonb_array_elements_text(a.services))
    ) sv
  )`;

  const groupExpr = groupExpressions[groupBy] || (groupBy === 'product' ? 'product_name' : 'category_name');
  const source = ['product', 'category'].includes(groupBy) ? 'customer_items' : 'sales';
  const amountExpr = source === 'customer_items' ? 'item_amount' : 'amount';
  const groupWhere = groupBy === 'category' && filters.category_id
    ? ' AND item_category_id = $10'
    : '';
  if (groupWhere) params.push(String(filters.category_id));

  const result = await pool.query(
    `${salesCte}
     SELECT ${groupExpr} AS group_value,
            customer_id, customer_name,
            COUNT(DISTINCT event_id)::int AS orders,
            COALESCE(SUM(${amountExpr}), 0)::numeric AS total_sales,
            MAX(sale_date) AS last_purchase_date
     FROM ${source}
     WHERE ${filtersSql}${groupWhere}
     GROUP BY ${groupExpr}, customer_id, customer_name
     ORDER BY group_value, total_sales DESC, customer_name`,
    params
  );

  return {
    group_by: groupBy,
    customers: result.rows.map((row) => ({
      group: row.group_value || 'Unknown',
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      orders: parseInt(row.orders || 0, 10),
      total_sales: parseFloat(row.total_sales || 0),
      last_purchase_date: row.last_purchase_date,
    })),
  };
}

async function getCustomizationReport(filters = {}) {
  const { start_date, end_date } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date), 'c.created_at');
  conditions.push('c.deleted_at IS NULL');
  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [byBuildResult, byTypeResult, summaryResult] = await Promise.all([
    pool.query(
      `SELECT c.guitar_type, c.name,
              COUNT(c.customization_id)::int as total_customizations,
              COALESCE(SUM(c.total_price), 0)::numeric as total_value,
              COALESCE(AVG(c.total_price), 0)::numeric as avg_value
       FROM customizations c
       ${whereClause}
       GROUP BY c.guitar_type, c.name
       ORDER BY total_customizations DESC, total_value DESC`,
      params
    ),
    pool.query(
      `SELECT c.guitar_type,
              COUNT(c.customization_id)::int as total_customizations,
              COALESCE(SUM(c.total_price), 0)::numeric as total_revenue,
              COALESCE(AVG(c.total_price), 0)::numeric as avg_price
       FROM customizations c
       ${whereClause}
       GROUP BY c.guitar_type
       ORDER BY total_revenue DESC`,
      params
    ),
    pool.query(
      `SELECT 
          COUNT(*)::int as total,
          COALESCE(SUM(total_price), 0)::numeric as total_revenue,
          COALESCE(AVG(total_price), 0)::numeric as avg_price
       FROM customizations c
       ${whereClause}`,
      params
    )
  ]);

  const summary = summaryResult.rows[0] || {};
  const totalRev = parseFloat(summary.total_revenue || 0);

  return {
    data: (byBuildResult.rows || []).map(r => ({
      guitar_type: r.guitar_type,
      name: r.name,
      total_customizations: parseInt(r.total_customizations || 0, 10),
      total_value: parseFloat(r.total_value || 0),
      avg_value: parseFloat(r.avg_value || 0),
    })),
    by_guitar_type: (byTypeResult.rows || []).map(r => ({
      guitar_type: r.guitar_type,
      total_customizations: parseInt(r.total_customizations || 0, 10),
      total_revenue: parseFloat(r.total_revenue || 0),
      avg_price: parseFloat(r.avg_price || 0),
      percentage: totalRev > 0 ? Number(((parseFloat(r.total_revenue || 0) / totalRev) * 100).toFixed(1)) : 0,
    })),
    summary: {
      total: parseInt(summary.total || 0, 10),
      total_revenue: totalRev,
      avg_price: parseFloat(summary.avg_price || 0),
    },
  };
}


async function getPaymentMethodAnalysis(filters = {}) {
  const { start_date, end_date, order_type, payment_method, status, payment_status } = filters;

  const startDate = parseDate(start_date);
  const endDate = parseDate(end_date);

  const orderRange = buildDateFilter(startDate, endDate, 'o.created_at');
  const appointmentRange = buildDateFilter(startDate, endDate, 'a.scheduled_at');

  const effectiveOrderStatus = status || 'delivered';
  const effectiveOrderPaymentStatus = payment_status || 'approved';
  const effectiveApptStatus = status || 'completed';
  const effectiveApptPaymentStatus = payment_status || 'approved';

  const orderPaymentFilterClauses = [];
  const orderPaymentFilterParams = [];
  let orderPaymentFilterIdx = 1;
  if (status) { orderPaymentFilterClauses.push(`o.status = $${orderPaymentFilterIdx++}`); orderPaymentFilterParams.push(status); }
  if (payment_status) { orderPaymentFilterClauses.push(`o.payment_status = $${orderPaymentFilterIdx++}`); orderPaymentFilterParams.push(payment_status); }
  if (order_type) { orderPaymentFilterClauses.push(`o.order_type = $${orderPaymentFilterIdx++}`); orderPaymentFilterParams.push(order_type); }
  if (payment_method) { orderPaymentFilterClauses.push(`p.method::text = $${orderPaymentFilterIdx++}`); orderPaymentFilterParams.push(payment_method); }
  const orderPaymentFilterSql = orderPaymentFilterClauses.length > 0 ? `AND ${orderPaymentFilterClauses.join(' AND ')}` : '';

  const apptPaymentFilterClauses = [];
  const apptPaymentFilterParams = [];
  let apptPaymentFilterIdx = 1;
  if (status) { apptPaymentFilterClauses.push(`a.status = $${apptPaymentFilterIdx++}`); apptPaymentFilterParams.push(status); }
  if (payment_status) { apptPaymentFilterClauses.push(`a.payment_status = $${apptPaymentFilterIdx++}`); apptPaymentFilterParams.push(payment_status); }
  if (payment_method) {
    apptPaymentFilterClauses.push(`(
      CASE
        WHEN a.payment_method IN ('cash') THEN 'cash'
        WHEN a.payment_method IN ('gcash', 'e_wallet') THEN 'gcash'
        WHEN a.payment_method IN ('bank_transfer', 'e_bank') THEN 'bank_transfer'
        ELSE a.payment_method
      END
    ) = $${apptPaymentFilterIdx++}`);
    apptPaymentFilterParams.push(payment_method);
  }
  const apptPaymentFilterSql = apptPaymentFilterClauses.length > 0 ? `AND ${apptPaymentFilterClauses.join(' AND ')}` : '';

  const renum = (conditions, startIdx) => {
    let i = startIdx;
    return conditions.map(c => c.replace(/\$\d+/g, () => `$${i++}`));
  };

  const [orderPaymentsR, apptPaymentsR] = await Promise.all([
    pool.query(
      `SELECT p.method::text AS method,
              COUNT(DISTINCT o.order_id)::int AS transactions,
              COALESCE(SUM(p.amount), 0)::numeric AS amount
       FROM payments p
       JOIN orders o ON o.order_id = p.order_id
       WHERE p.status = 'verified'
         AND p.deleted_at IS NULL AND o.deleted_at IS NULL
         AND p.method::text IN ('gcash', 'bank_transfer')
         ${orderPaymentFilterSql}
         ${orderRange.conditions.length > 0 ? 'AND ' + renum(orderRange.conditions, orderPaymentFilterIdx).join(' AND ') : ''}
       GROUP BY p.method
       ORDER BY amount DESC`,
      [...orderPaymentFilterParams, ...orderRange.params]
    ),
    pool.query(
      `SELECT (
                CASE
                  WHEN a.payment_method IN ('cash') THEN 'cash'
                  WHEN a.payment_method IN ('gcash', 'e_wallet') THEN 'gcash'
                  WHEN a.payment_method IN ('bank_transfer', 'e_bank') THEN 'bank_transfer'
                  ELSE a.payment_method
                END
              ) AS method,
              COUNT(DISTINCT a.appointment_id)::int AS transactions,
              COALESCE(SUM(s.price), 0)::numeric AS amount
       FROM appointments a
       JOIN services s ON s.service_id::text IN (
         SELECT jsonb_array_elements_text(a.services)
       )
       WHERE a.deleted_at IS NULL AND a.payment_method IS NOT NULL
         ${apptPaymentFilterSql}
         ${appointmentRange.conditions.length > 0 ? 'AND ' + renum(appointmentRange.conditions, apptPaymentFilterIdx).join(' AND ') : ''}
       GROUP BY 1
       ORDER BY amount DESC`,
      [...apptPaymentFilterParams, ...appointmentRange.params]
    )
  ]);

  const orderMethods = (orderPaymentsR.rows || []).map(r => ({
    method: r.method,
    transactions: parseInt(r.transactions || 0, 10),
    amount: parseFloat(r.amount || 0),
  }));
  const totalOrderAmount = orderMethods.reduce((s, m) => s + m.amount, 0);
  const totalOrderTransactions = orderMethods.reduce((s, m) => s + m.transactions, 0);

  const apptMethods = (apptPaymentsR.rows || []).map(r => ({
    method: r.method,
    transactions: parseInt(r.transactions || 0, 10),
    amount: parseFloat(r.amount || 0),
  }));
  const totalApptAmount = apptMethods.reduce((s, m) => s + m.amount, 0);
  const totalApptTransactions = apptMethods.reduce((s, m) => s + m.transactions, 0);

  return {
    overall: {
      methods: orderMethods.map(m => ({
        ...m,
        percentage: totalOrderAmount > 0 ? Number(((m.amount / totalOrderAmount) * 100).toFixed(1)) : 0,
        average_transaction: m.transactions > 0 ? Number((m.amount / m.transactions).toFixed(2)) : 0,
      })),
      total_amount: Number(totalOrderAmount.toFixed(2)),
      total_transactions: totalOrderTransactions,
      average_transaction: totalOrderTransactions > 0 ? Number((totalOrderAmount / totalOrderTransactions).toFixed(2)) : 0,
    },
    appointments: {
      methods: apptMethods.map(m => ({
        ...m,
        percentage: totalApptAmount > 0 ? Number(((m.amount / totalApptAmount) * 100).toFixed(1)) : 0,
        average_transaction: m.transactions > 0 ? Number((m.amount / m.transactions).toFixed(2)) : 0,
      })),
      total_amount: Number(totalApptAmount.toFixed(2)),
      total_transactions: totalApptTransactions,
      average_transaction: totalApptTransactions > 0 ? Number((totalApptAmount / totalApptTransactions).toFixed(2)) : 0,
    },
  };
}

async function exportReport(reportType, filters = {}) {
  let data;
  switch (reportType) {
    case 'orders': data = await getOrderReport(filters); break;
    case 'payments': data = await getPaymentReport(filters); break;
    case 'appointments': data = await getAppointmentReport({ start_date: filters.start_date, end_date: filters.end_date, status: filters.status, payment_method: filters.payment_method }); break;
    case 'products': data = await getProductReport(filters); break;
    case 'users': data = await getUserReport(filters); break;
    case 'revenue': data = await getRevenueReport(filters); break;
    default: throw new AppError('Invalid report type', 400);
  }
  return data;
}

module.exports = {
  getOrderReport,
  getPaymentReport,
  getAppointmentReport,
  getServiceReport,
  getProductReport,
  getCartReport,
  getUserReport,
  getDashboardSummary,
  getSalesReport,
  getSalesCustomerBreakdown,
  getRevenueReport,
  getCustomizationReport,
  getPaymentMethodAnalysis,
  exportReport,
};

