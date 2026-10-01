ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER;

UPDATE categories AS category
SET parent_id = backup.legacy_parent_category_id
FROM category_parent_links_backup AS backup
WHERE category.category_id = backup.category_id
  AND EXISTS (
    SELECT 1
    FROM categories AS parent
    WHERE parent.category_id = backup.legacy_parent_category_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_parent_id_fkey'
      AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
DROP TABLE IF EXISTS category_parent_links_backup;