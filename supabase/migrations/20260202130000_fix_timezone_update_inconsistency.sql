-- Fix timezone handling inconsistency in notification queue
-- The issue: UPDATE operations were using "AT TIME ZONE 'UTC'" which treats the input as if it's already UTC
-- The fix: Use proper timezone conversion like INSERT operations

-- Update the trigger function with correct timezone handling for both INSERT and UPDATE
CREATE OR REPLACE FUNCTION generate_notification_queue()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_dt TIMESTAMP WITH TIME ZONE;
  reminder_minutes INTEGER;
  user_tz VARCHAR(50);
BEGIN
  -- If updating, delete old pending notifications
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM notification_queue 
    WHERE medicine_id = OLD.id 
    AND sent_at IS NULL;
  END IF;
  
  -- Get user timezone (default to UTC if not set)
  user_tz := COALESCE(NEW.timezone, 'UTC');
  
  -- Combine scheduled_date and timing, then convert from user timezone to UTC
  -- This is the correct way for both INSERT and UPDATE operations
  -- First create timestamp in user's timezone, then convert to UTC
  scheduled_dt := timezone('UTC', timezone(user_tz, (NEW.scheduled_date::TEXT || ' ' || NEW.timing::TEXT)::TIMESTAMP));
  
  -- Determine reminder time based on meal timing
  IF NEW.meal_timing = 'after' THEN
    reminder_minutes := 30;
  ELSE
    reminder_minutes := 15;
  END IF;
  
  -- Only create entries if the scheduled time is in the future
  IF scheduled_dt > NOW() THEN
    -- Insert reminder notification
    INSERT INTO notification_queue (user_id, medicine_id, scheduled_datetime, notification_type, minutes_before)
    VALUES (NEW.user_id, NEW.id, scheduled_dt, 'reminder', reminder_minutes);
    
    -- Insert confirmation notification (at exact time)
    INSERT INTO notification_queue (user_id, medicine_id, scheduled_datetime, notification_type, minutes_before)
    VALUES (NEW.user_id, NEW.id, scheduled_dt, 'confirmation', 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This fixes the inconsistency where:
-- - INSERT was using: timezone('UTC', timezone(user_tz, ...)) ✓ CORRECT
-- - UPDATE was using: ... AT TIME ZONE 'UTC' ✗ WRONG (treats input as UTC, not user timezone)
-- Now both INSERT and UPDATE use the same correct timezone conversion logic
