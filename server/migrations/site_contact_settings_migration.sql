CREATE TABLE IF NOT EXISTS contact_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    email VARCHAR(254) NOT NULL DEFAULT 'cosmosguitars@gmail.com',
    phone VARCHAR(64) NOT NULL DEFAULT '+095213121581',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO contact_settings (id, email, phone)
VALUES (1, 'cosmosguitars@gmail.com', '+095213121581')
ON CONFLICT (id) DO NOTHING;