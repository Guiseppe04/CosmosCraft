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
CREATE TYPE order_status_enum AS ENUM ('pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE payment_method_enum AS ENUM ('gcash', 'bank_transfer', 'cash');
CREATE TYPE payment_status_enum AS ENUM (
  'pending',
  'for_verification',
  'verified',
  'rejected',
  'cancelled',
  'refunded'
);
CREATE TYPE order_payment_status_enum AS ENUM (
    'pending',              -- order created, no payment submitted yet
    'proof_submitted',    -- customer uploaded proof of payment
    'under_review',       -- admin is currently checking the proof
    'approved',           -- payment verified by admin
    'rejected',           -- proof invalid / denied
    'failed'              -- payment attempt failed (optional fallback)
);
CREATE TYPE appointment_status_enum AS ENUM ('pending', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled');
CREATE TYPE project_status_enum AS ENUM ('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE notification_type_enum AS ENUM ('order_update', 'appointment_reminder', 'system', 'promotional', 'low_stock', 'project_update');


-- =============================================
-- 1. USERS
-- =============================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
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
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;


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
-- Consolidated audit table: replaces payment_audit_log, project_activity_logs,
-- and otp_attempts by using entity_type + entity_id + details JSONB.
-- The details column stores action-specific data (admin info, rejection reasons,
-- OTP attempt metadata, project activity details, etc.).

CREATE TABLE audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'VERIFY', 'REJECT', 'REFUND', 'LOGIN_ATTEMPT', 'PASSWORD_RESET', 'STOCK_ALERT'))
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);


-- =============================================
-- 5. ADDRESSES
-- =============================================

CREATE TABLE addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT 'Home',
    line1 VARCHAR(150) NOT NULL,
    line2 VARCHAR(150),
    city VARCHAR(80) NOT NULL,
    province VARCHAR(80) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country CHAR(2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (country ~ '^[A-Z]{2}$')
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_is_default ON addresses(user_id, is_default);
CREATE INDEX idx_addresses_deleted_at ON addresses(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 6. CATEGORIES
-- =============================================

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    CHECK (sort_order >= 0)
);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 7. PRODUCTS
-- =============================================

CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    brand VARCHAR(100) NOT NULL DEFAULT '',
    category_id INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT
);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 7A. INVENTORY (Product Stock & Cost)
-- =============================================

CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_stock ON inventory(stock);
CREATE INDEX idx_inventory_deleted_at ON inventory(deleted_at) WHERE deleted_at IS NOT NULL;


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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    CHECK (sort_order >= 0)
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(product_id, is_primary);
CREATE INDEX idx_product_images_deleted_at ON product_images(deleted_at) WHERE deleted_at IS NOT NULL;


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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL))
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_cart_items_deleted_at ON cart_items(deleted_at) WHERE deleted_at IS NOT NULL;


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
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_customizations_user_id ON customizations(user_id);
CREATE INDEX idx_customizations_guitar_type ON customizations(guitar_type);
CREATE INDEX idx_customizations_is_saved ON customizations(is_saved);
CREATE INDEX idx_customizations_deleted_at ON customizations(deleted_at) WHERE deleted_at IS NOT NULL;


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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (customization_id) REFERENCES customizations(customization_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

CREATE INDEX idx_customization_parts_customization_id ON customization_parts(customization_id);
CREATE INDEX idx_customization_parts_deleted_at ON customization_parts(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 13. ORDERS
-- =============================================

CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) NOT NULL UNIQUE,
    order_type VARCHAR(20) NOT NULL DEFAULT 'product',
    user_id UUID,
    shipping_address_id UUID,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status order_status_enum NOT NULL DEFAULT 'pending',
    payment_status order_payment_status_enum NOT NULL DEFAULT 'pending',
    payment_reference_number VARCHAR(100),
    proof_submitted_at TIMESTAMPTZ,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes TEXT,
    notes TEXT,
    tracking_number VARCHAR(100),
    courier_name VARCHAR(100),
    shipped_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    rider_name VARCHAR(100),
    rider_contact VARCHAR(50),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX idx_orders_shipped_at ON orders(shipped_at) WHERE shipped_at IS NOT NULL;
CREATE INDEX idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX idx_orders_payment_reference ON orders(payment_reference_number);
CREATE INDEX idx_orders_proof_submitted_at ON orders(proof_submitted_at) WHERE proof_submitted_at IS NOT NULL;
CREATE INDEX idx_orders_reviewed_at ON orders(reviewed_at) WHERE reviewed_at IS NOT NULL;
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NOT NULL;
-- Composite index for dashboard queries filtering by status + date range
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
-- Composite index for payment verification workflow
CREATE INDEX idx_orders_payment_review ON orders(payment_status, reviewed_at) WHERE payment_status IN ('proof_submitted', 'under_review');

-- Check constraint for order_type
ALTER TABLE orders ADD CONSTRAINT chk_orders_order_type CHECK (order_type IN ('product', 'customization', 'service'));

-- Index on order_type
CREATE INDEX idx_orders_order_type ON orders(order_type);

-- Composite indexes for optimized search, filter, and sort
CREATE INDEX idx_orders_type_status_created ON orders(order_type, status, created_at DESC);
CREATE INDEX idx_orders_payment_status_created ON orders(payment_status, created_at DESC);
CREATE INDEX idx_orders_amount_created ON orders(total_amount, created_at DESC);

-- Indexes for related tables used in joins
CREATE INDEX idx_payments_reference_number ON payments(reference_number);
CREATE INDEX idx_order_items_product_name ON order_items(product_name);
CREATE INDEX idx_order_items_customization_id ON order_items(customization_id) WHERE customization_id IS NOT NULL;

-- =============================================
-- 13A. ORDER NUMBER COUNTERS
-- =============================================
-- Atomic counter table for generating unique, sequential order numbers
-- per type and per day (PO-YYYYMMDD-0001, CO-YYYYMMDD-0001, SO-YYYYMMDD-0001)

CREATE TABLE order_number_counters (
    prefix VARCHAR(2) PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_number INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_number_counters_date ON order_number_counters(date);

-- Seed initial counter rows (day-reset is handled dynamically in application logic)
INSERT INTO order_number_counters (prefix, date, last_number) VALUES
    ('PO', CURRENT_DATE, 0),
    ('CO', CURRENT_DATE, 0),
    ('SO', CURRENT_DATE, 0)
ON CONFLICT (prefix) DO NOTHING;


-- =============================================
-- 14. ORDER ITEMS
-- =============================================

CREATE TABLE order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id UUID,
    customization_id UUID,
    product_name VARCHAR(150),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (customization_id) REFERENCES customizations(customization_id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL))
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_deleted_at ON order_items(deleted_at) WHERE deleted_at IS NOT NULL;


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
    deleted_at TIMESTAMPTZ,
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
CREATE INDEX idx_payments_deleted_at ON payments(deleted_at) WHERE deleted_at IS NOT NULL;

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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(payment_method)
);

CREATE INDEX idx_payment_config_deleted_at ON payment_config(deleted_at) WHERE deleted_at IS NOT NULL;

INSERT INTO payment_config (payment_method, is_active, display_name, instructions, sort_order) VALUES
('gcash'::payment_method_enum, true, 'GCash', 'Send payment via GCash to our designated number. Upload your receipt as proof of payment.', 1),
('bank_transfer'::payment_method_enum, true, 'Bank Transfer', 'Transfer to our bank account. Keep your transaction reference for verification.', 2),
('cash'::payment_method_enum, true, 'Cash', 'Pay directly at our store location.', 3);


-- =============================================
-- 15B. PAYMENT SETTINGS

CREATE TABLE payment_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bank_name VARCHAR(255) NOT NULL DEFAULT '',
    account_name VARCHAR(255) NOT NULL DEFAULT '',
    account_number VARCHAR(255) NOT NULL DEFAULT '',
    gcash_number VARCHAR(255) NOT NULL DEFAULT '',
    maya_number VARCHAR(255) NOT NULL DEFAULT '',
    qr_image_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO payment_settings (id, bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes)
