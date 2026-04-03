const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const TAX_RATE = 0.12;

async function getOrCreateCart(userId) {
  let result = await pool.query(
    'SELECT * FROM carts WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      'INSERT INTO carts (user_id, subtotal, tax_amount) VALUES ($1, 0, 0) RETURNING *',
      [userId]
    );
  }

  return result.rows[0];
}

async function getCartWithItems(userId) {
  const cart = await getOrCreateCart(userId);

  const itemsResult = await pool.query(
    `SELECT 
      ci.cart_item_id,
      ci.quantity,
      ci.unit_price,
      ci.created_at,
      ci.updated_at,
      p.product_id,
      p.sku,
      p.name AS product_name,
      p.description AS product_description,
      p.price AS product_base_price,
      p.stock,
      p.is_active AS product_is_active,
      (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.product_id AND pi.is_primary = true LIMIT 1) AS product_image,
      c.customization_id,
      c.name AS customization_name,
      c.guitar_type,
      c.body_wood,
      c.neck_wood,
      c.fingerboard_wood,
      c.bridge_type,
      c.pickups,
      c.color,
      c.finish_type,
      c.total_price AS customization_price
    FROM cart_items ci
    LEFT JOIN products p ON ci.product_id = p.product_id
    LEFT JOIN customizations c ON ci.customization_id = c.customization_id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at DESC`,
    [cart.cart_id]
  );

  const items = itemsResult.rows.map(item => ({
    cart_item_id: item.cart_item_id,
    quantity: item.quantity,
    unit_price: parseFloat(item.unit_price),
    created_at: item.created_at,
    updated_at: item.updated_at,
    product: item.product_id ? {
      product_id: item.product_id,
      sku: item.sku,
      name: item.product_name,
      description: item.product_description,
      base_price: parseFloat(item.product_base_price),
      stock: item.stock,
      is_active: item.product_is_active,
      image: item.product_image,
    } : null,
    customization: item.customization_id ? {
      customization_id: item.customization_id,
      name: item.customization_name,
      guitar_type: item.guitar_type,
      body_wood: item.body_wood,
      neck_wood: item.neck_wood,
      fingerboard_wood: item.fingerboard_wood,
      bridge_type: item.bridge_type,
      pickups: item.pickups,
      color: item.color,
      finish_type: item.finish_type,
      price: parseFloat(item.customization_price),
    } : null,
  }));

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * item.quantity), 0);
  const taxAmount = subtotal * TAX_RATE;

  return {
    cart_id: cart.cart_id,
    user_id: cart.user_id,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    total_amount: parseFloat((subtotal + taxAmount).toFixed(2)),
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    created_at: cart.created_at,
    updated_at: cart.updated_at,
  };
}

async function addItemToCart(userId, { product_id, customization_id, quantity = 1 }) {
  if (!product_id && !customization_id) {
    throw new AppError('Either product_id or customization_id is required', 400);
  }

  if (quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400);
  }

  const cart = await getOrCreateCart(userId);

  let unitPrice = 0;
  let itemProductId = null;
  let itemCustomizationId = null;

  if (product_id) {
    const productResult = await pool.query(
      'SELECT price, stock, is_active FROM products WHERE product_id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (!product.is_active) {
      throw new AppError('Product is not available', 400);
    }

    if (product.stock < quantity) {
      throw new AppError(`Insufficient stock. Available: ${product.stock}`, 400);
    }

    unitPrice = parseFloat(product.price);
    itemProductId = product_id;
  } else if (customization_id) {
    const customResult = await pool.query(
      'SELECT total_price FROM customizations WHERE customization_id = $1',
      [customization_id]
    );

    if (customResult.rows.length === 0) {
      throw new AppError('Customization not found', 404);
    }

    unitPrice = parseFloat(customResult.rows[0].total_price);
    itemCustomizationId = customization_id;
  }

  const existingItemResult = await pool.query(
    `SELECT * FROM cart_items 
     WHERE cart_id = $1 AND product_id = $2 AND customization_id = $3`,
    [cart.cart_id, itemProductId, itemCustomizationId]
  );

  if (existingItemResult.rows.length > 0) {
    const existingItem = existingItemResult.rows[0];
    const newQuantity = existingItem.quantity + quantity;

    if (product_id) {
      const productResult = await pool.query(
        'SELECT stock FROM products WHERE product_id = $1',
        [product_id]
      );
      if (productResult.rows[0].stock < newQuantity) {
        throw new AppError(`Insufficient stock. Available: ${productResult.rows[0].stock}`, 400);
      }
    }

    await pool.query(
      `UPDATE cart_items SET quantity = $1, unit_price = $2, updated_at = now() 
       WHERE cart_item_id = $3`,
      [newQuantity, unitPrice, existingItem.cart_item_id]
    );
  } else {
    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, customization_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [cart.cart_id, itemProductId, itemCustomizationId, quantity, unitPrice]
    );
  }

  await recalculateCartTotals(cart.cart_id);
  return getCartWithItems(userId);
}

