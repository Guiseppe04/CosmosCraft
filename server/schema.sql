-- =============================================
-- COSMOSCRAFT DATABASE - POSTGRESQL 15+
-- Full Schema with OTP Management
-- =============================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- ENUMS & CUSTOM TYPES
-- =============================================

CREATE TYPE user_role_enum AS ENUM ('customer', 'staff', 'admin', 'super_admin');
CREATE TYPE auth_provider_enum AS ENUM ('local', 'google', 'facebook');
CREATE TYPE guitar_type_enum AS ENUM ('acoustic', 'electric', 'bass');
CREATE TYPE order_status_enum AS ENUM ('pending', 'processing', 'completed', 'cancelled');
CREATE TYPE payment_method_enum AS ENUM ('gcash', 'bank_transfer', 'cash');
CREATE TYPE payment_status_enum AS ENUM (
  'pending',
  'for_verification',
  'verified',
  'rejected',
  'cancelled',
  'refunded'
);
CREATE TYPE order_payment_status_enum AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE appointment_status_enum AS ENUM ('pending', 'approved', 'completed', 'cancelled');
CREATE TYPE project_status_enum AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE notification_type_enum AS ENUM ('order_update', 'appointment_reminder', 'system', 'promotional');


-- =============================================
-- 1. USERS
-- =============================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT,
    first_name VARCHAR(50),
    middle_name VARCHAR(50),
    last_name VARCHAR(50),
    suffix VARCHAR(10),
    avatar_url TEXT,
    phone VARCHAR(15),
    role user_role_enum NOT NULL DEFAULT 'customer',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    login_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (login_attempts >= 0),
    locked_until TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);


-- =============================================
-- 2. REFRESH TOKENS
-- =============================================

CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);


-- =============================================
-- 3. USER IDENTITIES (OAuth/Multi-Auth)
-- =============================================

CREATE TABLE user_identities (
    identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider auth_provider_enum NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(100),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_identities_provider ON user_identities(provider);


-- =============================================
-- 4. AUDIT LOGS
-- =============================================

CREATE TABLE audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(80) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);


-- =============================================
-- 5. ADDRESSES
-- =============================================

CREATE TABLE addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    label VARCHAR(50),
    line1 VARCHAR(150) NOT NULL,
    line2 VARCHAR(150),
    city VARCHAR(80) NOT NULL,
    province VARCHAR(80),
    postal_code VARCHAR(20),
    country CHAR(2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (country ~ '^[A-Z]{2}$')
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_is_default ON addresses(user_id, is_default);


-- =============================================
-- 6. CATEGORIES
-- =============================================

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    CHECK (sort_order >= 0)
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);


-- =============================================
-- 7. PRODUCTS
-- =============================================

CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    brand VARCHAR(100),
    category_id INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);


-- =============================================
-- 7A. INVENTORY (Product Stock & Cost)
-- =============================================

CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE,
    cost_price NUMERIC(12, 2) CHECK (cost_price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_stock ON inventory(stock);


-- =============================================
-- 8. PRODUCT IMAGES
-- =============================================

CREATE TABLE product_images (
    image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(200),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    CHECK (sort_order >= 0)
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(product_id, is_primary);


-- =============================================
-- 9. CARTS
-- =============================================

CREATE TABLE carts (
    cart_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_carts_user_id ON carts(user_id);


-- =============================================
-- 10. CART ITEMS
-- =============================================

CREATE TABLE cart_items (
    cart_item_id BIGSERIAL PRIMARY KEY,
    cart_id UUID NOT NULL,
    product_id UUID,
    customization_id UUID,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL))
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);


-- =============================================
-- 11. CUSTOMIZATIONS
-- =============================================

CREATE TABLE customizations (
    customization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name VARCHAR(150),
    guitar_type guitar_type_enum NOT NULL,
    body_wood VARCHAR(100),
    neck_wood VARCHAR(100),
    fingerboard_wood VARCHAR(100),
    bridge_type VARCHAR(50),
    pickups VARCHAR(200),
    color VARCHAR(100),
    finish_type VARCHAR(50),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    is_saved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_customizations_user_id ON customizations(user_id);
CREATE INDEX idx_customizations_guitar_type ON customizations(guitar_type);
CREATE INDEX idx_customizations_is_saved ON customizations(is_saved);


-- =============================================
-- 12. CUSTOMIZATION PARTS
-- =============================================

CREATE TABLE customization_parts (
    part_id BIGSERIAL PRIMARY KEY,
    customization_id UUID NOT NULL,
    product_id UUID,
    part_name VARCHAR(150) NOT NULL,
    quantity SMALLINT NOT NULL CHECK (quantity > 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (customization_id) REFERENCES customizations(customization_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

CREATE INDEX idx_customization_parts_customization_id ON customization_parts(customization_id);


-- =============================================
-- 13. ORDERS
-- =============================================

CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) NOT NULL UNIQUE,
    user_id UUID,
    shipping_address_id UUID,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status order_status_enum NOT NULL DEFAULT 'pending',
    payment_status order_payment_status_enum NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);


-- =============================================
-- 14. ORDER ITEMS
-- =============================================

CREATE TABLE order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id UUID,
    customization_id UUID,
    product_sku VARCHAR(50),
    product_name VARCHAR(150),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (customization_id) REFERENCES customizations(customization_id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL) OR (product_sku IS NOT NULL))
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);


-- =============================================
-- 15. PAYMENTS
-- =============================================

CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    user_id UUID,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
    method payment_method_enum NOT NULL,
    status payment_status_enum NOT NULL DEFAULT 'pending',
    reference_number VARCHAR(100),
    proof_url TEXT,
    payment_instructions JSONB,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE(order_id, reference_number)
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_reference_number ON payments(reference_number);

-- =============================================
-- 15A. PAYMENT CONFIGURATION
-- =============================================

CREATE TABLE payment_config (
    config_id SERIAL PRIMARY KEY,
    payment_method payment_method_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    gcash_number VARCHAR(20),
    gcash_qr_code TEXT,
    bank_name VARCHAR(100),
    bank_account_name VARCHAR(150),
    bank_account_number VARCHAR(50),
    bank_branch VARCHAR(100),
    instructions TEXT,
    display_name VARCHAR(100),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(payment_method)
);

INSERT INTO payment_config (payment_method, is_active, display_name, instructions, sort_order) VALUES
('gcash'::payment_method_enum, true, 'GCash', 'Send payment via GCash to our designated number. Upload your receipt as proof of payment.', 1),
('bank_transfer'::payment_method_enum, true, 'Bank Transfer', 'Transfer to our bank account. Keep your transaction reference for verification.', 2),
('cash'::payment_method_enum, true, 'Cash', 'Pay directly at our store location.', 3);


-- =============================================
-- 16. SERVICES
-- =============================================

CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    duration_minutes SMALLINT NOT NULL CHECK (duration_minutes > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_is_active ON services(is_active);


-- =============================================
-- 17. APPOINTMENTS
-- =============================================

CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    services JSONB DEFAULT '[]'::jsonb,
    location_id VARCHAR(50),
    guitar_details JSONB,
    scheduled_at TIMESTAMPTZ NOT NULL,
    estimated_end_at TIMESTAMPTZ,
    status appointment_status_enum NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CHECK (estimated_end_at IS NULL OR estimated_end_at > scheduled_at)
);

CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_service_id ON appointments(service_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);


-- =============================================
-- 18. PROJECTS
-- =============================================

CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    status project_status_enum NOT NULL DEFAULT 'not_started',
    progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    estimated_completion_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_order_id ON projects(order_id);
CREATE INDEX idx_projects_status ON projects(status);


-- =============================================
-- 19. PROJECT TASKS
-- =============================================

CREATE TABLE project_tasks (
    task_id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);


-- =============================================
-- 20. BUILDER GUITAR TYPES
-- =============================================

CREATE TABLE builder_guitar_types (
    guitar_type_code VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO builder_guitar_types (guitar_type_code, display_name, sort_order) VALUES
('electric', 'Electric', 1),
('bass', 'Bass', 2),
('acoustic', 'Acoustic', 3),
('ukulele', 'Ukulele', 4)
ON CONFLICT (guitar_type_code) DO NOTHING;


-- =============================================
-- 21. BUILDER PART CATEGORIES
-- =============================================

CREATE TABLE builder_part_categories (
    part_category_code VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO builder_part_categories (part_category_code, display_name, sort_order) VALUES
('body', 'Body', 1),
('neck', 'Neck', 2),
('fretboard', 'Fretboard', 3),
('bridge', 'Bridge', 4),
('pickups', 'Pickups', 5),
('electronics', 'Electronics', 6),
('hardware', 'Hardware', 7),
('tuners', 'Tuners', 8),
('strings', 'Strings', 9),
('finish', 'Finish', 10),
('wood_type', 'Wood Type', 11),
('pickguard', 'Pickguard', 12),
('misc', 'Misc', 99)
ON CONFLICT (part_category_code) DO NOTHING;


-- =============================================
-- 22. BUILDER TYPE-CATEGORY MAP
-- =============================================

CREATE TABLE builder_type_categories (
    guitar_type_code VARCHAR(50) NOT NULL,
    part_category_code VARCHAR(100) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (guitar_type_code, part_category_code),
    FOREIGN KEY (guitar_type_code) REFERENCES builder_guitar_types(guitar_type_code) ON DELETE CASCADE,
    FOREIGN KEY (part_category_code) REFERENCES builder_part_categories(part_category_code) ON DELETE CASCADE
);

CREATE INDEX idx_builder_type_categories_category ON builder_type_categories(part_category_code);

INSERT INTO builder_type_categories (guitar_type_code, part_category_code, is_required, sort_order) VALUES
('electric', 'body', true, 1),
('electric', 'neck', true, 2),
('electric', 'pickups', true, 3),
('electric', 'bridge', true, 4),
('bass', 'body', true, 1),
('bass', 'neck', true, 2),
('bass', 'pickups', true, 3),
('bass', 'bridge', true, 4),
('acoustic', 'body', true, 1),
('acoustic', 'neck', true, 2),
('acoustic', 'fretboard', true, 3),
('ukulele', 'body', true, 1),
('ukulele', 'neck', true, 2),
('ukulele', 'fretboard', true, 3)
ON CONFLICT (guitar_type_code, part_category_code) DO NOTHING;


-- =============================================
-- 23. GUITAR BUILDER PARTS
-- =============================================

CREATE TABLE guitar_builder_parts (
    part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    guitar_type VARCHAR(50) NOT NULL DEFAULT 'electric',
    part_category VARCHAR(100) NOT NULL DEFAULT 'misc',
    folder_key VARCHAR(120),
    type_mapping VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (guitar_type) REFERENCES builder_guitar_types(guitar_type_code) ON DELETE RESTRICT,
    FOREIGN KEY (part_category) REFERENCES builder_part_categories(part_category_code) ON DELETE RESTRICT
);

CREATE INDEX idx_guitar_builder_parts_type ON guitar_builder_parts(type_mapping);
CREATE INDEX idx_guitar_builder_parts_active ON guitar_builder_parts(is_active);
CREATE INDEX idx_guitar_builder_parts_guitar_type ON guitar_builder_parts(guitar_type);
CREATE INDEX idx_guitar_builder_parts_part_category ON guitar_builder_parts(part_category);
CREATE INDEX idx_guitar_builder_parts_folder_key ON guitar_builder_parts(folder_key);
CREATE INDEX idx_guitar_builder_parts_lookup ON guitar_builder_parts(guitar_type, part_category, is_active);


-- =============================================
-- 24. PROJECT TEAM MEMBERS
-- =============================================

CREATE TABLE project_team_members (
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_project_team_members_user_id ON project_team_members(user_id);


-- =============================================
-- 25. PROJECT MILESTONES
-- =============================================

CREATE TABLE project_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_status ON project_milestones(status);


-- =============================================
-- 26. PROJECT SUBTASKS
-- =============================================

CREATE TABLE project_subtasks (
    subtask_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_customer_updatable BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_user_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (milestone_id) REFERENCES project_milestones(milestone_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (completed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_project_subtasks_milestone_id ON project_subtasks(milestone_id);
CREATE INDEX idx_project_subtasks_assigned_user_id ON project_subtasks(assigned_user_id);
CREATE INDEX idx_project_subtasks_status ON project_subtasks(status);


-- =============================================
-- 27. PROJECT ACTIVITY LOGS
-- =============================================

CREATE TABLE project_activity_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID,
    action_type VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_project_activity_logs_project_id ON project_activity_logs(project_id);
CREATE INDEX idx_project_activity_logs_user_id ON project_activity_logs(user_id);
CREATE INDEX idx_project_activity_logs_action_type ON project_activity_logs(action_type);
CREATE INDEX idx_project_activity_logs_created_at ON project_activity_logs(created_at DESC);


-- =============================================
-- 28. NOTIFICATIONS
-- =============================================

CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    notification_type notification_type_enum DEFAULT 'system',
    related_entity_id UUID,
    related_entity_type VARCHAR(50),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);


-- =============================================
-- 29. OTP CODES
-- =============================================

CREATE TABLE otp_codes (
    otp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('signup', 'login', 'password_reset', '2fa')),
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, purpose, code)
);

CREATE INDEX idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);
CREATE INDEX idx_otp_codes_is_used ON otp_codes(is_used);


-- =============================================
-- 30. OTP ATTEMPTS
-- =============================================

CREATE TABLE otp_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    otp_id UUID NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (otp_id) REFERENCES otp_codes(otp_id) ON DELETE CASCADE
);

CREATE INDEX idx_otp_attempts_otp_id ON otp_attempts(otp_id);
CREATE INDEX idx_otp_attempts_success ON otp_attempts(success);
CREATE INDEX idx_otp_attempts_created_at ON otp_attempts(created_at DESC);


-- =============================================
-- 31. ROLES (RBAC)
-- =============================================

CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    level INT NOT NULL DEFAULT 0 CHECK (level >= 0),
    parent_role_id UUID,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (parent_role_id) REFERENCES roles(role_id) ON DELETE SET NULL
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_level ON roles(level);
CREATE INDEX idx_roles_parent ON roles(parent_role_id);


-- =============================================
-- 32. PERMISSIONS (RBAC)
-- =============================================

CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_category ON permissions(category);


-- =============================================
-- 33. ROLE PERMISSIONS (RBAC)
-- =============================================

CREATE TABLE role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);


-- =============================================
-- 34. USER ROLES (RBAC)
-- =============================================

CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at);


