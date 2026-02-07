-- Migration: Add pharmacy stock history
-- Description: Adds stock history tracking for pharmacy medicines
-- Author: MathirAI Team
-- Date: 2026-02-07

-- ==========================================================================
-- TABLE: pharmacy_stock_history
-- ==========================================================================

CREATE TABLE pharmacy_stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES pharmacy_medicines(id) ON DELETE CASCADE,
  delta NUMERIC NOT NULL,
  before_stock NUMERIC NOT NULL,
  after_stock NUMERIC NOT NULL,
  stock_unit VARCHAR(20) NOT NULL,
  source VARCHAR(30) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pharmacy_stock_history_source_check
    CHECK (source IN ('initial_stock', 'refill', 'taken', 'manual_adjustment'))
);

-- ==========================================================================
-- ROW LEVEL SECURITY: pharmacy_stock_history
-- ==========================================================================

ALTER TABLE pharmacy_stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pharmacy stock history"
ON pharmacy_stock_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pharmacy stock history"
ON pharmacy_stock_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ==========================================================================
-- INDEXES
-- ==========================================================================

CREATE INDEX idx_pharmacy_stock_history_user_id ON pharmacy_stock_history(user_id);
CREATE INDEX idx_pharmacy_stock_history_medicine_id ON pharmacy_stock_history(medicine_id);
CREATE INDEX idx_pharmacy_stock_history_created_at ON pharmacy_stock_history(created_at);
