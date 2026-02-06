import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from './lib/cors.ts';
import { filterNotificationsToSend, getNextScheduledTime } from './lib/notification-scheduling.ts';
import { sendPushToSubscriptions } from './lib/push.ts';
import { createSupabaseClient } from './lib/supabase.ts';
import type { NotificationQueueItem } from './lib/types.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createSupabaseClient();

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
          timing,
          occurrence,
          custom_occurrence
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
    const notificationsToSend = filterNotificationsToSend(
      notifications as NotificationQueueItem[],
      now
    );

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
        const sendResult = await sendPushToSubscriptions(
          supabaseClient,
          notification
        );

        if (sendResult.status === 'no-subscriptions') {
          await supabaseClient
            .from('notification_queue')
            .update({
              error: 'No active subscriptions',
              sent_at: nowISO
            })
            .eq('id', notification.id);

          continue;
        }

        // Mark notification as sent
        await supabaseClient
          .from('notification_queue')
          .update({ sent_at: nowISO })
          .eq('id', notification.id);

        // Generate next occurrence for recurring medicines (only for confirmation type)
        if (notification.notification_type === 'confirmation') {
          try {
            const medicine = notification.user_medicines;
            const currentScheduledTime = new Date(notification.scheduled_datetime);
            const nextScheduledTime = getNextScheduledTime(
              currentScheduledTime,
              medicine.occurrence,
              now
            );

            if (nextScheduledTime) {
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
            }
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
            error: (error as Error).message,
            sent_at: nowISO
          })
          .eq('id', notification.id);

        results.push({
          notificationId: notification.id,
          error: (error as Error).message
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
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
