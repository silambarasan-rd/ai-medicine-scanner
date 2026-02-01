-- Migration: Add Push Notifications and Medicine Confirmations
-- Description: Creates tables for push subscriptions and medicine intake confirmations
-- Author: MathirAI Team
-- Date: 2026-02-01

-- ============================================================================
-- TABLE: push_subscriptions
-- ============================================================================
-- Stores Web Push API subscription info for each user/device

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, endpoint)
);

-- ============================================================================
-- TABLE: medicine_confirmations
-- ============================================================================
-- Stores whether user confirmed taking medicine at scheduled time

CREATE TABLE medicine_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES user_medicines(id) ON DELETE CASCADE,
  scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  taken BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, medicine_id, scheduled_datetime)
);

-- ============================================================================
-- TABLE: notification_queue
-- ============================================================================
-- Queue of pending notifications to be sent

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES user_medicines(id) ON DELETE CASCADE,
  scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  notification_type VARCHAR(20) NOT NULL, -- 'reminder' or 'confirmation'
  minutes_before INTEGER NOT NULL, -- 30, 15, or 0
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ROW LEVEL SECURITY: push_subscriptions
-- ============================================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
ON push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- ROW LEVEL SECURITY: medicine_confirmations
-- ============================================================================

ALTER TABLE medicine_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own confirmations"
ON medicine_confirmations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own confirmations"
ON medicine_confirmations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own confirmations"
ON medicine_confirmations FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================================================
-- ROW LEVEL SECURITY: notification_queue
-- ============================================================================

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON notification_queue FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage all notifications (for edge functions)
CREATE POLICY "Service role can manage all notifications"
ON notification_queue
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_medicine_confirmations_user_id ON medicine_confirmations(user_id);
CREATE INDEX idx_medicine_confirmations_medicine_id ON medicine_confirmations(medicine_id);
CREATE INDEX idx_medicine_confirmations_scheduled_datetime ON medicine_confirmations(scheduled_datetime);
CREATE INDEX idx_notification_queue_scheduled_datetime ON notification_queue(scheduled_datetime);
CREATE INDEX idx_notification_queue_pending ON notification_queue(user_id, sent_at) WHERE sent_at IS NULL;

-- ============================================================================
-- FUNCTION: Generate notification queue for new medicines
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_notification_queue()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_dt TIMESTAMP WITH TIME ZONE;
  reminder_minutes INTEGER;
BEGIN
  -- Combine scheduled_date and timing into a full datetime
  scheduled_dt := (NEW.scheduled_date || ' ' || NEW.timing)::TIMESTAMP WITH TIME ZONE;
  
  -- Determine reminder time based on meal timing
  IF NEW.meal_timing = 'after' THEN
    reminder_minutes := 30;
  ELSE
    reminder_minutes := 15;
  END IF;
  
  -- Insert reminder notification (e.g., 30 or 15 mins before)
  INSERT INTO notification_queue (user_id, medicine_id, scheduled_datetime, notification_type, minutes_before)
  VALUES (NEW.user_id, NEW.id, scheduled_dt, 'reminder', reminder_minutes);
  
  -- Insert confirmation notification (at exact time)
  INSERT INTO notification_queue (user_id, medicine_id, scheduled_datetime, notification_type, minutes_before)
  VALUES (NEW.user_id, NEW.id, scheduled_dt, 'confirmation', 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate notifications when medicine is added
CREATE TRIGGER create_notification_queue_on_medicine_insert
  AFTER INSERT ON user_medicines
  FOR EACH ROW
  EXECUTE FUNCTION generate_notification_queue();
