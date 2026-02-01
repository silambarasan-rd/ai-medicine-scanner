-- Example SQL to manually test notification queue generation

-- View all pending notifications
SELECT 
  nq.*,
  um.name as medicine_name,
  um.meal_timing,
  um.timing as scheduled_time
FROM notification_queue nq
JOIN user_medicines um ON um.id = nq.medicine_id
WHERE nq.sent_at IS NULL
ORDER BY nq.scheduled_datetime ASC;

-- View confirmation history
SELECT 
  mc.*,
  um.name as medicine_name,
  um.dosage
FROM medicine_confirmations mc
JOIN user_medicines um ON um.id = mc.medicine_id
ORDER BY mc.scheduled_datetime DESC
LIMIT 20;

-- Check user's push subscriptions
SELECT 
  id,
  user_id,
  endpoint,
  user_agent,
  created_at
FROM push_subscriptions
WHERE user_id = '<your-user-id>';

-- Manually create test notification (for debugging)
INSERT INTO notification_queue (user_id, medicine_id, scheduled_datetime, notification_type, minutes_before)
VALUES (
  '<your-user-id>',
  '<medicine-id>',
  NOW() + INTERVAL '2 minutes',
  'confirmation',
  0
);

-- View adherence statistics
SELECT 
  um.name,
  COUNT(*) as total_scheduled,
  SUM(CASE WHEN mc.taken THEN 1 ELSE 0 END) as taken,
  SUM(CASE WHEN mc.skipped THEN 1 ELSE 0 END) as skipped,
  ROUND(
    100.0 * SUM(CASE WHEN mc.taken THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as adherence_rate
FROM medicine_confirmations mc
JOIN user_medicines um ON um.id = mc.medicine_id
WHERE mc.user_id = '<your-user-id>'
  AND mc.scheduled_datetime >= NOW() - INTERVAL '30 days'
GROUP BY um.name, um.id
ORDER BY adherence_rate DESC;

-- Clean up old sent notifications (optional maintenance)
DELETE FROM notification_queue
WHERE sent_at IS NOT NULL
  AND sent_at < NOW() - INTERVAL '7 days';
