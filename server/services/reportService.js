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
    order_type, payment_method, category_id,
    status, payment_status
  } = filters;

  const startDate = parseDate(start_date);
  const endDate = parseDate(end_date);

  const posRange = buildDateFilter(startDate, endDate, 'ps.created_at');
  const posAdjustmentRange = buildDateFilter(startDate, endDate, 'ps.created_at');
  const orderRange = buildDateFilter(startDate, endDate, 'o.created_at');
  const orderAdjustmentRange = buildDateFilter(startDate, endDate, 'o.created_at');
  const customizationAdjustmentRange = buildDateFilter(startDate, endDate, 'o.created_at');
  const appointmentRange = buildDateFilter(startDate, endDate, 'a.scheduled_at');
  const appointmentAdjustmentRange = buildDateFilter(startDate, endDate, 'a.scheduled_at');
  const refundRange = buildDateFilter(startDate, endDate, 'rr.created_at');
  const posReturnRange = buildDateFilter(startDate, endDate, 'pr.created_at');
  const itemsRange = buildDateFilter(startDate, endDate, 'src.created_at');

  const hasDateRange = !!(startDate || endDate);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const revenue = (alias) => orderRevenueExpr(alias);

  // Build order-level dynamic filters
  // $1 and $2 are reserved for effectiveOrderStatus and effectiveOrderPaymentStatus
  const orderFilterClauses = [];
  const orderFilterParams = [];
  let orderFilterIdx = 3;
  const effectiveOrderStatus = status || 'delivered';
  const effectiveOrderPaymentStatus = payment_status || 'approved';

  if (order_type) {
    orderFilterClauses.push(`o.order_type = $${orderFilterIdx++}`);
    orderFilterParams.push(order_type);
  }
  const orderFilterSql = orderFilterClauses.length > 0 ? `AND ${orderFilterClauses.join(' AND ')}` : '';

  // Build appointment-level dynamic filters
  // $1 and $2 are reserved for effectiveApptStatus and effectiveApptPaymentStatus
  const apptFilterClauses = [];
  const apptFilterParams = [];
  let apptFilterIdx = 3;
  const effectiveApptStatus = status || 'completed';
  const effectiveApptPaymentStatus = payment_status || 'approved';

  if (payment_method) {
    apptFilterClauses.push(`a.payment_method = $${apptFilterIdx++}`);
    apptFilterParams.push(payment_method);
  }
  const apptFilterSql = apptFilterClauses.length > 0 ? `AND ${apptFilterClauses.join(' AND ')}` : '';

  const dailyWeeklyMonthlyPromise = hasDateRange
    ? Promise.resolve({ rows: [{}] })
    : pool.query(
        `SELECT
            COALESCE(SUM(${revenue('o')}), 0)::numeric AS dailySales,
            COUNT(CASE WHEN created_at >= $1 THEN 1 END)::int AS dailyTransactions,
            COALESCE(SUM(${revenue('o')}), 0)::numeric AS weeklySales,
            COUNT(CASE WHEN created_at >= $2 THEN 1 END)::int AS weeklyTransactions,
            COALESCE(SUM(${revenue('o')}), 0)::numeric AS monthlySales,
            COUNT(CASE WHEN created_at >= $3 THEN 1 END)::int AS monthlyTransactions
         FROM orders o
         WHERE status = $4 AND payment_status = $5`,
        [todayStart, weekStart, monthStart, effectiveOrderStatus, effectiveOrderPaymentStatus]
      );

  const [
    walkInSummary,
    walkInAdjustmentsResult,
    onlineSummary,
    onlineAdjustmentsResult,
    customizationSummary,
    customizationAdjustmentsResult,
    appointmentSummary,
    appointmentAdjustmentsResult,
    adjustmentsByTypeResult,
    adjustmentsByChannelResult,
    dailyTrendResult,
    bestSellingProductsResult,
    topAdjustedProductsResult,
    refundReasonsResult,
    appointmentPaymentMethodsResult,
    dailyWeeklyMonthlyResult,
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(${revenue('ps')}), 0)::numeric AS gross
       FROM pos_sales ps
       WHERE ps.status = 'completed' AND ps.payment_status = 'verified'
         ${posRange.conditions.length > 0 ? 'AND ' + posRange.conditions.join(' AND ') : ''}`,
      posRange.params
    ),
    pool.query(
      `SELECT COALESCE(SUM(refund_amount), 0)::numeric AS adjustments
       FROM pos_sales
       WHERE status IN ('voided', 'returned')
         ${posAdjustmentRange.conditions.length > 0 ? 'AND ' + posAdjustmentRange.conditions.join(' AND ') : ''}`,
      posAdjustmentRange.params
    ),
    pool.query(
      `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(${revenue('o')}), 0)::numeric AS gross
       FROM orders o
       WHERE o.status = $1 AND o.payment_status = $2
         AND NOT EXISTS (
           SELECT 1 FROM order_items oi
           WHERE oi.order_id::text = o.order_id::text AND oi.customization_id IS NOT NULL
         )
         ${orderFilterSql}
         ${orderRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}`,
      [effectiveOrderStatus, effectiveOrderPaymentStatus, ...orderFilterParams, ...orderRange.params]
    ),
    pool.query(
      `SELECT COALESCE(SUM(COALESCE(rr.amount_requested, 0)), 0)::numeric AS adjustments
       FROM orders o
       LEFT JOIN refund_requests rr ON (
         rr.order_id = o.order_id
         AND rr.status IN ('approved', 'refunded', 'processing')
       )
        WHERE o.status = $1 AND o.payment_status = $2
          AND NOT EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id::text = o.order_id::text AND oi.customization_id IS NOT NULL
          )
          ${orderFilterSql}
          ${orderAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderAdjustmentRange.conditions, orderFilterIdx).join(' AND ') : ''}`,
      [effectiveOrderStatus, effectiveOrderPaymentStatus, ...orderFilterParams, ...orderAdjustmentRange.params]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(${revenue('o')}), 0)::numeric AS gross
       FROM orders o
       WHERE o.status = $1 AND o.payment_status = $2
         AND EXISTS (
           SELECT 1 FROM order_items oi
           WHERE oi.order_id::text = o.order_id::text AND oi.customization_id IS NOT NULL
         )
         ${orderFilterSql}
         ${orderRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}`,
      [effectiveOrderStatus, effectiveOrderPaymentStatus, ...orderFilterParams, ...orderRange.params]
    ),
    pool.query(
      `SELECT COALESCE(SUM(COALESCE(rr.amount_requested, 0)), 0)::numeric AS adjustments
       FROM orders o
       LEFT JOIN refund_requests rr ON (
         (rr.order_id = o.order_id OR (rr.project_id IS NOT NULL AND rr.project_id IN (SELECT project_id FROM projects WHERE order_id = o.order_id)))
         AND rr.status IN ('approved', 'refunded', 'processing')
       )
        WHERE o.status = $1 AND o.payment_status = $2
          AND EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id::text = o.order_id::text AND oi.customization_id IS NOT NULL
          )
          ${orderFilterSql}
          ${customizationAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(customizationAdjustmentRange.conditions, orderFilterIdx).join(' AND ') : ''}`,
      [effectiveOrderStatus, effectiveOrderPaymentStatus, ...orderFilterParams, ...customizationAdjustmentRange.params]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(s.price), 0)::numeric AS gross
       FROM appointments a
       JOIN services s ON s.service_id::text IN (
         SELECT jsonb_array_elements_text(a.services)
       )
       WHERE a.status = $1 AND a.payment_status = $2 AND a.payment_method IS NOT NULL
         ${apptFilterSql}
         ${appointmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(appointmentRange.conditions, apptFilterIdx).join(' AND ') : ''}`,
      [effectiveApptStatus, effectiveApptPaymentStatus, ...apptFilterParams, ...appointmentRange.params]
    ),
    pool.query(
      `SELECT 'void' AS type, COUNT(*)::int AS count, COALESCE(SUM(refund_amount), 0)::numeric AS amount
       FROM pos_sales WHERE status = 'voided'
         ${posAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(posAdjustmentRange.conditions, 1).join(' AND ') : ''}
       UNION ALL
       SELECT 'return', COUNT(*)::int, COALESCE(SUM(refund_amount), 0)
       FROM pos_sales WHERE status = 'returned'
         ${posAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(posAdjustmentRange.conditions, posAdjustmentRange.params.length + 1).join(' AND ') : ''}
       UNION ALL
        SELECT 'refund', COUNT(*)::int, COALESCE(SUM(COALESCE(amount_requested, 0)), 0)
       FROM refund_requests WHERE status IN ('approved', 'refunded', 'processing')
         ${refundRange.conditions.length > 0 ? 'AND ' + renumberConditions(refundRange.conditions, posAdjustmentRange.params.length * 2 + 1).join(' AND ') : ''}`,
      [...posAdjustmentRange.params, ...posAdjustmentRange.params, ...refundRange.params]
    ),
    pool.query(
      `SELECT 'walkIn' AS channel, COUNT(*)::int AS count, COALESCE(SUM(refund_amount), 0)::numeric AS amount
       FROM pos_sales WHERE status IN ('voided', 'returned')
         ${posAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(posAdjustmentRange.conditions, 1).join(' AND ') : ''}
        UNION ALL
       SELECT 'online', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.amount_requested, 0)), 0)
       FROM refund_requests rr
       JOIN orders o ON rr.order_id = o.order_id
        WHERE rr.status IN ('approved', 'refunded', 'processing')
          AND o.payment_status = '${effectiveOrderPaymentStatus}'
          AND NOT EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id::text = o.order_id::text AND oi.customization_id IS NOT NULL
          )
         ${orderAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderAdjustmentRange.conditions, posAdjustmentRange.params.length + 1).join(' AND ') : ''}
        UNION ALL
       SELECT 'customization', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.amount_requested, 0)), 0)
       FROM refund_requests rr
       JOIN orders o ON rr.order_id = o.order_id
        WHERE rr.status IN ('approved', 'refunded', 'processing')
          AND o.payment_status = '${effectiveOrderPaymentStatus}'
          AND EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id::text = o.order_id::text AND oi.customization_id IS NOT NULL
          )
         ${orderAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderAdjustmentRange.conditions, posAdjustmentRange.params.length + orderAdjustmentRange.params.length + 1).join(' AND ') : ''}
        UNION ALL
        SELECT 'appointments', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.amount_requested, 0)), 0)
        FROM refund_requests rr
        JOIN appointments a ON a.order_id = rr.order_id
         WHERE rr.status IN ('approved', 'refunded', 'processing')
           AND a.payment_status = '${effectiveApptPaymentStatus}'
         ${appointmentAdjustmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(appointmentAdjustmentRange.conditions, posAdjustmentRange.params.length + orderAdjustmentRange.params.length * 2 + 1).join(' AND ') : ''}`,
      [...posAdjustmentRange.params, ...orderAdjustmentRange.params, ...orderAdjustmentRange.params, ...appointmentAdjustmentRange.params]
    ),
    pool.query(
      `WITH daily_sales AS (
         SELECT DATE_TRUNC('day', created_at) AS day, ${revenue('o')} AS revenue, 1 AS tx
         FROM orders o
         WHERE o.status = $1 AND o.payment_status = $2
           ${orderRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderRange.conditions, 3).join(' AND ') : ''}
         UNION ALL
         SELECT DATE_TRUNC('day', created_at) AS day, ${revenue('ps')} AS revenue, 1 AS tx
         FROM pos_sales ps
         WHERE status = 'completed' AND payment_status = 'verified'
           ${posRange.conditions.length > 0 ? 'AND ' + renumberConditions(posRange.conditions, orderRange.params.length + 1).join(' AND ') : ''}
       )
       SELECT day AS date,
              COALESCE(SUM(revenue), 0)::numeric AS revenue,
              COUNT(*)::int AS transactions
       FROM daily_sales
       GROUP BY day
       ORDER BY day ASC
       LIMIT 60`,
      [effectiveOrderStatus, effectiveOrderPaymentStatus, ...orderRange.params, ...posRange.params]
    ),
    pool.query(
      `WITH combined_sales AS (
         SELECT
           COALESCE(oi.product_id::text, oi.product_sku, oi.product_name) AS product_key,
           COALESCE(p.name, oi.product_name, 'Product') AS name,
           COALESCE(cat.name, 'Uncategorized') AS category,
           oi.quantity::int AS units,
           (oi.quantity * oi.unit_price * (1 - COALESCE(o.tax_amount, 0) / NULLIF(o.total_amount, 0)))::numeric AS revenue,
           o.created_at
         FROM order_items oi
         JOIN orders o ON o.order_id::text = oi.order_id::text
         LEFT JOIN products p ON p.product_id::text = oi.product_id::text
         LEFT JOIN categories cat ON cat.category_id = p.category_id
         WHERE o.status = $1 AND o.payment_status = $2
           AND oi.product_id IS NOT NULL
           ${orderFilterSql}
           ${orderRange.conditions.length > 0 ? 'AND ' + renumberConditions(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}

         UNION ALL

         SELECT
           COALESCE(psi.product_id::text, 'pos:' || psi.item_name) AS product_key,
           COALESCE(p.name, psi.item_name, 'Product') AS name,
           COALESCE(cat.name, 'Uncategorized') AS category,
           psi.quantity::int AS units,
           COALESCE(psi.subtotal, psi.quantity * psi.unit_price)::numeric AS revenue,
           ps.created_at
         FROM pos_sale_items psi
         JOIN pos_sales ps ON ps.sale_id::text = psi.sale_id::text
         LEFT JOIN products p ON p.product_id::text = psi.product_id::text
         LEFT JOIN categories cat ON cat.category_id = p.category_id
         WHERE ps.status = 'completed'
           AND psi.product_id IS NOT NULL
           ${posRange.conditions.length > 0 ? 'AND ' + renumberConditions(posRange.conditions, orderRange.params.length + 1).join(' AND ') : ''}
       )
       SELECT name, category, SUM(units)::int AS units, COALESCE(SUM(revenue), 0)::numeric AS revenue
       FROM combined_sales src
        WHERE 1 = 1${itemsRange.conditions.length ? ' AND ' + itemsRange.conditions.join(' AND ') : ''}
       GROUP BY product_key, name, category
       ORDER BY units DESC, revenue DESC
       LIMIT 10`,
      [effectiveOrderStatus, effectiveOrderPaymentStatus, ...orderFilterParams, ...orderRange.params, ...posRange.params, ...itemsRange.params]
    ),
    pool.query(
      `SELECT COALESCE(p.name, rri.product_name, 'Product') AS name,
              SUM(rri.quantity * rri.unit_price)::numeric AS adjustmentAmount,
              COALESCE(MAX(rr.reason), 'Return/Refund') AS reason
       FROM refund_request_items rri
       JOIN refund_requests rr ON rr.refund_request_id = rri.refund_request_id
       LEFT JOIN products p ON p.product_id::text = rri.product_id::text
       WHERE rr.status IN ('approved', 'refunded', 'processing')
         AND rri.deleted_at IS NULL
         ${refundRange.conditions.length > 0 ? 'AND ' + refundRange.conditions.join(' AND ') : ''}
       GROUP BY COALESCE(p.name, rri.product_name, 'Product')
       ORDER BY adjustmentAmount DESC
       LIMIT 10`,
      refundRange.params
    ),
    pool.query(
      `SELECT COALESCE(p.name, psi.item_name, 'Product') AS name,
              SUM(pr.quantity * psi.unit_price)::numeric AS adjustmentAmount,
              COALESCE(MAX(pr.reason), 'Return/Refund') AS reason
       FROM pos_returns pr
       JOIN pos_sale_items psi ON psi.item_id = pr.item_id
       LEFT JOIN products p ON p.product_id::text = psi.product_id::text
       WHERE 1 = 1
         ${posReturnRange.conditions.length > 0 ? 'AND ' + posReturnRange.conditions.join(' AND ') : ''}
       GROUP BY COALESCE(p.name, psi.item_name, 'Product')
       ORDER BY adjustmentAmount DESC
       LIMIT 10`,
      posReturnRange.params
    ),
    pool.query(
      `SELECT rr.reason,
              COUNT(*)::int AS count,
              COALESCE(SUM(COALESCE(rr.amount_requested, 0)), 0)::numeric AS amount
       FROM refund_requests rr
       WHERE rr.status IN ('approved', 'refunded', 'processing')
         AND rr.reason IS NOT NULL
         ${refundRange.conditions.length > 0 ? 'AND ' + refundRange.conditions.join(' AND ') : ''}
       GROUP BY rr.reason
       ORDER BY count DESC
       LIMIT 10`,
      refundRange.params
    ),
    pool.query(
      `SELECT a.payment_method AS method,
              COUNT(*)::int AS appointments,
              COALESCE(SUM(s.price), 0)::numeric AS revenue
       FROM appointments a
       JOIN services s ON s.service_id::text IN (
         SELECT jsonb_array_elements_text(a.services)
       )
       WHERE a.status = $1 AND a.payment_status = $2 AND a.payment_method IS NOT NULL
         ${apptFilterSql}
         ${appointmentRange.conditions.length > 0 ? 'AND ' + renumberConditions(appointmentRange.conditions, apptFilterIdx).join(' AND ') : ''}
       GROUP BY a.payment_method
       ORDER BY revenue DESC`,
      [effectiveApptStatus, effectiveApptPaymentStatus, ...apptFilterParams, ...appointmentRange.params]
    ),
    dailyWeeklyMonthlyPromise,
  ]);

  const walkInGross = parseFloat(walkInSummary.rows[0]?.gross || 0);
  const walkInTransactions = parseInt(walkInSummary.rows[0]?.transactions || 0, 10);
  const walkInAdjustments = parseFloat(walkInAdjustmentsResult.rows[0]?.adjustments || 0);
  const walkInNet = walkInGross - walkInAdjustments;

  const onlineGross = parseFloat(onlineSummary.rows[0]?.gross || 0);
  const onlineTransactions = parseInt(onlineSummary.rows[0]?.transactions || 0, 10);
  const onlineAdjustments = parseFloat(onlineAdjustmentsResult.rows[0]?.adjustments || 0);
  const onlineNet = onlineGross - onlineAdjustments;

  const customizationGross = parseFloat(customizationSummary.rows[0]?.gross || 0);
  const customizationTransactions = parseInt(customizationSummary.rows[0]?.transactions || 0, 10);
  const customizationAdjustments = parseFloat(customizationAdjustmentsResult.rows[0]?.adjustments || 0);
  const customizationNet = customizationGross - customizationAdjustments;

  const appointmentGross = parseFloat(appointmentSummary.rows[0]?.gross || 0);
  const appointmentTransactions = parseInt(appointmentSummary.rows[0]?.transactions || 0, 10);
  const appointmentAdjustments = parseFloat(appointmentAdjustmentsResult.rows[0]?.adjustments || 0);
  const appointmentNet = appointmentGross - appointmentAdjustments;

  const totalGrossSales = walkInGross + onlineGross + customizationGross + appointmentGross;
  const totalAdjustments = walkInAdjustments + onlineAdjustments + customizationAdjustments + appointmentAdjustments;
  const totalTransactions = walkInTransactions + onlineTransactions + customizationTransactions + appointmentTransactions;
  const netSales = totalGrossSales - totalAdjustments;

  const adjustmentRate = totalGrossSales > 0 ? Number(((totalAdjustments / totalGrossSales) * 100).toFixed(1)) : 0;

  const pct = (value, total) => (total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0);
  const avg = (value, count) => (count > 0 ? Number((value / count).toFixed(2)) : 0);

  const adjustmentsByType = (adjustmentsByTypeResult.rows || []).map((row) => ({
    type: row.type,
    count: parseInt(row.count || 0, 10),
    amount: parseFloat(row.amount || 0),
  }));

  const adjustmentsByChannel = (adjustmentsByChannelResult.rows || []).map((row) => ({
    channel: row.channel,
    count: parseInt(row.count || 0, 10),
    amount: parseFloat(row.amount || 0),
  }));

  const dailyTrend = (dailyTrendResult.rows || [])
    .filter((row) => row.date)
    .map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      revenue: parseFloat(row.revenue || 0),
      transactions: parseInt(row.transactions || 0, 10),
    }));

  const bestSellingProducts = (bestSellingProductsResult.rows || []).map((row) => ({
    name: row.name,
    units: parseInt(row.units || 0, 10),
    revenue: parseFloat(row.revenue || 0),
    category: row.category,
  }));

  const topAdjustedProducts = [
    ...(topAdjustedProductsResult.rows || []).map((row) => ({
      name: row.name,
      adjustmentAmount: parseFloat(row.adjustmentAmount || 0),
      reason: row.reason,
    })),
  ];

  const refundReasons = (refundReasonsResult.rows || []).map((row) => ({
    reason: row.reason,
    count: parseInt(row.count || 0, 10),
    amount: parseFloat(row.amount || 0),
  }));

  const appointmentPaymentMethods = (appointmentPaymentMethodsResult.rows || []).map((row) => ({
    method: row.method,
    appointments: parseInt(row.appointments || 0, 10),
    revenue: parseFloat(row.revenue || 0),
  }));

  let dailySales = 0;
  let dailyTransactions = 0;
  let weeklySales = 0;
  let weeklyTransactions = 0;
  let monthlySales = 0;
  let monthlyTransactions = 0;

  if (!hasDateRange) {
    const dailyWeeklyMonthly = dailyWeeklyMonthlyResult.rows[0] || {};
    dailySales = parseFloat(dailyWeeklyMonthly.dailySales || 0);
    dailyTransactions = parseInt(dailyWeeklyMonthly.dailyTransactions || 0, 10);
    weeklySales = parseFloat(dailyWeeklyMonthly.weeklySales || 0);
    weeklyTransactions = parseInt(dailyWeeklyMonthly.weeklyTransactions || 0, 10);
    monthlySales = parseFloat(dailyWeeklyMonthly.monthlySales || 0);
    monthlyTransactions = parseInt(dailyWeeklyMonthly.monthlyTransactions || 0, 10);
  }

  return {
    grossSales: Number(totalGrossSales.toFixed(2)),
    totalAdjustments: Number(totalAdjustments.toFixed(2)),
    netSales: Number(netSales.toFixed(2)),
    totalTransactions,
    averagePerTransaction: avg(totalGrossSales, totalTransactions),
    customizationOrders: customizationTransactions,
    channels: {
      walkIn: {
        gross: Number(walkInGross.toFixed(2)),
        adjustments: Number(walkInAdjustments.toFixed(2)),
        net: Number(walkInNet.toFixed(2)),
        transactions: walkInTransactions,
      },
      online: {
        gross: Number(onlineGross.toFixed(2)),
        adjustments: Number(onlineAdjustments.toFixed(2)),
        net: Number(onlineNet.toFixed(2)),
        transactions: onlineTransactions,
      },
      customization: {
        gross: Number(customizationGross.toFixed(2)),
        adjustments: Number(customizationAdjustments.toFixed(2)),
        net: Number(customizationNet.toFixed(2)),
        transactions: customizationTransactions,
      },
      appointments: {
        gross: Number(appointmentGross.toFixed(2)),
        adjustments: Number(appointmentAdjustments.toFixed(2)),
        net: Number(appointmentNet.toFixed(2)),
        transactions: appointmentTransactions,
      },
    },
    adjustmentsByType,
    adjustmentsByChannel,
    adjustmentRate,
    dailyTrend,
    bestSellingProducts,
    topAdjustedProducts,
    refundReasons,
    appointmentPaymentMethods,
    dailySales: Number(dailySales.toFixed(2)),
    dailyTransactions,
    weeklySales: Number(weeklySales.toFixed(2)),
    weeklyTransactions,
    monthlySales: Number(monthlySales.toFixed(2)),
    monthlyTransactions,
  };
}

async function getCustomizationReport(filters = {}) {
  const { start_date, end_date } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date));
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT c.guitar_type, c.name,
            COUNT(c.customization_id) as total_customizations,
            SUM(c.total_price) as total_value,
            AVG(c.total_price) as avg_value
     FROM customizations c
     ${whereClause}
     GROUP BY c.guitar_type, c.name
     ORDER BY total_customizations DESC`,
    params
  );

  const summary = await pool.query(
    `SELECT 
        COUNT(*) as total,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_price
     FROM customizations
     ${whereClause}`,
    params
  );

  return {
    data: result.rows,
    summary: summary.rows[0],
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
  getRevenueReport,
  getCustomizationReport,
  exportReport,
};
