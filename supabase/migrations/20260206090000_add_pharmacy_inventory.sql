-- Migration: Add pharmacy inventory and tags
-- Description: Adds pharmacy inventory tables and dose tracking fields
-- Author: MathirAI Team
-- Date: 2026-02-06

-- ==========================================================================
-- TABLE: pharmacy_medicines
-- ==========================================================================

CREATE TABLE pharmacy_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(255),
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'tablet' or 'syrup'
  safety_warnings TEXT,
  image_url TEXT,
  available_stock NUMERIC NOT NULL DEFAULT 0,
  stock_unit VARCHAR(20) NOT NULL DEFAULT 'tablet', -- 'tablet' or 'ml'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================================
-- TABLE: tags
-- ==========================================================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- ==========================================================================
-- TABLE: medicine_tags
-- ==========================================================================

CREATE TABLE medicine_tags (
  medicine_id UUID NOT NULL REFERENCES pharmacy_medicines(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (medicine_id, tag_id)
);

-- ==========================================================================
-- TABLE UPDATE: user_medicines
-- ==========================================================================

ALTER TABLE user_medicines
  ADD COLUMN pharmacy_medicine_id UUID REFERENCES pharmacy_medicines(id) ON DELETE SET NULL,
  ADD COLUMN dose_amount NUMERIC,
  ADD COLUMN dose_unit VARCHAR(20);

-- ==========================================================================
-- ROW LEVEL SECURITY: pharmacy_medicines
-- ==========================================================================

ALTER TABLE pharmacy_medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pharmacy medicines"
ON pharmacy_medicines FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pharmacy medicines"
ON pharmacy_medicines FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pharmacy medicines"
ON pharmacy_medicines FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pharmacy medicines"
ON pharmacy_medicines FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================================================
-- ROW LEVEL SECURITY: tags
-- ==========================================================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags"
ON tags FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
ON tags FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
ON tags FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
ON tags FOR DELETE
USING (auth.uid() = user_id);

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads for medicine images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medicine-images'
  AND auth.role() = 'authenticated'
);

-- Allow public read
CREATE POLICY "Allow public read for medicine images"
ON storage.objects FOR SELECT
USING (bucket_id = 'medicine-images');

-- ==========================================================================
-- ROW LEVEL SECURITY: medicine_tags
-- ==========================================================================

ALTER TABLE medicine_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own medicine tags"
ON medicine_tags FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pharmacy_medicines pm
    WHERE pm.id = medicine_tags.medicine_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own medicine tags"
ON medicine_tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pharmacy_medicines pm
    WHERE pm.id = medicine_tags.medicine_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own medicine tags"
ON medicine_tags FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM pharmacy_medicines pm
    WHERE pm.id = medicine_tags.medicine_id
    AND pm.user_id = auth.uid()
  )
);

-- ==========================================================================
-- INDEXES
-- ==========================================================================

CREATE INDEX idx_pharmacy_medicines_user_id ON pharmacy_medicines(user_id);
CREATE INDEX idx_pharmacy_medicines_name ON pharmacy_medicines(name);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_medicine_tags_medicine_id ON medicine_tags(medicine_id);
CREATE INDEX idx_medicine_tags_tag_id ON medicine_tags(tag_id);
