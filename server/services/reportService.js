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
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(total_amount) as revenue,
            AVG(total_amount) as avg_order_value
     FROM orders ${whereClause}
     GROUP BY ${dateGroup}
     ORDER BY period DESC`,
    params
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
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
  const { start_date, end_date, status, service_id } = filters;
  const { conditions, params } = buildDateFilter(parseDate(start_date), parseDate(end_date), 'scheduled_at');
  const baseIdx = params.length + 1;

  if (status) {
    conditions.push(`a.status = $${baseIdx++}`);
    params.push(status);
  }
  if (service_id) {
    conditions.push(`a.service_id = $${baseIdx++}`);
    params.push(service_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT s.name as service_name, a.status,
            COUNT(*) as count,
            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count
     FROM appointments a
     JOIN services s ON a.service_id = s.service_id
     ${whereClause}
     GROUP BY s.name, a.status
     ORDER BY s.name, a.status`,
    params
  );

  const summaryResult = await pool.query(
    `SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
     FROM appointments a
     ${whereClause}`,
    params
  );

  const serviceStats = await pool.query(
    `SELECT s.name, s.service_id, COUNT(*) as total_appointments
     FROM appointments a
     JOIN services s ON a.service_id = s.service_id
     ${whereClause}
     GROUP BY s.name, s.service_id
     ORDER BY total_appointments DESC
     LIMIT 10`,
    params
  );

  return {
    data: result.rows,
    summary: summaryResult.rows[0],
    top_services: serviceStats.rows,
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
    `SELECT p.product_id, p.name, p.sku, p.price, c.name as category_name,
            SUM(oi.quantity) as total_sold,
            SUM(oi.quantity * oi.unit_price) as total_revenue,
            i.stock as current_stock
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     LEFT JOIN order_items oi ON p.product_id = oi.product_id
     LEFT JOIN orders o ON oi.order_id = o.order_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     ${whereClause}
     GROUP BY p.product_id, p.name, p.sku, p.price, c.name, i.stock
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
    `SELECT product_id, name, stock, low_stock_threshold
     FROM products
     WHERE stock <= low_stock_threshold AND is_active = true
     ORDER BY stock ASC
     LIMIT 10`
  );

  return {
    data: result.rows.map(r => ({
      product_id: r.product_id,
      name: r.name,
      sku: r.sku,
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
    pool.query(`SELECT COUNT(*) as count, SUM(total_amount) as revenue FROM orders WHERE created_at >= $1`, [thisMonthStart]),
    pool.query(`SELECT SUM(total_amount) as revenue FROM orders WHERE created_at >= $1 AND status = 'completed'`, [todayStr]),
    pool.query(`SELECT SUM(total_amount) as revenue FROM orders WHERE created_at >= $1 AND status = 'completed'`, [thisMonthStart]),
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
            SUM(o.total_amount) as revenue,
            COUNT(o.order_id) as orders,
            AVG(o.total_amount) as avg_order_value
     FROM orders o
     WHERE o.status = 'completed'
     ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
     GROUP BY ${dateGroup}
     ORDER BY period DESC`,
    params
  );

  const totalResult = await pool.query(
    `SELECT 
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as overall_avg_order,
        COUNT(*) as total_orders
     FROM orders
     WHERE status = 'completed'
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
  const startDate = parseDate(filters.start_date);
  const endDate = parseDate(filters.end_date);

  const buildRange = (column) => {
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

    return {
      clause: conditions.length ? ` AND ${conditions.join(' AND ')}` : '',
      params,
    };
  };

  const ordersRange = buildRange('o.created_at');
  const posRange = buildRange('ps.created_at');
  const itemsRange = buildRange('src.created_at');

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const [
    walkInSummary,
    onlineSummary,
    customizationSummary,
    dailyOrders,
    dailyPos,
    weeklyOrders,
    weeklyPos,
    monthlyOrders,
    monthlyPos,
    bestSellingProducts,
    customizationTypes,
  ] = await Promise.all([
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(ps.total_amount), 0)::numeric AS sales
       FROM pos_sales ps
       WHERE ps.status = 'completed'
       ${posRange.clause}`,
      posRange.params
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(o.total_amount), 0)::numeric AS sales
       FROM orders o
       WHERE o.status = 'completed'
         AND NOT EXISTS (
           SELECT 1
           FROM order_items oi
           WHERE oi.order_id::text = o.order_id::text
             AND oi.customization_id IS NOT NULL
         )
       ${ordersRange.clause}`,
      ordersRange.params
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(o.total_amount), 0)::numeric AS sales
       FROM orders o
       WHERE o.status = 'completed'
         AND EXISTS (
           SELECT 1
           FROM order_items oi
           WHERE oi.order_id::text = o.order_id::text
             AND oi.customization_id IS NOT NULL
         )
       ${ordersRange.clause}`,
      ordersRange.params
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0)::numeric AS sales
       FROM orders
       WHERE status = 'completed' AND created_at >= $1`,
      [todayStart]
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0)::numeric AS sales
       FROM pos_sales
       WHERE status = 'completed' AND created_at >= $1`,
      [todayStart]
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0)::numeric AS sales
       FROM orders
       WHERE status = 'completed' AND created_at >= $1`,
      [weekStart]
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0)::numeric AS sales
       FROM pos_sales
       WHERE status = 'completed' AND created_at >= $1`,
      [weekStart]
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0)::numeric AS sales
       FROM orders
       WHERE status = 'completed' AND created_at >= $1`,
      [monthStart]
    ),
    pool.query(
      `SELECT
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0)::numeric AS sales
       FROM pos_sales
       WHERE status = 'completed' AND created_at >= $1`,
      [monthStart]
    ),
    pool.query(
      `WITH combined_sales AS (
         SELECT
           COALESCE(oi.product_id::text, oi.product_sku, oi.product_name) AS product_key,
           COALESCE(p.name, oi.product_name, 'Product') AS name,
           COALESCE(cat.name, 'Uncategorized') AS category,
           oi.quantity::int AS units,
           (oi.quantity * oi.unit_price)::numeric AS revenue,
           o.created_at
         FROM order_items oi
         JOIN orders o ON o.order_id::text = oi.order_id::text
         LEFT JOIN products p ON p.product_id::text = oi.product_id::text
         LEFT JOIN categories cat ON cat.category_id = p.category_id
         WHERE o.status = 'completed'
           AND oi.product_id IS NOT NULL

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
       )
       SELECT
         name,
         category,
         SUM(units)::int AS units,
         COALESCE(SUM(revenue), 0)::numeric AS revenue
       FROM combined_sales src
       WHERE 1 = 1${itemsRange.clause}
       GROUP BY product_key, name, category
       ORDER BY units DESC, revenue DESC
       LIMIT 10`,
      itemsRange.params
    ),
    pool.query(
      `SELECT
          c.guitar_type AS type,
          COUNT(DISTINCT o.order_id)::int AS orders,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0)::numeric AS revenue
       FROM order_items oi
       JOIN orders o ON o.order_id::text = oi.order_id::text
       JOIN customizations c ON c.customization_id::text = oi.customization_id::text
       WHERE o.status = 'completed'
       ${ordersRange.clause}
       GROUP BY c.guitar_type
       ORDER BY revenue DESC, orders DESC`,
      ordersRange.params
    ),
  ]);

  const walkInSales = parseFloat(walkInSummary.rows[0]?.sales || 0);
  const walkInTransactions = parseInt(walkInSummary.rows[0]?.transactions || 0, 10);
  const onlineSales = parseFloat(onlineSummary.rows[0]?.sales || 0);
  const onlineTransactions = parseInt(onlineSummary.rows[0]?.transactions || 0, 10);
  const customizationSales = parseFloat(customizationSummary.rows[0]?.sales || 0);
  const customizationTransactions = parseInt(customizationSummary.rows[0]?.transactions || 0, 10);

  const totalGrossSales = walkInSales + onlineSales + customizationSales;
  const totalTransactions = walkInTransactions + onlineTransactions + customizationTransactions;

  const dailySales = parseFloat(dailyOrders.rows[0]?.sales || 0) + parseFloat(dailyPos.rows[0]?.sales || 0);
  const dailyTransactions = parseInt(dailyOrders.rows[0]?.transactions || 0, 10) + parseInt(dailyPos.rows[0]?.transactions || 0, 10);
  const weeklySales = parseFloat(weeklyOrders.rows[0]?.sales || 0) + parseFloat(weeklyPos.rows[0]?.sales || 0);
  const weeklyTransactions = parseInt(weeklyOrders.rows[0]?.transactions || 0, 10) + parseInt(weeklyPos.rows[0]?.transactions || 0, 10);
  const monthlySales = parseFloat(monthlyOrders.rows[0]?.sales || 0) + parseFloat(monthlyPos.rows[0]?.sales || 0);
  const monthlyTransactions = parseInt(monthlyOrders.rows[0]?.transactions || 0, 10) + parseInt(monthlyPos.rows[0]?.transactions || 0, 10);

  const pct = (value, total) => (total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0);
  const avg = (value, count) => (count > 0 ? Number((value / count).toFixed(2)) : 0);

  return {
    totalGrossSales: Number(totalGrossSales.toFixed(2)),
    totalTransactions,
    averagePerTransaction: avg(totalGrossSales, totalTransactions),
    customizationOrders: customizationTransactions,
    walkInSales: Number(walkInSales.toFixed(2)),
    walkInTransactions,
    walkInAvg: avg(walkInSales, walkInTransactions),
    walkInPercentage: pct(walkInSales, totalGrossSales),
    onlineSales: Number(onlineSales.toFixed(2)),
    onlineTransactions,
    onlineAvg: avg(onlineSales, onlineTransactions),
    onlinePercentage: pct(onlineSales, totalGrossSales),
    customizationSales: Number(customizationSales.toFixed(2)),
    customizationTransactions,
    customizationAvg: avg(customizationSales, customizationTransactions),
    customizationPercentage: pct(customizationSales, totalGrossSales),
    dailySales: Number(dailySales.toFixed(2)),
    dailyTransactions,
    weeklySales: Number(weeklySales.toFixed(2)),
    weeklyTransactions,
    monthlySales: Number(monthlySales.toFixed(2)),
    monthlyTransactions,
    bestSellingProducts: bestSellingProducts.rows.map((row) => ({
      name: row.name,
      units: parseInt(row.units || 0, 10),
      revenue: parseFloat(row.revenue || 0),
      category: row.category,
    })),
    customizationTypes: customizationTypes.rows.map((row) => ({
      type: row.type,
      orders: parseInt(row.orders || 0, 10),
      revenue: parseFloat(row.revenue || 0),
    })),
    customizationRevenue: Number(customizationSales.toFixed(2)),
    avgCustomization: avg(customizationSales, customizationTransactions),
    walkInConversion: pct(walkInTransactions, totalTransactions),
    onlineConversion: pct(onlineTransactions, totalTransactions),
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
    case 'appointments': data = await getAppointmentReport(filters); break;
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
