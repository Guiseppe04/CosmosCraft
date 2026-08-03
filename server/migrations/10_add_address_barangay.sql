ALTER TABLE addresses ADD COLUMN IF NOT EXISTS barangay VARCHAR(80);
UPDATE addresses SET barangay = '' WHERE barangay IS NULL;
ALTER TABLE addresses ALTER COLUMN barangay SET DEFAULT '';
ALTER TABLE addresses ALTER COLUMN barangay SET NOT NULL;
