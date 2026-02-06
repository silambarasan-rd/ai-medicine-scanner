import webpush from 'npm:web-push@3.6.7';
import type {
  NotificationPayload,
  NotificationQueueItem,
  PushSubscriptionRow,
} from './types.ts';
import type { SupabaseClient } from './supabase.ts';

const buildNotificationPayload = (
  notification: NotificationQueueItem
): NotificationPayload => {
  const medicine = notification.user_medicines;
  const scheduledTime = new Date(notification.scheduled_datetime);

  const timeStr = scheduledTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  let title = '';
  let body = '';

  if (notification.notification_type === 'reminder') {
    const minsBeforeText = notification.minutes_before === 30 ? '30 minutes' : '15 minutes';
    title = `Medicine Reminder - ${minsBeforeText}`;
    body = `${medicine.name} ${medicine.dosage || ''} at ${timeStr} (${medicine.meal_timing} meal)`;
  } else {
    title = 'Time to take your medicine!';
    body = `${medicine.name} ${medicine.dosage || ''} - ${medicine.meal_timing} meal`;
  }

  return {
    title,
    body,
    medicineId: notification.medicine_id,
    scheduledDatetime: notification.scheduled_datetime,
    notificationType: notification.notification_type,
  };
};

const buildWebPushPayload = (
  payload: NotificationPayload,
  notification: NotificationQueueItem
) => {
  const medicine = notification.user_medicines;

  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `medicine-${payload.medicineId}-${payload.scheduledDatetime}`,
    data: {
      medicineId: payload.medicineId,
      medicineName: medicine.name,
      dosage: medicine.dosage,
      mealTiming: medicine.meal_timing,
      scheduledDatetime: payload.scheduledDatetime,
      notificationType: payload.notificationType,
      url:
        payload.notificationType === 'reminder'
          ? `/medicine-details/${payload.medicineId}`
          : '/dashboard',
    },
    actions:
      payload.notificationType === 'confirmation'
        ? [
            { action: 'taken', title: '✓ Taken' },
            { action: 'skip', title: '✗ Skip' },
          ]
        : [],
    requireInteraction: payload.notificationType === 'confirmation',
  });
};

const configureVapidKeys = () => {
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT =
    Deno.env.get('VAPID_SUBJECT') || 'mailto:support@yourapp.com';

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys not configured. Generate with: npx web-push generate-vapid-keys');
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
};

export const sendPushToSubscriptions = async (
  supabaseClient: SupabaseClient,
  notification: NotificationQueueItem
): Promise<{ status: 'sent' | 'no-subscriptions' }> => {
  const { data: subscriptions, error: subError } = await supabaseClient
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', notification.user_id);

  if (subError || !subscriptions || subscriptions.length === 0) {
    console.error('No subscriptions found for user:', notification.user_id);
    return { status: 'no-subscriptions' };
  }

  configureVapidKeys();

  const payload = buildNotificationPayload(notification);
  const notificationPayload = buildWebPushPayload(payload, notification);

  const sendPromises = subscriptions.map(async (subscription: PushSubscriptionRow) => {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, notificationPayload);

      console.log('✓ Notification sent:', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        title: payload.title,
      });

      return { success: true, endpoint: subscription.endpoint };
    } catch (error) {
      console.error('✗ Error sending to subscription:', error);
      const err = error as { statusCode?: number };

      if (err?.statusCode === 410) {
        await supabaseClient
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        console.log('Removed invalid subscription');
      }

      return { success: false, endpoint: subscription.endpoint, error: String(error) };
    }
  });

  await Promise.all(sendPromises);

  return { status: 'sent' };
};
