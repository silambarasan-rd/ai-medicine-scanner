export interface NotificationPayload {
  title: string;
  body: string;
  medicineId: string;
  scheduledDatetime: string;
  notificationType: 'reminder' | 'confirmation';
}

export interface MedicineSummary {
  name: string;
  dosage: string | null;
  meal_timing: string;
  timing: string;
  occurrence: string | null;
  custom_occurrence: string | null;
}

export interface NotificationQueueItem {
  id: string;
  user_id: string;
  medicine_id: string;
  scheduled_datetime: string;
  notification_type: 'reminder' | 'confirmation';
  minutes_before: number;
  user_medicines: MedicineSummary;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}