-- =============================================
-- SEED DEFAULT ROLES
-- =============================================

INSERT INTO roles (role_id, name, description, level, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'super_admin', 'Full system access with all permissions', 100, true),
    ('00000000-0000-0000-0000-000000000002', 'admin', 'Administrative access to manage system', 80, true),
    ('00000000-0000-0000-0000-000000000003', 'staff', 'Staff access for day-to-day operations', 50, true),
    ('00000000-0000-0000-0000-000000000004', 'customer', 'Regular customer access', 10, true)
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- SEED DEFAULT PERMISSIONS
-- =============================================

INSERT INTO permissions (permission_id, name, description, category) VALUES
    ('00000000-0000-0000-0000-000000000101', 'manage_users', 'Create, update, delete users', 'users'),
    ('00000000-0000-0000-0000-000000000102', 'assign_roles', 'Assign roles to users', 'users'),
    ('00000000-0000-0000-0000-000000000103', 'view_users', 'View user information', 'users'),
    ('00000000-0000-0000-0000-000000000104', 'manage_products', 'Create, update, delete products', 'products'),
    ('00000000-0000-0000-0000-000000000105', 'view_products', 'View product catalog', 'products'),
    ('00000000-0000-0000-0000-000000000106', 'manage_orders', 'Create, update, delete orders', 'orders'),
    ('00000000-0000-0000-0000-000000000107', 'view_orders', 'View order details', 'orders'),
    ('00000000-0000-0000-0000-000000000108', 'cancel_orders', 'Cancel orders', 'orders'),
    ('00000000-0000-0000-0000-000000000109', 'manage_services', 'Create, update, delete services', 'services'),
    ('00000000-0000-0000-0000-000000000110', 'view_services', 'View service list', 'services'),
    ('00000000-0000-0000-0000-000000000111', 'manage_appointments', 'Create, update, delete appointments', 'appointments'),
    ('00000000-0000-0000-0000-000000000112', 'view_appointments', 'View appointment details', 'appointments'),
    ('00000000-0000-0000-0000-000000000113', 'approve_appointments', 'Approve or reject appointments', 'appointments'),
    ('00000000-0000-0000-0000-000000000114', 'manage_payments', 'View and manage payments', 'payments'),
    ('00000000-0000-0000-0000-000000000115', 'verify_payments', 'Verify payment submissions', 'payments'),
    ('00000000-0000-0000-0000-000000000116', 'refund_payments', 'Process payment refunds', 'payments'),
    ('00000000-0000-0000-0000-000000000117', 'manage_cart', 'Manage shopping cart', 'cart'),
    ('00000000-0000-0000-0000-000000000118', 'checkout', 'Process checkout and orders', 'cart'),
    ('00000000-0000-0000-0000-000000000119', 'manage_customizations', 'Create, update, delete customizations', 'customizations'),
    ('00000000-0000-0000-0000-000000000120', 'view_customizations', 'View customization designs', 'customizations'),
    ('00000000-0000-0000-0000-000000000121', 'view_reports', 'Access reports and analytics', 'reports'),
    ('00000000-0000-0000-0000-000000000122', 'export_data', 'Export data from system', 'reports'),
    ('00000000-0000-0000-0000-000000000123', 'manage_settings', 'Manage system settings', 'system'),
    ('00000000-0000-0000-0000-000000000124', 'manage_roles', 'Create and manage roles', 'system'),
    ('00000000-0000-0000-0000-000000000125', 'manage_permissions', 'Manage permissions', 'system')
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- SEED ROLE-PERMISSION ASSIGNMENTS
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', permission_id 
FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', permission_id 
FROM permissions 
WHERE name NOT IN ('manage_roles', 'manage_permissions')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', permission_id 
FROM permissions 
WHERE name IN ('view_products', 'manage_orders', 'view_orders', 'cancel_orders', 
               'view_services', 'manage_appointments', 'view_appointments', 'approve_appointments',
               'manage_payments', 'verify_payments', 'view_customizations')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', permission_id 
