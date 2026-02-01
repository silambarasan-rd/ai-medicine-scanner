-- Fix notification_queue RLS policy to allow trigger inserts
-- When a medicine is updated, the trigger needs INSERT permission

-- Add INSERT policy for users on their own notification queue
CREATE POLICY "Users can insert own notifications"
ON notification_queue FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for edge functions to mark as sent
CREATE POLICY "Service role can update notifications"
ON notification_queue FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

-- Recreate trigger function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION generate_notification_queue()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_dt TIMESTAMP WITH TIME ZONE;
  reminder_minutes INTEGER;
BEGIN
  -- If updating, first delete old notifications
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM notification_queue 
    WHERE medicine_id = OLD.id 
    AND sent_at IS NULL;
  END IF;
  
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

-- Add trigger for UPDATE operations
CREATE TRIGGER update_notification_queue_on_medicine_update
  AFTER UPDATE ON user_medicines
  FOR EACH ROW
  WHEN (
    OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date OR
    OLD.timing IS DISTINCT FROM NEW.timing OR
    OLD.meal_timing IS DISTINCT FROM NEW.meal_timing
  )
  EXECUTE FUNCTION generate_notification_queue();