VALUES (1, '', '', '', '', '', '', '')
ON CONFLICT (id) DO NOTHING;


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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_deleted_at ON services(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 17. APPOINTMENTS
-- =============================================

CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    appointment_type VARCHAR(50) NOT NULL DEFAULT 'service_in_shop',
    order_id UUID,
    services JSONB DEFAULT '[]'::jsonb,
    location_id VARCHAR(50),
    guitar_details JSONB,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    estimated_end_at TIMESTAMPTZ,
    status appointment_status_enum NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_proof_url TEXT,
    notes TEXT,
    confirmation_notes TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    CHECK (estimated_end_at IS NULL OR estimated_end_at > scheduled_at)
);

CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_order_id ON appointments(order_id);
CREATE INDEX idx_appointments_type ON appointments(appointment_type);
CREATE INDEX idx_appointments_services_gin ON appointments USING GIN (services);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_payment_status ON appointments(payment_status);
CREATE INDEX idx_appointments_deleted_at ON appointments(deleted_at) WHERE deleted_at IS NOT NULL;
-- Composite index for calendar/scheduling queries
CREATE INDEX idx_appointments_schedule_status ON appointments(scheduled_at, status);


-- =============================================
-- 17A. UNAVAILABLE DATES
-- =============================================

CREATE TABLE unavailable_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reason VARCHAR(255),
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_unavailable_dates_date ON unavailable_dates(date);
CREATE INDEX idx_unavailable_dates_created_by ON unavailable_dates(created_by);
CREATE INDEX idx_unavailable_dates_deleted_at ON unavailable_dates(deleted_at) WHERE deleted_at IS NOT NULL;


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
    fulfillment_method VARCHAR(50),
    fulfillment_status VARCHAR(50),
    fulfillment_notes TEXT,
    fulfillment_selected_at TIMESTAMPTZ,
    pickup_appointment_id UUID,
    -- Hold columns
    hold_reason TEXT,
    hold_option VARCHAR(50) CHECK (hold_option IN ('resume_later', 'hold_before_next_step')),
    hold_at_step VARCHAR(200),
    hold_requested_at TIMESTAMPTZ,
    hold_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    hold_approved_at TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    -- Cancel columns
    cancel_option VARCHAR(50) CHECK (cancel_option IN ('ship_unfinished', 'pickup_unfinished')),
    cancel_reason TEXT,
    cancel_requested_at TIMESTAMPTZ,
    cancel_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    cancel_approved_at TIMESTAMPTZ,
    -- Fulfillment tracking
    shipped_at TIMESTAMPTZ,
    ready_for_pickup_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    -- Claim / Custom Build
    custom_build_id VARCHAR(30) UNIQUE,
    claimed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    -- Soft delete / audit
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (pickup_appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_projects_order_id ON projects(order_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_fulfillment_method ON projects(fulfillment_method);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
-- Composite index for project dashboard filtering by status + progress
CREATE INDEX idx_projects_status_progress ON projects(status, progress);

-- Composite indexes for optimized project search, filter, and sort
CREATE INDEX idx_projects_status_created ON projects(status, created_at DESC);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_projects_progress ON projects(progress);
CREATE INDEX idx_projects_estimated_completion_date ON projects(estimated_completion_date);
CREATE INDEX idx_projects_title ON projects(title);
CREATE INDEX idx_projects_notes ON projects(notes);

-- Indexes for related tables used in joins
CREATE INDEX idx_orders_user_id ON users(user_id);
CREATE INDEX idx_project_subtasks_assigned_user_id ON project_subtasks(assigned_user_id);
CREATE INDEX idx_project_subtasks_title ON project_subtasks(title);


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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_deleted_at ON project_tasks(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 20. BUILDER GUITAR TYPES
-- =============================================

CREATE TABLE builder_guitar_types (
    guitar_type_code VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_builder_guitar_types_deleted_at ON builder_guitar_types(deleted_at) WHERE deleted_at IS NOT NULL;

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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_builder_part_categories_deleted_at ON builder_part_categories(deleted_at) WHERE deleted_at IS NOT NULL;

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
-- 23. BUILDER MODEL IMAGES
-- =============================================

CREATE TABLE builder_model_images (
    model_image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guitar_type_code VARCHAR(50) NOT NULL REFERENCES builder_guitar_types(guitar_type_code) ON DELETE CASCADE,
    model_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    image_url TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (guitar_type_code, model_key)
);

CREATE INDEX idx_builder_model_images_guitar_type ON builder_model_images(guitar_type_code);
CREATE INDEX idx_builder_model_images_deleted_at ON builder_model_images(deleted_at) WHERE deleted_at IS NOT NULL;

INSERT INTO builder_model_images (guitar_type_code, model_key, display_name) VALUES
('electric', 'strat', 'Strat'),
('electric', 'solo', 'Solo'),
('electric', 'dc', 'DC'),
('electric', 'delos', 'Delos'),
('bass', 'vader', 'Vader'),
('bass', 'pb', 'Precision'),
('bass', 'jb', 'Jazz')
ON CONFLICT (guitar_type_code, model_key) DO NOTHING;


-- =============================================
-- 24. GUITAR BUILDER PARTS
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
    deleted_at TIMESTAMPTZ,
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
CREATE INDEX idx_guitar_builder_parts_deleted_at ON guitar_builder_parts(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 25. PROJECT TEAM MEMBERS
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
-- 26. PROJECT MILESTONES
-- =============================================

CREATE TABLE project_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_status ON project_milestones(status);
CREATE INDEX idx_project_milestones_deleted_at ON project_milestones(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 27. PROJECT SUBTASKS
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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (milestone_id) REFERENCES project_milestones(milestone_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (completed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_project_subtasks_milestone_id ON project_subtasks(milestone_id);
CREATE INDEX idx_project_subtasks_assigned_user_id ON project_subtasks(assigned_user_id);
CREATE INDEX idx_project_subtasks_status ON project_subtasks(status);
CREATE INDEX idx_project_subtasks_deleted_at ON project_subtasks(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 27B. PROJECT INSTALLMENT SCHEDULES
-- =============================================
-- Tracks installment payment schedules for projects with installment plans.

CREATE TABLE project_installment_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    installment_number INT NOT NULL CHECK (installment_number > 0),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_project ON project_installment_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_status ON project_installment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_due_date ON project_installment_schedules(due_date);


-- =============================================
-- 27C. DEFAULT WORKFLOW TEMPLATES
-- =============================================
-- Stores the editable default workflow for customization projects.
-- Changes here only affect future projects, not existing ones.

CREATE TABLE default_workflow_steps (
    step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_name VARCHAR(200) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_default_workflow_steps_sort ON default_workflow_steps(sort_order);

CREATE TABLE default_workflow_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES default_workflow_steps(step_id) ON DELETE CASCADE,
    task_name VARCHAR(200) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_default_workflow_tasks_step ON default_workflow_tasks(step_id);
CREATE INDEX idx_default_workflow_tasks_sort ON default_workflow_tasks(step_id, sort_order);

-- Seed the default customization workflow
INSERT INTO default_workflow_steps (step_id, step_name, sort_order) VALUES
    (gen_random_uuid(), 'Body', 1),
    (gen_random_uuid(), 'Neck', 2),
    (gen_random_uuid(), 'Parts Fitting', 3),
    (gen_random_uuid(), 'Paint Processing', 4),
    (gen_random_uuid(), 'Assembly & Setup', 5),
    (gen_random_uuid(), 'Release', 6);

-- Seed tasks for each step (using subqueries to get step_ids)
DO $$
DECLARE
    v_body_id UUID;
    v_neck_id UUID;
    v_paint_id UUID;
    v_release_id UUID;
BEGIN
    SELECT step_id INTO v_body_id FROM default_workflow_steps WHERE step_name = 'Body';
    SELECT step_id INTO v_neck_id FROM default_workflow_steps WHERE step_name = 'Neck';
    SELECT step_id INTO v_paint_id FROM default_workflow_steps WHERE step_name = 'Paint Processing';
    SELECT step_id INTO v_release_id FROM default_workflow_steps WHERE step_name = 'Release';

    -- Body tasks
    INSERT INTO default_workflow_tasks (task_id, step_id, task_name, sort_order) VALUES
        (gen_random_uuid(), v_body_id, 'Shape Carving', 1),
        (gen_random_uuid(), v_body_id, 'Pickup Cavity', 2),
        (gen_random_uuid(), v_body_id, 'Electronics Cavity', 3),
        (gen_random_uuid(), v_body_id, 'Neck Pocket', 4);

    -- Neck tasks
    INSERT INTO default_workflow_tasks (task_id, step_id, task_name, sort_order) VALUES
        (gen_random_uuid(), v_neck_id, 'Shape Carving', 1),
        (gen_random_uuid(), v_neck_id, 'Install Frets', 2),
        (gen_random_uuid(), v_neck_id, 'Drill Tuning Peg Holes', 3);

    -- Paint Processing tasks
    INSERT INTO default_workflow_tasks (task_id, step_id, task_name, sort_order) VALUES
        (gen_random_uuid(), v_paint_id, 'Sanding', 1),
        (gen_random_uuid(), v_paint_id, 'Primer', 2),
        (gen_random_uuid(), v_paint_id, 'Base Color', 3),
        (gen_random_uuid(), v_paint_id, 'Top Coat', 4),
        (gen_random_uuid(), v_paint_id, 'Buffing', 5),
        (gen_random_uuid(), v_paint_id, 'Polishing', 6);

    -- Release tasks
    INSERT INTO default_workflow_tasks (task_id, step_id, task_name, sort_order) VALUES
        (gen_random_uuid(), v_release_id, 'Delivery', 1);
END $$;


-- =============================================
-- 28. NOTIFICATIONS
-- =============================================
-- Consolidated notification table: also handles low_stock_alerts
-- via notification_type = 'low_stock' and related_entity_type = 'inventory'.

CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum NOT NULL DEFAULT 'system',
    related_entity_id UUID,
    related_entity_type VARCHAR(50),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NOT NULL;
-- Composite index for unread notification queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;


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
-- Kept as a separate table for OTP rate-limiting and brute-force detection.
-- Audit trail for OTP events is also captured in audit_logs.

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
-- 31. PASSWORD RESET TOKENS
-- =============================================

CREATE TABLE password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);


-- =============================================
-- 32. ROLES (RBAC)
-- =============================================

CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    level INT NOT NULL DEFAULT 0 CHECK (level >= 0),
    parent_role_id UUID,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (parent_role_id) REFERENCES roles(role_id) ON DELETE SET NULL
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_level ON roles(level);
CREATE INDEX idx_roles_parent ON roles(parent_role_id);
CREATE INDEX idx_roles_deleted_at ON roles(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 33. PERMISSIONS (RBAC)
-- =============================================

CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_deleted_at ON permissions(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 34. ROLE PERMISSIONS (RBAC)
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
-- 35. USER ROLES (RBAC)
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
    (gen_random_uuid(), 'super_admin', 'Full system access with all permissions', 100, true),
    (gen_random_uuid(), 'admin', 'Administrative access to manage system', 80, true),
    (gen_random_uuid(), 'staff', 'Staff access for day-to-day operations', 50, true),
    (gen_random_uuid(), 'customer', 'Regular customer access', 10, true)
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- SEED DEFAULT PERMISSIONS
-- =============================================

INSERT INTO permissions (permission_id, name, description, category) VALUES
    (gen_random_uuid(), 'manage_users', 'Create, update, delete users', 'users'),
    (gen_random_uuid(), 'assign_roles', 'Assign roles to users', 'users'),
    (gen_random_uuid(), 'view_users', 'View user information', 'users'),
    (gen_random_uuid(), 'manage_products', 'Create, update, delete products', 'products'),
    (gen_random_uuid(), 'view_products', 'View product catalog', 'products'),
    (gen_random_uuid(), 'manage_orders', 'Create, update, delete orders', 'orders'),
    (gen_random_uuid(), 'view_orders', 'View order details', 'orders'),
    (gen_random_uuid(), 'cancel_orders', 'Cancel orders', 'orders'),
    (gen_random_uuid(), 'manage_services', 'Create, update, delete services', 'services'),
    (gen_random_uuid(), 'view_services', 'View service list', 'services'),
    (gen_random_uuid(), 'manage_appointments', 'Create, update, delete appointments', 'appointments'),
    (gen_random_uuid(), 'view_appointments', 'View appointment details', 'appointments'),
    (gen_random_uuid(), 'approve_appointments', 'Approve or reject appointments', 'appointments'),
    (gen_random_uuid(), 'manage_payments', 'View and manage payments', 'payments'),
    (gen_random_uuid(), 'verify_payments', 'Verify payment submissions', 'payments'),
    (gen_random_uuid(), 'refund_payments', 'Process payment refunds', 'payments'),
    (gen_random_uuid(), 'manage_cart', 'Manage shopping cart', 'cart'),
    (gen_random_uuid(), 'checkout', 'Process checkout and orders', 'cart'),
    (gen_random_uuid(), 'manage_customizations', 'Create, update, delete customizations', 'customizations'),
    (gen_random_uuid(), 'view_customizations', 'View customization designs', 'customizations'),
    (gen_random_uuid(), 'view_reports', 'Access reports and analytics', 'reports'),
    (gen_random_uuid(), 'export_data', 'Export data from system', 'reports'),
    (gen_random_uuid(), 'manage_settings', 'Manage system settings', 'system'),
    (gen_random_uuid(), 'manage_roles', 'Create and manage roles', 'system'),
    (gen_random_uuid(), 'manage_permissions', 'Manage permissions', 'system')
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- SEED ROLE-PERMISSION ASSIGNMENTS
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name NOT IN ('manage_roles', 'manage_permissions')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'staff'
  AND p.name IN ('view_products', 'manage_orders', 'view_orders', 'cancel_orders',
                 'view_services', 'manage_appointments', 'view_appointments', 'approve_appointments',
                 'manage_payments', 'verify_payments', 'view_customizations')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'customer'
  AND p.name IN ('view_products', 'view_services', 'view_appointments',
                 'manage_cart', 'checkout', 'view_customizations', 'view_orders')
ON CONFLICT DO NOTHING;


-- =============================================
-- MIGRATE EXISTING USERS TO RBAC
-- =============================================

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.name = CASE
    WHEN u.role = 'super_admin' THEN 'super_admin'
    WHEN u.role = 'admin' THEN 'admin'
    WHEN u.role = 'staff' THEN 'staff'
    ELSE 'customer'
END
WHERE u.role IS NOT NULL
ON CONFLICT DO NOTHING;


-- =============================================
-- SEED DEFAULT ADMIN ACCOUNT
-- =============================================
-- Default admin credentials (CHANGE IN PRODUCTION):
--   Email:    admin@cosmoscraft.com
--   Password: Admin@123

INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, is_active)
SELECT 'admin@cosmoscraft.com',
       '$2a$12$zHbXqVUUztevqzUsyOVbKevIEiL1mMwe4BDN1dL9nQHJ0RxSbqOom', -- bcrypt hash of 'Admin@123'
       'Admin',
       'User',
       'admin'::user_role_enum,
       TRUE,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@cosmoscraft.com');

-- Assign admin role to the default admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@cosmoscraft.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = u.user_id AND ur.role_id = r.role_id
  );


-- =============================================
-- INVENTORY & POS MODULE (TABLES 36-40)
-- =============================================

-- =============================================
-- ENUMS FOR INVENTORY & POS
-- =============================================

CREATE TYPE inventory_change_type_enum AS ENUM ('stock_in', 'stock_out', 'adjustment', 'sale', 'return');
CREATE TYPE pos_payment_method_enum AS ENUM ('cash', 'gcash', 'bank_transfer');
CREATE TYPE pos_sale_status_enum AS ENUM ('pending', 'completed', 'cancelled', 'refunded');


-- =============================================
-- 36. INVENTORY LOGS
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
-- 37. POS SALES (Point of Sale Transactions)
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
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (staff_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (cancelled_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_pos_sales_sale_number ON pos_sales(sale_number);
CREATE INDEX idx_pos_sales_staff_id ON pos_sales(staff_id);
CREATE INDEX idx_pos_sales_status ON pos_sales(status);
CREATE INDEX idx_pos_sales_payment_status ON pos_sales(payment_status);
CREATE INDEX idx_pos_sales_created_at ON pos_sales(created_at DESC);
CREATE INDEX idx_pos_sales_completed_at ON pos_sales(completed_at DESC);
CREATE INDEX idx_pos_sales_deleted_at ON pos_sales(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 38. POS SALE ITEMS
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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (sale_id) REFERENCES pos_sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL) OR (service_id IS NOT NULL))
);

CREATE INDEX idx_pos_sale_items_sale_id ON pos_sale_items(sale_id);
CREATE INDEX idx_pos_sale_items_product_id ON pos_sale_items(product_id);
CREATE INDEX idx_pos_sale_items_service_id ON pos_sale_items(service_id);
CREATE INDEX idx_pos_sale_items_deleted_at ON pos_sale_items(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 39. POS PAYMENTS
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
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (sale_id) REFERENCES pos_sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_pos_payments_sale_id ON pos_payments(sale_id);
CREATE INDEX idx_pos_payments_status ON pos_payments(status);
CREATE INDEX idx_pos_payments_created_at ON pos_payments(created_at DESC);
CREATE INDEX idx_pos_payments_deleted_at ON pos_payments(deleted_at) WHERE deleted_at IS NOT NULL;


-- =============================================
-- 40. LOW STOCK ALERTS
-- =============================================
-- Low stock alerts are now handled via the notifications table
-- with notification_type = 'low_stock'. This table is kept for
-- backward compatibility but new alerts should use notifications.
-- TODO: Migrate existing data and remove this table in a future release.

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
    (gen_random_uuid(), 'manage_inventory', 'Create, update, manage product inventory', 'inventory'),
    (gen_random_uuid(), 'view_inventory', 'View inventory and stock levels', 'inventory'),
    (gen_random_uuid(), 'adjust_stock', 'Add/remove stock and adjust inventory', 'inventory'),
    (gen_random_uuid(), 'view_inventory_logs', 'View inventory transaction logs', 'inventory'),
    (gen_random_uuid(), 'manage_pos', 'Create, manage POS sales', 'pos'),
    (gen_random_uuid(), 'view_pos', 'View POS sales and transactions', 'pos'),
    (gen_random_uuid(), 'void_pos_sale', 'Void/cancel POS transactions', 'pos'),
    (gen_random_uuid(), 'verify_pos_payment', 'Verify and authorize POS payments', 'pos')
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- ASSIGN INVENTORY/POS PERMISSIONS TO ROLES
-- =============================================

-- Staff: Limited inventory view, full POS access, verify payments
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'staff'
  AND p.name IN ('view_inventory', 'adjust_stock', 'manage_pos', 'view_pos', 'verify_pos_payment')
ON CONFLICT DO NOTHING;

-- Admin: Full inventory and POS management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN ('manage_inventory', 'view_inventory', 'adjust_stock', 'view_inventory_logs',
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

DROP TRIGGER IF EXISTS trg_addresses_set_updated_at ON addresses;
CREATE TRIGGER trg_addresses_set_updated_at
BEFORE UPDATE ON addresses
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

DROP TRIGGER IF EXISTS trg_inventory_set_updated_at ON inventory;
CREATE TRIGGER trg_inventory_set_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_product_images_set_updated_at ON product_images;
CREATE TRIGGER trg_product_images_set_updated_at
BEFORE UPDATE ON product_images
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

DROP TRIGGER IF EXISTS trg_customization_parts_set_updated_at ON customization_parts;
CREATE TRIGGER trg_customization_parts_set_updated_at
BEFORE UPDATE ON customization_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON orders;
CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_order_items_set_updated_at ON order_items;
CREATE TRIGGER trg_order_items_set_updated_at
BEFORE UPDATE ON order_items
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

DROP TRIGGER IF EXISTS trg_unavailable_dates_set_updated_at ON unavailable_dates;
CREATE TRIGGER trg_unavailable_dates_set_updated_at
BEFORE UPDATE ON unavailable_dates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_set_updated_at ON projects;
CREATE TRIGGER trg_projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_tasks_set_updated_at ON project_tasks;
CREATE TRIGGER trg_project_tasks_set_updated_at
BEFORE UPDATE ON project_tasks
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

DROP TRIGGER IF EXISTS trg_builder_model_images_set_updated_at ON builder_model_images;
CREATE TRIGGER trg_builder_model_images_set_updated_at
BEFORE UPDATE ON builder_model_images
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_guitar_builder_parts_set_updated_at ON guitar_builder_parts;
CREATE TRIGGER trg_guitar_builder_parts_set_updated_at
BEFORE UPDATE ON guitar_builder_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

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

DROP TRIGGER IF EXISTS trg_default_workflow_steps_set_updated_at ON default_workflow_steps;
CREATE TRIGGER trg_default_workflow_steps_set_updated_at
BEFORE UPDATE ON default_workflow_steps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_default_workflow_tasks_set_updated_at ON default_workflow_tasks;
CREATE TRIGGER trg_default_workflow_tasks_set_updated_at
BEFORE UPDATE ON default_workflow_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_set_updated_at ON roles;
CREATE TRIGGER trg_roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_permissions_set_updated_at ON permissions;
CREATE TRIGGER trg_permissions_set_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pos_sales_set_updated_at ON pos_sales;
CREATE TRIGGER trg_pos_sales_set_updated_at
BEFORE UPDATE ON pos_sales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pos_sale_items_set_updated_at ON pos_sale_items;
CREATE TRIGGER trg_pos_sale_items_set_updated_at
BEFORE UPDATE ON pos_sale_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pos_payments_set_updated_at ON pos_payments;
CREATE TRIGGER trg_pos_payments_set_updated_at
BEFORE UPDATE ON pos_payments
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


-- =============================================
-- PAYMENT VERIFICATION WORKFLOW TABLES
-- =============================================

-- Payment Audit Log for tracking admin actions
-- Uses the consolidated audit_logs table instead of a separate table.
-- See audit_logs table (section 4) with entity_type = 'payment'.

-- =============================================
-- PAYMENT WORKFLOW TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION ensure_payment_for_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending'::payment_status_enum AND (
        NULLIF(BTRIM(COALESCE(NEW.reference_number, '')), '') IS NOT NULL OR
        NULLIF(BTRIM(COALESCE(NEW.proof_url, '')), '') IS NOT NULL
    ) THEN
        NEW.status := 'for_verification'::payment_status_enum;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_order_payment_status_from_payment()
RETURNS TRIGGER AS $$
DECLARE
    next_order_status order_payment_status_enum;
    next_reference_number TEXT;
BEGIN
    next_reference_number := NULLIF(BTRIM(COALESCE(NEW.reference_number, '')), '');

    next_order_status := CASE
        WHEN NEW.status = 'verified'::payment_status_enum THEN 'approved'::order_payment_status_enum
        WHEN NEW.status = 'for_verification'::payment_status_enum THEN 'proof_submitted'::order_payment_status_enum
        WHEN NEW.status = 'rejected'::payment_status_enum THEN 'rejected'::order_payment_status_enum
        WHEN NEW.status = 'cancelled'::payment_status_enum THEN 'pending'::order_payment_status_enum
        WHEN NEW.status = 'refunded'::payment_status_enum THEN 'failed'::order_payment_status_enum
        WHEN NEW.status = 'pending'::payment_status_enum THEN 'pending'::order_payment_status_enum
        ELSE NULL
    END;

    IF next_order_status IS NOT NULL THEN
        UPDATE orders
        SET payment_status = next_order_status,
            payment_reference_number = COALESCE(next_reference_number, payment_reference_number),
            proof_submitted_at = CASE
                WHEN next_order_status = 'proof_submitted'::order_payment_status_enum
                    THEN COALESCE(proof_submitted_at, NEW.created_at, now())
                ELSE proof_submitted_at
            END,
            reviewed_at = CASE
                WHEN next_order_status = 'approved'::order_payment_status_enum
                    THEN COALESCE(reviewed_at, now())
                ELSE reviewed_at
            END,
            updated_at = now()
        WHERE order_id = NEW.order_id
          AND (
              payment_status IS DISTINCT FROM next_order_status OR
              payment_reference_number IS DISTINCT FROM COALESCE(next_reference_number, payment_reference_number)
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_force_for_verification ON payments;
CREATE TRIGGER trg_payments_force_for_verification
BEFORE INSERT OR UPDATE OF status, reference_number, proof_url ON payments
FOR EACH ROW
EXECUTE FUNCTION ensure_payment_for_verification_status();

DROP TRIGGER IF EXISTS trg_sync_orders_from_payments ON payments;
CREATE TRIGGER trg_sync_orders_from_payments
AFTER INSERT OR UPDATE OF status, reference_number, proof_url ON payments
FOR EACH ROW
EXECUTE FUNCTION sync_order_payment_status_from_payment();