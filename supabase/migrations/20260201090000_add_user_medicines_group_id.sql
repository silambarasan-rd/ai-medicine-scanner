-- Migration: Add group_id to user_medicines for multi-time schedules
-- Description: Adds group_id column to link multiple schedule entries for one medicine
-- Author: MathirAI Team
-- Date: 2026-02-01

ALTER TABLE user_medicines
ADD COLUMN group_id UUID;

-- Backfill existing rows to preserve single-entry grouping
UPDATE user_medicines
SET group_id = id
WHERE group_id IS NULL;

-- Make group_id required for new rows
ALTER TABLE user_medicines
ALTER COLUMN group_id SET NOT NULL;

-- Index for fast grouping
CREATE INDEX idx_user_medicines_group_id ON user_medicines(group_id);
