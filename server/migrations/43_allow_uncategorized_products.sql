-- Products remain in the catalog when their category is deleted.
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;
