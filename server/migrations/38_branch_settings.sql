CREATE TABLE IF NOT EXISTS branch_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    branch_id TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    hours TEXT NOT NULL,
    address_details JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO branch_settings (id, branch_id, name, address, hours)
VALUES (1, 'balagtas-main', 'CosmosCraft Balagtas Branch',
        'Sp 047-K St Peter Compound, Balagtas, 3016 Bulacan', 'Mon-Sat 9:00 AM - 6:00 PM')
ON CONFLICT (id) DO NOTHING;