FROM permissions 
WHERE name IN ('view_products', 'view_services', 'view_appointments',
               'manage_cart', 'checkout', 'view_customizations', 'view_orders')
ON CONFLICT DO NOTHING;


-- =============================================
-- MIGRATE EXISTING USERS TO RBAC
-- =============================================

INSERT INTO user_roles (user_id, role_id)
SELECT user_id, 
    CASE 
        WHEN role = 'super_admin' THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN role = 'admin' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN role = 'staff' THEN '00000000-0000-0000-0000-000000000003'::uuid
        ELSE '00000000-0000-0000-0000-000000000004'::uuid
    END
FROM users
WHERE role IS NOT NULL
ON CONFLICT DO NOTHING;


-- =============================================
-- INVENTORY & POS MODULE (TABLES 35-39)
-- =============================================

-- =============================================
-- ENUMS FOR INVENTORY & POS
-- =============================================

CREATE TYPE inventory_change_type_enum AS ENUM ('stock_in', 'stock_out', 'adjustment', 'sale', 'return');
CREATE TYPE pos_payment_method_enum AS ENUM ('cash', 'gcash', 'bank_transfer');
CREATE TYPE pos_sale_status_enum AS ENUM ('pending', 'completed', 'cancelled', 'refunded');


-- =============================================
-- 35. INVENTORY LOGS
-- =============================================
-- Tracks all inventory movements with reference to source transactions

