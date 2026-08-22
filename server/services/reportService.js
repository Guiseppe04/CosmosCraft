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
    order_type, payment_method,
    status, payment_status
  } = filters;

  const startDate = parseDate(start_date);
  const endDate   = parseDate(end_date);

  const posRange              = buildDateFilter(startDate, endDate, 'ps.created_at');
  const orderRange            = buildDateFilter(startDate, endDate, 'o.created_at');
  const appointmentRange      = buildDateFilter(startDate, endDate, 'a.scheduled_at');
  const refundRange           = buildDateFilter(startDate, endDate, 'rr.created_at');

  const hasDateRange = !!(startDate || endDate);

  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const revenue = (alias) => orderRevenueExpr(alias);

  // Dynamic order-level status filters
  const orderStatusClauses = [];
  const orderStatusParams = [];
  let orderFilterIdx = 1;
  if (status) {
    orderStatusClauses.push(`o.status = $${orderFilterIdx++}`);
    orderStatusParams.push(status);
  } else {
    orderStatusClauses.push(`o.status != 'cancelled'`);
  }
  if (payment_status) {
    orderStatusClauses.push(`o.payment_status = $${orderFilterIdx++}`);
    orderStatusParams.push(payment_status);
  } else {
    orderStatusClauses.push(`o.payment_status = 'approved'`);
  }
  if (order_type) {
    orderStatusClauses.push(`o.order_type = $${orderFilterIdx++}`);
    orderStatusParams.push(order_type);
  }
  const orderFilterSql = orderStatusClauses.length > 0 ? `AND ${orderStatusClauses.join(' AND ')}` : '';

  // Dynamic appointment-level filters
  const apptFilterClauses = [];
  const apptFilterParams  = [];
  let apptFilterIdx = 1;
  if (status) {
    apptFilterClauses.push(`a.status = $${apptFilterIdx++}`);
    apptFilterParams.push(status);
  } else {
    apptFilterClauses.push(`a.status != 'cancelled'`);
  }
  if (payment_status) {
    apptFilterClauses.push(`a.payment_status = $${apptFilterIdx++}`);
    apptFilterParams.push(payment_status);
  }
  if (payment_method) {
    apptFilterClauses.push(`(
      CASE
        WHEN a.payment_method IN ('cash') THEN 'cash'
        WHEN a.payment_method IN ('gcash', 'e_wallet') THEN 'gcash'
        WHEN a.payment_method IN ('bank_transfer', 'e_bank') THEN 'bank_transfer'
        ELSE a.payment_method
      END
    ) = $${apptFilterIdx++}`);
    apptFilterParams.push(payment_method);
  }
  const apptFilterSql = apptFilterClauses.length > 0 ? `AND ${apptFilterClauses.join(' AND ')}` : '';

  // Helper to renumber params starting from a given index
  const renum = (conditions, startIdx) => {
    let i = startIdx;
    return conditions.map(c => c.replace(/\$\d+/g, () => `$${i++}`));
  };

  // ── Walk-in (POS) channel ──────────────────────────────────────────────────
  // Gross = completed+verified sales; Adjustments = total_amount of voided/returned sales
  const walkInGrossQ = pool.query(
    `SELECT COUNT(*)::int AS transactions,
            COALESCE(SUM(ps.total_amount - ps.discount_amount), 0)::numeric AS gross
     FROM pos_sales ps
     WHERE ps.status = 'completed' AND ps.payment_status = 'verified' AND ps.deleted_at IS NULL
       ${posRange.conditions.length > 0 ? 'AND ' + posRange.conditions.join(' AND ') : ''}`,
    posRange.params
  );

  const walkInAdjQ = pool.query(
    `SELECT COALESCE(SUM(ps.total_amount), 0)::numeric AS adjustments
     FROM pos_sales ps
     WHERE ps.status IN ('voided', 'returned') AND ps.deleted_at IS NULL
       ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, 1).join(' AND ') : ''}`,
    posRange.params
  );

  // ── Online orders channel ──────────────────────────────────────────────────
  // Online = paid product orders (no customization items)
  const onlineGrossQ = pool.query(
    `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(${revenue('o')}), 0)::numeric AS gross
     FROM orders o
     WHERE o.deleted_at IS NULL
       AND o.order_type = 'product'
       ${orderFilterSql}
       ${orderRange.conditions.length > 0 ? 'AND ' + renum(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}`,
    [...orderStatusParams, ...orderRange.params]
  );

  // Online adjustments: refund_requests joined to orders via rr.order_id
  const onlineAdjQ = pool.query(
    `SELECT COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)::numeric AS adjustments
     FROM refund_requests rr
     JOIN orders o ON o.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processed') AND o.order_type = 'product'
       AND o.deleted_at IS NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, 1).join(' AND ') : ''}`,
    refundRange.params
  );

  // ── Customization orders channel ───────────────────────────────────────────
  const custGrossQ = pool.query(
    `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(${revenue('o')}), 0)::numeric AS gross
     FROM orders o
     WHERE o.deleted_at IS NULL
       AND o.order_type = 'customization'
       ${orderFilterSql}
       ${orderRange.conditions.length > 0 ? 'AND ' + renum(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}`,
    [...orderStatusParams, ...orderRange.params]
  );

  const custAdjQ = pool.query(
    `SELECT COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)::numeric AS adjustments
     FROM refund_requests rr
     JOIN orders o ON o.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processed') AND o.order_type = 'customization'
       AND o.deleted_at IS NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, 1).join(' AND ') : ''}`,
    refundRange.params
  );

  // ── Appointments channel ───────────────────────────────────────────────────
  const apptGrossQ = pool.query(
    `SELECT COUNT(DISTINCT a.appointment_id)::int AS transactions,
            COALESCE(SUM(s.price), 0)::numeric AS gross
     FROM appointments a
     JOIN services s ON s.service_id::text IN (
       SELECT jsonb_array_elements_text(a.services)
     )
     WHERE a.deleted_at IS NULL AND a.payment_method IS NOT NULL
       ${apptFilterSql}
       ${appointmentRange.conditions.length > 0 ? 'AND ' + renum(appointmentRange.conditions, apptFilterIdx).join(' AND ') : ''}`,
    [...apptFilterParams, ...appointmentRange.params]
  );

  const apptAdjQ = pool.query(
    `SELECT COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)::numeric AS adjustments
     FROM refund_requests rr
     JOIN appointments a ON a.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processed')
       AND a.deleted_at IS NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, 1).join(' AND ') : ''}`,
    refundRange.params
  );

  // ── Adjustments by type ────────────────────────────────────────────────────
  const adjByTypeQ = pool.query(
    `SELECT 'void' AS type, COUNT(*)::int AS count, COALESCE(SUM(ps.total_amount), 0)::numeric AS amount
     FROM pos_sales ps WHERE ps.status = 'voided' AND ps.deleted_at IS NULL
       ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, 1).join(' AND ') : ''}
     UNION ALL
     SELECT 'return', COUNT(*)::int, COALESCE(SUM(ps.total_amount), 0)
     FROM pos_sales ps WHERE ps.status = 'returned' AND ps.deleted_at IS NULL
       ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, posRange.params.length + 1).join(' AND ') : ''}
     UNION ALL
     SELECT 'refund', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)
     FROM refund_requests rr
     WHERE rr.status IN ('approved', 'processed')
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, posRange.params.length * 2 + 1).join(' AND ') : ''}`,
    [...posRange.params, ...posRange.params, ...refundRange.params]
  );

  // ── Adjustments by channel ─────────────────────────────────────────────────
  const adjByChannelQ = pool.query(
    `SELECT 'walkIn' AS channel, COUNT(*)::int AS count, COALESCE(SUM(ps.total_amount), 0)::numeric AS amount
     FROM pos_sales ps WHERE ps.status IN ('voided', 'returned') AND ps.deleted_at IS NULL
       ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, 1).join(' AND ') : ''}
     UNION ALL
     SELECT 'online', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)
     FROM refund_requests rr
     JOIN orders o ON o.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processed') AND o.order_type = 'product'
       AND o.deleted_at IS NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, posRange.params.length + 1).join(' AND ') : ''}
     UNION ALL
     SELECT 'customization', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)
     FROM refund_requests rr
     JOIN orders o ON o.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processed') AND o.order_type = 'customization'
       AND o.deleted_at IS NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, posRange.params.length + refundRange.params.length + 1).join(' AND ') : ''}
     UNION ALL
     SELECT 'appointments', COUNT(*)::int, COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)
     FROM refund_requests rr
     JOIN appointments a ON a.order_id = rr.order_id
     WHERE rr.status IN ('approved', 'processed')
       AND a.deleted_at IS NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, posRange.params.length + refundRange.params.length * 2 + 1).join(' AND ') : ''}`,
    [...posRange.params, ...refundRange.params, ...refundRange.params, ...refundRange.params]
  );


  // ── Daily trend (orders + POS) ─────────────────────────────────────────────
  const dailyTrendQ = pool.query(
    `WITH daily_sales AS (
       SELECT DATE_TRUNC('day', o.created_at) AS day,
              ${revenue('o')} AS revenue, 1 AS tx
       FROM orders o
       WHERE o.deleted_at IS NULL
         ${orderFilterSql}
         ${orderRange.conditions.length > 0 ? 'AND ' + renum(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}
       UNION ALL
       SELECT DATE_TRUNC('day', ps.created_at) AS day,
              ps.total_amount - ps.discount_amount AS revenue, 1 AS tx
       FROM pos_sales ps
       WHERE ps.status = 'completed' AND ps.payment_status = 'verified' AND ps.deleted_at IS NULL
         ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, orderFilterIdx + orderRange.params.length).join(' AND ') : ''}
     )
     SELECT day AS date,
            COALESCE(SUM(revenue), 0)::numeric AS revenue,
            COUNT(*)::int AS transactions
     FROM daily_sales
     GROUP BY day
     ORDER BY day ASC
     LIMIT 90`,
    [...orderStatusParams, ...orderRange.params, ...posRange.params]
  );

  // ── Best selling products (orders + POS) ──────────────────────────────────
  const bestProductsQ = pool.query(
    `WITH combined_sales AS (
       SELECT
         COALESCE(p.name, oi.product_name, 'Product') AS name,
         COALESCE(cat.name, 'Uncategorized') AS category,
         oi.quantity::int AS units,
         (oi.quantity * oi.unit_price)::numeric AS revenue
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       LEFT JOIN products p ON p.product_id = oi.product_id
       LEFT JOIN categories cat ON cat.category_id = p.category_id
       WHERE o.deleted_at IS NULL
         AND oi.product_id IS NOT NULL AND oi.deleted_at IS NULL
         ${orderFilterSql}
         ${orderRange.conditions.length > 0 ? 'AND ' + renum(orderRange.conditions, orderFilterIdx).join(' AND ') : ''}

       UNION ALL

       SELECT
         COALESCE(p.name, psi.item_name, 'Product') AS name,
         COALESCE(cat.name, 'Uncategorized') AS category,
         psi.quantity::int AS units,
         COALESCE(psi.subtotal, psi.quantity * psi.unit_price)::numeric AS revenue
       FROM pos_sale_items psi
       JOIN pos_sales ps ON ps.sale_id = psi.sale_id
       LEFT JOIN products p ON p.product_id = psi.product_id
       LEFT JOIN categories cat ON cat.category_id = p.category_id
       WHERE ps.status = 'completed' AND ps.deleted_at IS NULL
         AND psi.product_id IS NOT NULL AND psi.deleted_at IS NULL
         ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, orderFilterIdx + orderRange.params.length).join(' AND ') : ''}
     )
     SELECT name, category,
            SUM(units)::int AS units,
            COALESCE(SUM(revenue), 0)::numeric AS revenue
     FROM combined_sales
     GROUP BY name, category
     ORDER BY units DESC, revenue DESC
     LIMIT 10`,
    [...orderStatusParams, ...orderRange.params, ...posRange.params]
  );

  // ── Top adjusted products (from refund_requests + voided POS items) ────────
  // Since there's no refund_request_items table, derive from refund_requests
  // and pos_sale_items of voided/returned sales
  const topAdjustedQ = pool.query(
    `WITH adjusted AS (
       -- Refunds attributed to service or order
       SELECT COALESCE(sv.name, p.name, 'Refund') AS name,
              COALESCE(rr.approved_amount, rr.amount_requested, 0)::numeric AS adjustmentAmount,
              COALESCE(rr.reason, 'Refund') AS reason
       FROM refund_requests rr
       LEFT JOIN orders o ON o.order_id = rr.order_id
       LEFT JOIN appointments a ON a.order_id = rr.order_id
       LEFT JOIN LATERAL (
         SELECT s.name FROM services s
         WHERE a.appointment_id IS NOT NULL
           AND s.service_id::text IN (SELECT jsonb_array_elements_text(a.services))
         LIMIT 1
       ) sv ON true
       LEFT JOIN LATERAL (
         SELECT pr.name FROM products pr
         JOIN order_items oi ON oi.product_id = pr.product_id
         WHERE o.order_id IS NOT NULL AND oi.order_id = o.order_id
         LIMIT 1
       ) p ON true
       WHERE rr.status IN ('approved', 'processed')
         ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, 1).join(' AND ') : ''}

       UNION ALL

       -- Voided/returned POS items
       SELECT COALESCE(p.name, psi.item_name, 'Product') AS name,
              psi.subtotal::numeric AS adjustmentAmount,
              'POS void/return' AS reason
       FROM pos_sale_items psi
       JOIN pos_sales ps ON ps.sale_id = psi.sale_id
       LEFT JOIN products p ON p.product_id = psi.product_id
       WHERE ps.status IN ('voided', 'returned') AND ps.deleted_at IS NULL
         AND psi.deleted_at IS NULL
         ${posRange.conditions.length > 0 ? 'AND ' + renum(posRange.conditions, refundRange.params.length + 1).join(' AND ') : ''}
     )
     SELECT name, SUM(adjustmentAmount)::numeric AS "adjustmentAmount", MAX(reason) AS reason
     FROM adjusted
     GROUP BY name
     ORDER BY "adjustmentAmount" DESC
     LIMIT 10`,
    [...refundRange.params, ...posRange.params]
  );

  // ── Refund reasons ────────────────────────────────────────────────────────
  const refundReasonsQ = pool.query(
    `SELECT rr.reason,
            COUNT(*)::int AS count,
            COALESCE(SUM(COALESCE(rr.approved_amount, rr.amount_requested, 0)), 0)::numeric AS amount
     FROM refund_requests rr
     WHERE rr.status IN ('approved', 'processed') AND rr.reason IS NOT NULL
       ${refundRange.conditions.length > 0 ? 'AND ' + renum(refundRange.conditions, 1).join(' AND ') : ''}
     GROUP BY rr.reason
     ORDER BY count DESC
     LIMIT 10`,
    refundRange.params
  );

  // ── Overall Sales payment methods (regular orders: gcash, bank_transfer) ──
  const orderPaymentFilterClauses = [];
  const orderPaymentFilterParams = [];
  let orderPayIdx = 1;
  if (status) { orderPaymentFilterClauses.push(`o.status = $${orderPayIdx++}`); orderPaymentFilterParams.push(status); }
  if (payment_status) { orderPaymentFilterClauses.push(`o.payment_status = $${orderPayIdx++}`); orderPaymentFilterParams.push(payment_status); }
  if (order_type) { orderPaymentFilterClauses.push(`o.order_type = $${orderPayIdx++}`); orderPaymentFilterParams.push(order_type); }
  if (payment_method) { orderPaymentFilterClauses.push(`p.method::text = $${orderPayIdx++}`); orderPaymentFilterParams.push(payment_method); }
  const orderPaymentFilterSql = orderPaymentFilterClauses.length > 0 ? `AND ${orderPaymentFilterClauses.join(' AND ')}` : '';

  const orderPaymentsQ = pool.query(
    `SELECT p.method::text AS method,
            COUNT(DISTINCT o.order_id)::int AS transactions,
            COALESCE(SUM(p.amount), 0)::numeric AS amount
     FROM payments p
     JOIN orders o ON o.order_id = p.order_id
     WHERE p.status = 'verified'
       AND p.deleted_at IS NULL AND o.deleted_at IS NULL
       AND p.method::text IN ('gcash', 'bank_transfer')
       ${orderPaymentFilterSql}
       ${orderRange.conditions.length > 0 ? 'AND ' + renum(orderRange.conditions, orderPayIdx).join(' AND ') : ''}
     GROUP BY p.method
     ORDER BY amount DESC`,
    [...orderPaymentFilterParams, ...orderRange.params]
  );

  // ── Appointment payment methods ───────────────────────────────────────────
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

  const apptPaymentsQ = pool.query(
    `SELECT (
              CASE
                WHEN a.payment_method IN ('cash') THEN 'cash'
                WHEN a.payment_method IN ('gcash', 'e_wallet') THEN 'gcash'
                WHEN a.payment_method IN ('bank_transfer', 'e_bank') THEN 'bank_transfer'
                ELSE a.payment_method
              END
            ) AS method,
            COUNT(DISTINCT a.appointment_id)::int AS appointments,
            COALESCE(SUM(s.price), 0)::numeric AS revenue
     FROM appointments a
     JOIN services s ON s.service_id::text IN (
       SELECT jsonb_array_elements_text(a.services)
     )
     WHERE a.deleted_at IS NULL AND a.payment_method IS NOT NULL
       ${apptPaymentFilterSql}
       ${appointmentRange.conditions.length > 0 ? 'AND ' + renum(appointmentRange.conditions, apptPaymentFilterIdx).join(' AND ') : ''}
     GROUP BY 1
     ORDER BY revenue DESC`,
    [...apptPaymentFilterParams, ...appointmentRange.params]
  );

  // ── Daily/Weekly/Monthly performance (all-time only) ──────────────────────
  const dailyWeeklyMonthlyQ = hasDateRange
    ? Promise.resolve({ rows: [{}] })
    : pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN o.created_at >= $1 THEN ${revenue('o')} ELSE 0 END), 0)::numeric AS "dailySales",
           COUNT(CASE WHEN o.created_at >= $1 THEN 1 END)::int AS "dailyTransactions",
           COALESCE(SUM(CASE WHEN o.created_at >= $2 THEN ${revenue('o')} ELSE 0 END), 0)::numeric AS "weeklySales",
           COUNT(CASE WHEN o.created_at >= $2 THEN 1 END)::int AS "weeklyTransactions",
           COALESCE(SUM(CASE WHEN o.created_at >= $3 THEN ${revenue('o')} ELSE 0 END), 0)::numeric AS "monthlySales",
           COUNT(CASE WHEN o.created_at >= $3 THEN 1 END)::int AS "monthlyTransactions"
         FROM orders o
         WHERE o.deleted_at IS NULL ${orderFilterSql ? renum([orderFilterSql], 4).join('') : ''}`,
        [todayStart, weekStart, monthStart, ...orderStatusParams]
      );


  // ── Run all queries in parallel ───────────────────────────────────────────
  const [
    walkInGrossR, walkInAdjR,
    onlineGrossR, onlineAdjR,
    custGrossR,   custAdjR,
    apptGrossR,   apptAdjR,
    adjByTypeR, adjByChannelR,
    dailyTrendR, bestProductsR,
    topAdjustedR, refundReasonsR,
    orderPaymentsR, apptPaymentsR, dailyWeeklyMonthlyR,
  ] = await Promise.all([
    walkInGrossQ, walkInAdjQ,
    onlineGrossQ, onlineAdjQ,
    custGrossQ,   custAdjQ,
    apptGrossQ,   apptAdjQ,
    adjByTypeQ, adjByChannelQ,
    dailyTrendQ, bestProductsQ,
    topAdjustedQ, refundReasonsQ,
    orderPaymentsQ, apptPaymentsQ, dailyWeeklyMonthlyQ,
  ]);

  // ── Aggregate channel values ──────────────────────────────────────────────
  const walkInGross        = parseFloat(walkInGrossR.rows[0]?.gross        || 0);
  const walkInTransactions = parseInt(walkInGrossR.rows[0]?.transactions   || 0, 10);
  const walkInAdj          = parseFloat(walkInAdjR.rows[0]?.adjustments    || 0);

  const onlineGross        = parseFloat(onlineGrossR.rows[0]?.gross        || 0);
  const onlineTransactions = parseInt(onlineGrossR.rows[0]?.transactions   || 0, 10);
  const onlineAdj          = parseFloat(onlineAdjR.rows[0]?.adjustments    || 0);

  const custGross          = parseFloat(custGrossR.rows[0]?.gross          || 0);
  const custTransactions   = parseInt(custGrossR.rows[0]?.transactions     || 0, 10);
  const custAdj            = parseFloat(custAdjR.rows[0]?.adjustments      || 0);

  const apptGross          = parseFloat(apptGrossR.rows[0]?.gross          || 0);
  const apptTransactions   = parseInt(apptGrossR.rows[0]?.transactions     || 0, 10);
  const apptAdj            = parseFloat(apptAdjR.rows[0]?.adjustments      || 0);

  const totalGross        = walkInGross + onlineGross + custGross + apptGross;
  const totalAdjustments  = walkInAdj  + onlineAdj  + custAdj  + apptAdj;
  const totalTransactions = walkInTransactions + onlineTransactions + custTransactions + apptTransactions;
  const netSales          = totalGross - totalAdjustments;
  const adjustmentRate    = totalGross > 0 ? Number(((totalAdjustments / totalGross) * 100).toFixed(1)) : 0;
  const avg               = (v, c) => (c > 0 ? Number((v / c).toFixed(2)) : 0);

  // ── Daily/Weekly/Monthly ──────────────────────────────────────────────────
  let dailySales = 0, dailyTransactions = 0;
  let weeklySales = 0, weeklyTransactions = 0;
  let monthlySales = 0, monthlyTransactions = 0;
  if (!hasDateRange) {
    const dwm = dailyWeeklyMonthlyR.rows[0] || {};
    dailySales         = parseFloat(dwm.dailySales        || 0);
    dailyTransactions  = parseInt(dwm.dailyTransactions   || 0, 10);
    weeklySales        = parseFloat(dwm.weeklySales       || 0);
    weeklyTransactions = parseInt(dwm.weeklyTransactions  || 0, 10);
    monthlySales       = parseFloat(dwm.monthlySales      || 0);
    monthlyTransactions= parseInt(dwm.monthlyTransactions || 0, 10);
  }

  return {
    grossSales:            Number(totalGross.toFixed(2)),
    totalAdjustments:      Number(totalAdjustments.toFixed(2)),
    netSales:              Number(netSales.toFixed(2)),
    totalTransactions,
    averagePerTransaction: avg(totalGross, totalTransactions),
    customizationOrders:   custTransactions,
    channels: {
      walkIn: {
        gross:        Number(walkInGross.toFixed(2)),
        adjustments:  Number(walkInAdj.toFixed(2)),
        net:          Number((walkInGross - walkInAdj).toFixed(2)),
        transactions: walkInTransactions,
      },
      online: {
        gross:        Number(onlineGross.toFixed(2)),
        adjustments:  Number(onlineAdj.toFixed(2)),
        net:          Number((onlineGross - onlineAdj).toFixed(2)),
        transactions: onlineTransactions,
      },
      customization: {
        gross:        Number(custGross.toFixed(2)),
        adjustments:  Number(custAdj.toFixed(2)),
        net:          Number((custGross - custAdj).toFixed(2)),
        transactions: custTransactions,
      },
      appointments: {
        gross:        Number(apptGross.toFixed(2)),
        adjustments:  Number(apptAdj.toFixed(2)),
        net:          Number((apptGross - apptAdj).toFixed(2)),
        transactions: apptTransactions,
      },
    },
    adjustmentsByType: (adjByTypeR.rows || []).map(r => ({
      type:   r.type,
      count:  parseInt(r.count  || 0, 10),
      amount: parseFloat(r.amount || 0),
    })),
    adjustmentsByChannel: (adjByChannelR.rows || []).map(r => ({
      channel: r.channel,
      count:   parseInt(r.count  || 0, 10),
      amount:  parseFloat(r.amount || 0),
    })),
    adjustmentRate,
    dailyTrend: (dailyTrendR.rows || [])
      .filter(r => r.date)
      .map(r => ({
        date:         new Date(r.date).toISOString().split('T')[0],
        revenue:      parseFloat(r.revenue      || 0),
        transactions: parseInt(r.transactions   || 0, 10),
      })),
    bestSellingProducts: (bestProductsR.rows || []).map(r => ({
      name:     r.name,
      units:    parseInt(r.units   || 0, 10),
      revenue:  parseFloat(r.revenue || 0),
      category: r.category,
    })),
    topAdjustedProducts: (topAdjustedR.rows || []).map(r => ({
      name:             r.name,
      adjustmentAmount: parseFloat(r.adjustmentAmount || 0),
      reason:           r.reason,
    })),
    refundReasons: (refundReasonsR.rows || []).map(r => ({
      reason: r.reason,
      count:  parseInt(r.count  || 0, 10),
      amount: parseFloat(r.amount || 0),
    })),
    orderPaymentMethods: (orderPaymentsR.rows || []).map(r => ({
      method:       r.method,
      transactions: parseInt(r.transactions || 0, 10),
      amount:       parseFloat(r.amount       || 0),
    })),
    appointmentPaymentMethods: (apptPaymentsR.rows || []).map(r => ({
      method:       r.method,
      appointments: parseInt(r.appointments || 0, 10),
      revenue:      parseFloat(r.revenue      || 0),
    })),
    dailySales:          Number(dailySales.toFixed(2)),
    dailyTransactions,
    weeklySales:         Number(weeklySales.toFixed(2)),
    weeklyTransactions,
    monthlySales:        Number(monthlySales.toFixed(2)),
    monthlyTransactions,
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
  getRevenueReport,
  getCustomizationReport,
  getPaymentMethodAnalysis,
  exportReport,
};

