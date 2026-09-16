-- ============================================================================
-- MIGRATION 24: Ratings and Customization Feedback
-- Adds product_reviews and customization_feedback tables with full eligibility,
-- multi-criteria ratings, image support, moderation, and constraints.
-- ============================================================================

-- 1. Product Reviews Table
CREATE TABLE IF NOT EXISTS product_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    order_item_id BIGINT NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(150),
    comment TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
    admin_notes TEXT,
    moderated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_product_reviews_order_item UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_deleted_at ON product_reviews(deleted_at) WHERE deleted_at IS NOT NULL;


-- 2. Customization Feedback Table
CREATE TABLE IF NOT EXISTS customization_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    overall_rating SMALLINT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    build_quality_rating SMALLINT NOT NULL CHECK (build_quality_rating >= 1 AND build_quality_rating <= 5),
    communication_rating SMALLINT NOT NULL CHECK (communication_rating >= 1 AND communication_rating <= 5),
    accuracy_rating SMALLINT NOT NULL CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    comment TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
    admin_notes TEXT,
    moderated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_customization_feedback_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_customization_feedback_order_id ON customization_feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_customization_feedback_project_id ON customization_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_customization_feedback_user_id ON customization_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_customization_feedback_status ON customization_feedback(status);
CREATE INDEX IF NOT EXISTS idx_customization_feedback_created_at ON customization_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customization_feedback_deleted_at ON customization_feedback(deleted_at) WHERE deleted_at IS NOT NULL;
