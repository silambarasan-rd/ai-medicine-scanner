-- Migration: Add hospitals directory
-- Description: Adds global hospitals table for directory browsing
-- Author: MathirAI Team
-- Date: 2026-02-10

-- ==========================================================================
-- TABLE: hospitals
-- ==========================================================================

CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  district VARCHAR(120),
  speciality VARCHAR(255),
  speciality_code VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================================
-- ROW LEVEL SECURITY: hospitals
-- ==========================================================================

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hospitals"
ON hospitals FOR SELECT
USING (auth.role() = 'authenticated');

-- ==========================================================================
-- INDEXES
-- ==========================================================================

CREATE INDEX idx_hospitals_name ON hospitals(name);
CREATE INDEX idx_hospitals_district ON hospitals(district);
CREATE INDEX idx_hospitals_speciality ON hospitals(speciality);