async function updateCartItem(userId, cartItemId, { quantity }) {
  const cart = await getOrCreateCart(userId);

  const itemResult = await pool.query(
    `SELECT ci.*, p.stock, p.is_active AS product_active
     FROM cart_items ci
     LEFT JOIN products p ON ci.product_id = p.product_id
     WHERE ci.cart_item_id = $1 AND ci.cart_id = $2`,
    [cartItemId, cart.cart_id]
  );

  if (itemResult.rows.length === 0) {
    throw new AppError('Cart item not found', 404);
  }

  const item = itemResult.rows[0];

  if (quantity !== undefined) {
    if (quantity < 1) {
      throw new AppError('Quantity must be at least 1', 400);
    }

    if (item.product_id && item.stock < quantity) {
      throw new AppError(`Insufficient stock. Available: ${item.stock}`, 400);
    }

    await pool.query(
      `UPDATE cart_items SET quantity = $1, updated_at = now() 
       WHERE cart_item_id = $2`,
      [quantity, cartItemId]
    );
  }

  await recalculateCartTotals(cart.cart_id);
  return getCartWithItems(userId);
}

async function removeCartItem(userId, cartItemId) {
  const cart = await getOrCreateCart(userId);

  const itemResult = await pool.query(
    'DELETE FROM cart_items WHERE cart_item_id = $1 AND cart_id = $2 RETURNING *',
    [cartItemId, cart.cart_id]
  );

  if (itemResult.rows.length === 0) {
    throw new AppError('Cart item not found', 404);
  }

  await recalculateCartTotals(cart.cart_id);
  return getCartWithItems(userId);
}

async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);

  await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.cart_id]);
  await recalculateCartTotals(cart.cart_id);
  return getCartWithItems(userId);
}

async function recalculateCartTotals(cartId) {
  const itemsResult = await pool.query(
    'SELECT quantity, unit_price FROM cart_items WHERE cart_id = $1',
    [cartId]
  );

  const subtotal = itemsResult.rows.reduce(
    (sum, item) => sum + (parseFloat(item.unit_price) * item.quantity),
    0
  );
  const taxAmount = subtotal * TAX_RATE;

  await pool.query(
    `UPDATE carts SET subtotal = $1, tax_amount = $2, updated_at = now() 
     WHERE cart_id = $3`,
    [parseFloat(subtotal.toFixed(2)), parseFloat(taxAmount.toFixed(2)), cartId]
  );
}

async function prepareCheckout(userId, { shipping_address_id, notes }) {
  const cart = await getCartWithItems(userId);

  if (cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  for (const item of cart.items) {
    if (item.product && !item.product.is_active) {
      throw new AppError(`Product "${item.product.name}" is no longer available`, 400);
    }
    if (item.product && item.product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`, 400);
    }
  }

  return {
    cart,
    checkout_data: {
      shipping_address_id,
      notes,
      subtotal: cart.subtotal,
      tax_amount: cart.tax_amount,
      total_amount: cart.total_amount,
      item_count: cart.item_count,
    },
  };
}

async function convertCartToOrder(userId, { shipping_address_id, notes, payment_method }) {
  const cart = await getCartWithItems(userId);

  if (cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  for (const item of cart.items) {
    if (item.product && !item.product.is_active) {
      throw new AppError(`Product "${item.product.name}" is no longer available`, 400);
    }
    if (item.product && item.product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`, 400);
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const orderResult = await client.query(
      `INSERT INTO orders (order_number, user_id, shipping_address_id, subtotal, tax_amount, shipping_cost, discount_amount, total_amount, status, payment_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending', $9)
       RETURNING *`,
      [
        orderNumber,
        userId,
        shipping_address_id || null,
        cart.subtotal,
        cart.tax_amount,
        0,
        0,
        cart.total_amount,
        notes || null,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, customization_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.order_id,
          item.product ? item.product.product_id : null,
          item.customization ? item.customization.customization_id : null,
          item.quantity,
          item.unit_price,
        ]
      );

      if (item.product) {
        await client.query(
          'UPDATE products SET stock = stock - $1, updated_at = now() WHERE product_id = $2',
          [item.quantity, item.product.product_id]
        );
      }
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.cart_id]);
    await client.query(
      'UPDATE carts SET subtotal = 0, tax_amount = 0, updated_at = now() WHERE cart_id = $1',
      [cart.cart_id]
    );

    await client.query('COMMIT');

    return {
      order: {
        order_id: order.order_id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        subtotal: parseFloat(order.subtotal),
        tax_amount: parseFloat(order.tax_amount),
        total_amount: parseFloat(order.total_amount),
        created_at: order.created_at,
      },
      message: 'Order created successfully',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getCartItemCount(userId) {
  const cart = await getOrCreateCart(userId);
  
  const result = await pool.query(
    'SELECT SUM(quantity) as total_items FROM cart_items WHERE cart_id = $1',
    [cart.cart_id]
  );

  return parseInt(result.rows[0].total_items) || 0;
}

module.exports = {
  getOrCreateCart,
  getCartWithItems,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  prepareCheckout,
  convertCartToOrder,
  getCartItemCount,
};