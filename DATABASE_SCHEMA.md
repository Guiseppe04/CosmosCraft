# CosmosCraft Database Schema

## Source of truth
- `schema.sql` (root) – single authoritative schema definition for PostgreSQL 15+.

All database structure is defined exclusively in the root `schema.sql`.
No separate migration files, seed scripts, or startup migrations exist.
Run `schema.sql` against a fresh PostgreSQL database to create the full schema.

## Enums and custom PostgreSQL types
- `user_role_enum`: `customer`, `staff`, `admin`, `super_admin`
- `auth_provider_enum`: `local`, `google`, `facebook`
- `guitar_type_enum`: `acoustic`, `electric`, `bass`
- `order_status_enum`: `pending`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`
- `payment_method_enum`: `gcash`, `bank_transfer`, `cash`
- `payment_status_enum`: `pending`, `for_verification`, `verified`, `rejected`, `cancelled`, `refunded`
- `order_payment_status_enum`: `pending`, `proof_submitted`, `under_review`, `approved`, `rejected`, `failed`
- `appointment_status_enum`: `pending`, `confirmed`, `in_progress`, `ready_for_pickup`, `completed`, `cancelled`
- `project_status_enum`: `not_started`, `in_progress`, `completed`, `cancelled`
- `notification_type_enum`: `order_update`, `appointment_reminder`, `system`, `promotional`, `low_stock`
- `inventory_change_type_enum`: `stock_in`, `stock_out`, `adjustment`, `sale`, `return`
- `pos_payment_method_enum`: `cash`, `gcash`, `bank_transfer`
- `pos_sale_status_enum`: `pending`, `completed`, `cancelled`, `refunded`

## Core entities

### `users`
- Primary key: `user_id`
- Unique email, hashed password, name, phone, avatar, role, verification and active status.
- Role stored as `user_role_enum` with default `customer`.
- Supports soft-delete via `deleted_at`.
- Indexes: `email`, `role`, `created_at`, `deleted_at`.

### `refresh_tokens`
- Primary key: `token_id`
- Stores `user_id`, hashed refresh token, expiration, revoked status.
- Cascades delete when user is removed.
- Indexes: `user_id`, `expires_at`.

### `user_identities`
- OAuth / external auth provider table.
- Stores provider tokens and provider identity info.
- Unique constraint on `(provider, provider_user_id)`.
- Indexes: `user_id`, `provider`.

### `roles`, `permissions`, `role_permissions`, `user_roles`
- RBAC tables for roles, permissions, mapping roles to permissions, and assigning roles to users.
- `roles.name` is unique.
- `user_roles` includes `assigned_by`, `is_active`, `expires_at`.
- `role_permissions` and `user_roles` both have unique constraints for pair uniqueness.

## Authentication / Access control

### `otp_codes`
- One-time passcode storage per user.
- Unique per `(user_id, purpose, code)`.
- Indexes: `user_id`, `expires_at`, `is_used`.

### `otp_attempts`
- Tracks OTP request attempts with IP, user agent, and success flag.
- References `otp_codes`.

### `password_reset_tokens`
- Tracks password reset flows with a SHA-256 hash of the reset token (never the raw token), expiration, and single-use consumption.
- Unique `token_hash`.
- `used_at` is set when the token is consumed; `expires_at` is 1 hour from creation.
- Indexes: `user_id`, `expires_at`.

### `notifications`
- Notification feed per user.
- Supports `related_entity_id`, `related_entity_type`, `deleted_at`, `expires_at`.
- Indexes: `user_id`, `is_read`, `created_at`, `deleted_at`.

## Commerce / product catalog

### `categories`
- Self-referential category hierarchy using `parent_id`.
- Includes an active flag and supports soft-delete.
- Indexes: `parent_id`, `deleted_at`.

### `products`
- Product catalog with SKU, brand, category, price, and `is_active`.
- Supports soft-delete.
- Indexes: `sku`, `brand`, `category_id`, `is_active`, `deleted_at`.

### `inventory`
- Tracks stock and cost per product.
- One-to-one relationship with `products` via unique `product_id`.
- Supports soft-delete.
- Indexes: `product_id`, `stock`, `deleted_at`.

### `product_images`
- Multiple images per product.
- Unique primary image enforced by partial unique index on `(product_id, is_primary)`.
- Supports soft-delete.

### `carts` and `cart_items`
- One cart per user.
- Cart items reference either `product_id` or `customization_id`.
- Supports soft-delete on cart_items.

### `customizations` and `customization_parts`
- Saved guitar customizations belonging to users.
- Customization parts reference products and track quantity/price.
- Supports soft-delete.

### `orders`, `order_items`, `payments`, `payment_config`
- Orders store billing/shipping totals, status, payment status, tracking, and fulfillment metadata.
- Order items can reference products or customizations and duplicate SKU/name for history.
- Payments reference orders and optional user / verifier.
- `payment_config` holds payment method settings and instructions.
- Supports soft-delete on orders, order_items, payments.

### Payment verification workflow
- `orders` columns: `payment_reference_number`, `proof_submitted_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `admin_notes`.
- Triggers sync `orders` status from `payments` and enforce `for_verification` status.

## Services and scheduling

### `services`
- Service catalog for appointment bookings. Supports soft-delete.

### `appointments`
- Appointment booking table with flexible JSON fields for services and guitar details.
- Supports customer contact info, schedule, status, payment metadata, and notes.
- Supports soft-delete.
- Indexes: `user_id`, `order_id`, `appointment_type`, `services` (GIN), `scheduled_at`, `status`, `payment_status`, `deleted_at`.

### `unavailable_dates`
- Dates that cannot be booked.
- Ensures unique date and optional recurring flag. Supports soft-delete.

## Project management

### `projects`
- Project record linked to an order and optional pickup appointment.
- Supports soft delete via `deleted_at` and `deleted_by`.
- Indexes: `order_id`, `status`, `fulfillment_method`, `deleted_at`.

### `project_tasks`, `project_team_members`, `project_milestones`, `project_subtasks`
- Task and milestone tracking for projects.
- Team members join users to projects.
- Supports soft-delete.

## Builder / custom parts

### `builder_guitar_types`, `builder_part_categories`, `builder_type_categories`
- Guitar type and part category catalogs.
- Mapping of guitar types to required part categories.

### `builder_model_images`
- Model images for each guitar type.

### `guitar_builder_parts`
- Builder parts inventory with type, category, pricing, stock, metadata.
- Indexed for active parts, category, guitar type, and folder lookup.

## Inventory and POS support

### `inventory_logs`
- Tracks inventory changes across stock operations.

### `pos_sales`, `pos_sale_items`, `pos_payments`
- Point-of-sale transactions, sale line items, and payment tracking.

### `low_stock_alerts`
- Alerts for low inventory levels per product.

## Database triggers and functions
- `set_updated_at()` automatically refreshes `updated_at` on mutable tables.
- `ensure_payment_for_verification_status()` sets `payments.status` to `for_verification` when proof or reference is present.
- `sync_order_payment_status_from_payment()` propagates payment status changes into related `orders` fields.
- `normalize_guitar_builder_part()` normalizes builder part category/type and folder key values.