CREATE TABLE inventory_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    change_type inventory_change_type_enum NOT NULL,
    quantity INT NOT NULL CHECK (quantity != 0),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_reference ON inventory_logs(reference_type, reference_id);
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs(created_at DESC);
CREATE INDEX idx_inventory_logs_change_type ON inventory_logs(change_type);


-- =============================================
-- 36. POS SALES (Point of Sale Transactions)
-- =============================================
-- Represents a walk-in customer transaction

CREATE TABLE pos_sales (
    sale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number VARCHAR(30) NOT NULL UNIQUE,
    staff_id UUID NOT NULL,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(15),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method pos_payment_method_enum NOT NULL,
    payment_status payment_status_enum NOT NULL DEFAULT 'pending',
    status pos_sale_status_enum NOT NULL DEFAULT 'pending',
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    
    FOREIGN KEY (staff_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (cancelled_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_pos_sales_sale_number ON pos_sales(sale_number);
CREATE INDEX idx_pos_sales_staff_id ON pos_sales(staff_id);
CREATE INDEX idx_pos_sales_status ON pos_sales(status);
CREATE INDEX idx_pos_sales_payment_status ON pos_sales(payment_status);
CREATE INDEX idx_pos_sales_created_at ON pos_sales(created_at DESC);
CREATE INDEX idx_pos_sales_completed_at ON pos_sales(completed_at DESC);


-- =============================================
-- 37. POS SALE ITEMS
-- =============================================
-- Individual line items in a POS sale

CREATE TABLE pos_sale_items (
    item_id BIGSERIAL PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID,
    service_id INT,
    item_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (sale_id) REFERENCES pos_sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL) OR (service_id IS NOT NULL))
);

CREATE INDEX idx_pos_sale_items_sale_id ON pos_sale_items(sale_id);
CREATE INDEX idx_pos_sale_items_product_id ON pos_sale_items(product_id);
CREATE INDEX idx_pos_sale_items_service_id ON pos_sale_items(service_id);


-- =============================================
-- 38. POS PAYMENTS
-- =============================================
-- Payment tracking for POS sales

CREATE TABLE pos_payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
    payment_method pos_payment_method_enum NOT NULL,
    status payment_status_enum NOT NULL DEFAULT 'pending',
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    
    FOREIGN KEY (sale_id) REFERENCES pos_sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_pos_payments_sale_id ON pos_payments(sale_id);
CREATE INDEX idx_pos_payments_status ON pos_payments(status);
CREATE INDEX idx_pos_payments_created_at ON pos_payments(created_at DESC);


-- =============================================
-- 39. LOW STOCK ALERTS (Optional)
-- =============================================
-- Tracks low stock alert notifications

CREATE TABLE low_stock_alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    product_id UUID NOT NULL,
    current_stock INT NOT NULL,
    threshold INT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE INDEX idx_low_stock_alerts_product_id ON low_stock_alerts(product_id);
CREATE INDEX idx_low_stock_alerts_is_read ON low_stock_alerts(is_read);
CREATE INDEX idx_low_stock_alerts_created_at ON low_stock_alerts(created_at DESC);


-- =============================================
-- ADD INVENTORY/POS PERMISSIONS TO RBAC
-- =============================================

INSERT INTO permissions (permission_id, name, description, category) VALUES
    ('00000000-0000-0000-0000-000000000201', 'manage_inventory', 'Create, update, manage product inventory', 'inventory'),
    ('00000000-0000-0000-0000-000000000202', 'view_inventory', 'View inventory and stock levels', 'inventory'),
    ('00000000-0000-0000-0000-000000000203', 'adjust_stock', 'Add/remove stock and adjust inventory', 'inventory'),
    ('00000000-0000-0000-0000-000000000204', 'view_inventory_logs', 'View inventory transaction logs', 'inventory'),
    ('00000000-0000-0000-0000-000000000205', 'manage_pos', 'Create, manage POS sales', 'pos'),
    ('00000000-0000-0000-0000-000000000206', 'view_pos', 'View POS sales and transactions', 'pos'),
    ('00000000-0000-0000-0000-000000000207', 'void_pos_sale', 'Void/cancel POS transactions', 'pos'),
    ('00000000-0000-0000-0000-000000000208', 'verify_pos_payment', 'Verify and authorize POS payments', 'pos')
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- ASSIGN INVENTORY/POS PERMISSIONS TO ROLES
-- =============================================

-- Staff: Limited inventory view, full POS access, verify payments
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', permission_id 
FROM permissions 
WHERE name IN ('view_inventory', 'adjust_stock', 'manage_pos', 'view_pos', 'verify_pos_payment')
ON CONFLICT DO NOTHING;

-- Admin: Full inventory and POS management
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', permission_id 
FROM permissions 
WHERE name IN ('manage_inventory', 'view_inventory', 'adjust_stock', 'view_inventory_logs', 
               'manage_pos', 'view_pos', 'void_pos_sale', 'verify_pos_payment')
ON CONFLICT DO NOTHING;

-- Super Admin: All permissions (already has all)

-- =============================================
-- SCHEMA HARDENING / PRODUCTION CONVENTIONS
-- =============================================

-- Keep updated_at consistent across mutable tables.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_identities_set_updated_at ON user_identities;
CREATE TRIGGER trg_user_identities_set_updated_at
BEFORE UPDATE ON user_identities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_set_updated_at ON categories;
CREATE TRIGGER trg_categories_set_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON products;
CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_carts_set_updated_at ON carts;
CREATE TRIGGER trg_carts_set_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_set_updated_at ON cart_items;
CREATE TRIGGER trg_cart_items_set_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customizations_set_updated_at ON customizations;
CREATE TRIGGER trg_customizations_set_updated_at
BEFORE UPDATE ON customizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON orders;
CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_set_updated_at ON payments;
CREATE TRIGGER trg_payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_config_set_updated_at ON payment_config;
CREATE TRIGGER trg_payment_config_set_updated_at
BEFORE UPDATE ON payment_config
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_services_set_updated_at ON services;
CREATE TRIGGER trg_services_set_updated_at
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_set_updated_at ON appointments;
CREATE TRIGGER trg_appointments_set_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_set_updated_at ON projects;
CREATE TRIGGER trg_projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_builder_guitar_types_set_updated_at ON builder_guitar_types;
CREATE TRIGGER trg_builder_guitar_types_set_updated_at
BEFORE UPDATE ON builder_guitar_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_builder_part_categories_set_updated_at ON builder_part_categories;
CREATE TRIGGER trg_builder_part_categories_set_updated_at
BEFORE UPDATE ON builder_part_categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_guitar_builder_parts_set_updated_at ON guitar_builder_parts;
CREATE TRIGGER trg_guitar_builder_parts_set_updated_at
BEFORE UPDATE ON guitar_builder_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Backward compatibility: keep supporting inserts that only send type_mapping.
CREATE OR REPLACE FUNCTION normalize_guitar_builder_part()
RETURNS TRIGGER AS $$
BEGIN
    NEW.guitar_type = lower(NEW.guitar_type);
    NEW.part_category = lower(NEW.part_category);

    IF NEW.type_mapping IS NOT NULL AND NEW.type_mapping <> '' THEN
        IF NEW.part_category = 'misc' AND NEW.type_mapping IN (
            'body', 'neck', 'fretboard', 'bridge', 'pickups', 'electronics',
            'hardware', 'tuners', 'strings', 'finish', 'wood_type', 'pickguard'
        ) THEN
            NEW.part_category = lower(NEW.type_mapping);
        END IF;
    END IF;

    IF NEW.folder_key IS NULL OR btrim(NEW.folder_key) = '' THEN
        NEW.folder_key = lower(NEW.guitar_type::text || '/' || NEW.part_category::text);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guitar_builder_parts_normalize ON guitar_builder_parts;
CREATE TRIGGER trg_guitar_builder_parts_normalize
BEFORE INSERT OR UPDATE ON guitar_builder_parts
FOR EACH ROW
EXECUTE FUNCTION normalize_guitar_builder_part();

DROP TRIGGER IF EXISTS trg_project_milestones_set_updated_at ON project_milestones;
CREATE TRIGGER trg_project_milestones_set_updated_at
BEFORE UPDATE ON project_milestones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_subtasks_set_updated_at ON project_subtasks;
CREATE TRIGGER trg_project_subtasks_set_updated_at
BEFORE UPDATE ON project_subtasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_tasks_set_updated_at ON project_tasks;
CREATE TRIGGER trg_project_tasks_set_updated_at
BEFORE UPDATE ON project_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_set_updated_at ON roles;
CREATE TRIGGER trg_roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pos_sales_set_updated_at ON pos_sales;
CREATE TRIGGER trg_pos_sales_set_updated_at
BEFORE UPDATE ON pos_sales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pos_payments_set_updated_at ON pos_payments;
CREATE TRIGGER trg_pos_payments_set_updated_at
BEFORE UPDATE ON pos_payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- One default shipping address per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_one_default_per_user
ON addresses(user_id)
WHERE is_default;

-- One primary image per product.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_one_primary_per_product
ON product_images(product_id)
WHERE is_primary;

-- Currency should be ISO-like uppercase 3-letter code.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_payments_currency_iso'
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT chk_payments_currency_iso
        CHECK (currency ~ '^[A-Z]{3}$');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_pos_payments_currency_iso'
    ) THEN
        ALTER TABLE pos_payments
        ADD CONSTRAINT chk_pos_payments_currency_iso
        CHECK (currency ~ '^[A-Z]{3}$');
    END IF;
END $$;
