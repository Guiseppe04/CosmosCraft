-- NCR and independent cities have no province. Preserve existing address records.
ALTER TABLE addresses ALTER COLUMN province DROP NOT NULL;
