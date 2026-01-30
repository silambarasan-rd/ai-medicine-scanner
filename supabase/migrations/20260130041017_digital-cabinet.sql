-- Migration: Digital Cabinet Tables and Security Policies
-- Description: Creates user_profiles and user_medicines tables with RLS policies
-- Author: MathirAI Team
-- Date: 2026-01-30

-- ============================================================================
-- TABLE: user_profiles
-- ============================================================================
-- Stores extended user profile information beyond what's in auth.users
-- The id column references auth.users(id) to keep profiles in sync with authenticated users

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  emergency_contact TEXT,
  medical_conditions TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: user_medicines
-- ============================================================================
-- Stores medicines added by users with scheduling information
-- Supports various occurrence patterns (once, daily, weekly, monthly, custom)

CREATE TABLE user_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(255),
  occurrence VARCHAR(50) NOT NULL, -- 'once', 'daily', 'weekly', 'monthly', 'custom'
  custom_occurrence VARCHAR(255), -- For custom patterns like "2 times per week"
  scheduled_date DATE NOT NULL,
  timing TIME NOT NULL, -- Time of day to take the medicine
  meal_timing VARCHAR(50) NOT NULL, -- 'before', 'with', 'after'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ROW LEVEL SECURITY: user_profiles
-- ============================================================================
-- Enable RLS to ensure users can only access their own profile data

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   
CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- ROW LEVEL SECURITY: user_medicines
-- ============================================================================
-- Enable RLS to ensure users can only access their own medicine data

ALTER TABLE user_medicines ENABLE ROW LEVEL SECURITY;
   
CREATE POLICY "Users can view own medicines"
ON user_medicines FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medicines"
ON user_medicines FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medicines"
ON user_medicines FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medicines"
ON user_medicines FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Create indexes for better query performance

-- Index on user_id for faster lookups when querying medicines by user
CREATE INDEX idx_user_medicines_user_id ON user_medicines(user_id);

-- Index on scheduled_date for faster calendar queries
CREATE INDEX idx_user_medicines_scheduled_date ON user_medicines(scheduled_date);