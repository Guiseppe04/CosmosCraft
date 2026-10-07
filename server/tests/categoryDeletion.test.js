const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pool } = require('../config/database');
const { deleteCategory } = require('../services/productService');

test('category deletion preserves products, isolates other categories, and rolls back failures', async () => {
  const db = new PGlite();
  const original = pool.connect;
  let released = 0;
  pool.connect = async () => ({ query: (sql, params) => db.query(sql, params), release() { released++; } });
  try {
    await db.exec(`CREATE TABLE categories(category_id INTEGER PRIMARY KEY);
      CREATE TABLE products(product_id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories ON DELETE RESTRICT);
      INSERT INTO categories VALUES (1),(2),(3);
      INSERT INTO products VALUES (1,1),(2,1),(3,2);`);
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/43_allow_uncategorized_products.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM products')).rows[0].count, 3);
    await deleteCategory(1);
    assert.deepEqual((await db.query('SELECT * FROM products ORDER BY product_id')).rows,
      [{product_id:1,category_id:null},{product_id:2,category_id:null},{product_id:3,category_id:2}]);
    assert.deepEqual((await db.query('SELECT * FROM categories ORDER BY category_id')).rows, [{category_id:2},{category_id:3}]);
    await deleteCategory(3);
    await assert.rejects(deleteCategory(999), error => error.statusCode === 404);
    await db.exec('CREATE TABLE blockers(category_id INTEGER REFERENCES categories ON DELETE RESTRICT); INSERT INTO blockers VALUES (2);');
    await assert.rejects(deleteCategory(2), /foreign key/);
    assert.equal((await db.query('SELECT category_id FROM products WHERE product_id = 3')).rows[0].category_id, 2);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM categories')).rows[0].count, 1);
    assert.equal(released, 4);
  } finally {
    pool.connect = original;
    await db.close();
  }
});
