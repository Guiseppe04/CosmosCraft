-- Preserve existing parent links so this schema change can be rolled back.
CREATE TABLE IF NOT EXISTS category_parent_links_backup (
  category_id INTEGER PRIMARY KEY,
  legacy_parent_category_id INTEGER NOT NULL
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'categories'
      AND column_name = 'parent_id'
  ) THEN
    INSERT INTO category_parent_links_backup (category_id, legacy_parent_category_id)
    SELECT category_id, parent_id
    FROM categories
    WHERE parent_id IS NOT NULL
    ON CONFLICT (category_id) DO UPDATE
    SET legacy_parent_category_id = EXCLUDED.legacy_parent_category_id;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_categories_parent_id;
ALTER TABLE categories DROP COLUMN IF EXISTS parent_id;