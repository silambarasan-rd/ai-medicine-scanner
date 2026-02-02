import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  title: string;
  body: string;
  medicineId: string;
  scheduledDatetime: string;
  notificationType: 'reminder' | 'confirmation';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // This function should be called by a cron job or scheduled task
    // It checks for notifications that need to be sent
    const now = new Date();
    const nowISO = now.toISOString();

    // Get pending notifications that should be sent now
    // The notification should be sent at: scheduled_datetime - minutes_before
    const { data: notifications, error: fetchError } = await supabaseClient
      .from('notification_queue')
      .select(`
        *,
        user_medicines (
          name,
          dosage,
          meal_timing,
          timing
        )
      `)
      .is('sent_at', null)
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter notifications that should be sent now (accounting for minutes_before)
    const notificationsToSend = notifications.filter(notification => {
      const scheduledTime = new Date(notification.scheduled_datetime);
      const sendTime = new Date(scheduledTime.getTime() - (notification.minutes_before * 60 * 1000));
      const timeDiff = Math.abs(now.getTime() - sendTime.getTime());
      // Send if within 2 minutes of scheduled send time (allows for cron timing variations)
      return timeDiff <= 2 * 60 * 1000;
    });

    console.log(`Found ${notifications.length} pending notifications, ${notificationsToSend.length} ready to send`);

    if (notificationsToSend.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No notifications ready to send at this time',
          pending: notifications.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const notification of notificationsToSend) {
      try {
        // Get push subscriptions for this user
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', notification.user_id);

        if (subError || !subscriptions || subscriptions.length === 0) {
          console.error('No subscriptions found for user:', notification.user_id);
          
          // Mark as error
          await supabaseClient
            .from('notification_queue')
            .update({ 
              error: 'No active subscriptions',
              sent_at: nowISO
            })
            .eq('id', notification.id);
          
          continue;
        }

        // Prepare notification payload
        const medicine = notification.user_medicines;
        const scheduledTime = new Date(notification.scheduled_datetime);
        
        // Convert UTC to IST (UTC+5:30)
        const istTime = new Date(scheduledTime.getTime() + (5.5 * 60 * 60 * 1000));
        const timeStr = istTime.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        });

        let title = '';
        let body = '';

        if (notification.notification_type === 'reminder') {
          const minsBeforeText = notification.minutes_before === 30 ? '30 minutes' : '15 minutes';
          title = `Medicine Reminder - ${minsBeforeText}`;
          body = `${medicine.name} ${medicine.dosage || ''} at ${timeStr} (${medicine.meal_timing} meal)`;
        } else {
          title = `Time to take your medicine!`;
          body = `${medicine.name} ${medicine.dosage || ''} - ${medicine.meal_timing} meal`;
        }

        const payload: NotificationPayload = {
          title,
          body,
          medicineId: notification.medicine_id,
          scheduledDatetime: notification.scheduled_datetime,
          notificationType: notification.notification_type
        };

        // Configure VAPID keys
        const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
        const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
        const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@yourapp.com';

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
          throw new Error('VAPID keys not configured. Generate with: npx web-push generate-vapid-keys');
        }

        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        // Send to all subscriptions for this user
        const sendPromises = subscriptions.map(async (subscription) => {
          try {
            // Prepare subscription object for web-push
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            };

            // Prepare notification payload with action buttons
            const notificationPayload = JSON.stringify({
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
                url: payload.notificationType === 'reminder' 
                  ? `/medicine-details/${payload.medicineId}`
                  : '/dashboard'
              },
              actions: payload.notificationType === 'confirmation' ? [
                { action: 'taken', title: '✓ Taken' },
                { action: 'skip', title: '✗ Skip' }
              ] : [],
              requireInteraction: payload.notificationType === 'confirmation'
            });

            // Send the push notification
            await webpush.sendNotification(pushSubscription, notificationPayload);
            
            console.log('✓ Notification sent:', {
              endpoint: subscription.endpoint.substring(0, 50) + '...',
              title: payload.title
            });

            return { success: true, endpoint: subscription.endpoint };
          } catch (error) {
            console.error('✗ Error sending to subscription:', error);
            
            // If subscription is no longer valid (410 Gone), remove it
            if (error.statusCode === 410) {
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

        // Mark notification as sent
        await supabaseClient
          .from('notification_queue')
          .update({ sent_at: nowISO })
          .eq('id', notification.id);

        // Generate next occurrence for recurring medicines (only for confirmation type)
        if (notification.notification_type === 'confirmation' && notification.user_medicines.occurrence !== 'once') {
          try {
            const medicine = notification.user_medicines;
            const currentScheduledTime = new Date(notification.scheduled_datetime);
            let nextScheduledTime = new Date(currentScheduledTime);

            // Calculate next occurrence based on medicine type
            if (medicine.occurrence === 'daily') {
              nextScheduledTime.setDate(nextScheduledTime.getDate() + 1);
            } else if (medicine.occurrence === 'weekly') {
              nextScheduledTime.setDate(nextScheduledTime.getDate() + 7);
            } else if (medicine.occurrence === 'monthly') {
              nextScheduledTime.setMonth(nextScheduledTime.getMonth() + 1);
            }

            const nextScheduledISO = nextScheduledTime.toISOString();
            const reminderMinutes = medicine.meal_timing === 'after' ? 30 : 15;

            // Insert reminder for next occurrence
            const reminderResult = await supabaseClient
              .from('notification_queue')
              .insert({
                user_id: notification.user_id,
                medicine_id: notification.medicine_id,
                scheduled_datetime: nextScheduledISO,
                notification_type: 'reminder',
                minutes_before: reminderMinutes
              });

            if (reminderResult.error) {
              throw new Error(`Failed to insert reminder: ${reminderResult.error.message}`);
            }

            // Insert confirmation for next occurrence
            const confirmationResult = await supabaseClient
              .from('notification_queue')
              .insert({
                user_id: notification.user_id,
                medicine_id: notification.medicine_id,
                scheduled_datetime: nextScheduledISO,
                notification_type: 'confirmation',
                minutes_before: 0
              });

            if (confirmationResult.error) {
              throw new Error(`Failed to insert confirmation: ${confirmationResult.error.message}`);
            }

            console.log('✓ Generated next occurrence:', {
              medicineId: notification.medicine_id,
              nextScheduled: nextScheduledISO
            });
          } catch (error) {
            console.error('⚠ Failed to generate next occurrence:', error);
            // Don't throw - continue processing other notifications
          }
        }

        results.push({
          notificationId: notification.id,
          medicineId: notification.medicine_id,
          sent: true
        });

      } catch (error) {
        console.error('Error processing notification:', error);
        
        // Mark as error
        await supabaseClient
          .from('notification_queue')
          .update({ 
            error: error.message,
            sent_at: nowISO
          })
          .eq('id', notification.id);

        results.push({
          notificationId: notification.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notifications processed',
        count: notifications.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
