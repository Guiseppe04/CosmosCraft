-- Migration: Add project claiming support
-- Adds claimed_by, claimed_at columns to projects table

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_claimed_by ON projects(claimed_by);

-- Initialize manufacturing milestones/subtasks for existing projects that don't have them
-- This is a one-time data migration for projects in 'not_started' or 'in_progress' status
-- that don't have any milestones yet.