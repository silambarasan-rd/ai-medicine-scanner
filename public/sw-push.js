// ============================================================================
// PUSH NOTIFICATION HANDLERS FOR MEDICINE REMINDERS
// ============================================================================

// Handle push notification events
self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'Medicine Reminder',
    body: 'Time to take your medicine',
    icon: '/medicine-logo.png',
    badge: '/medicine-logo.png',
    tag: 'medicine-reminder',
    requireInteraction: true,
    data: {},
    actions: []
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        tag: data.medicineId || notificationData.tag,
        data: data
      };

      // Add action buttons for confirmation notifications
      if (data.notificationType === 'confirmation') {
        notificationData.actions = [
          { action: 'taken', title: 'Taken ✓', icon: '/medicine-logo.png' },
          { action: 'skip', title: 'Skip', icon: '/medicine-logo.png' }
        ];
      }
    } catch (e) {
      console.error('Error parsing push data:', e);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification click events (including action buttons)
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data || {};
  const medicineId = data.medicineId;
  const scheduledDatetime = data.scheduledDatetime;
  const notificationType = data.notificationType;
  const action = event.action; // 'taken', 'skip', or empty (clicked notification body)

  // Handle action button clicks
  if (action === 'taken' || action === 'skip') {
    event.waitUntil(
      fetch('/api/confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId,
          scheduledDatetime,
          taken: action === 'taken',
          skipped: action === 'skip'
        })
      }).then(() => {
        console.log(`Medicine ${action} recorded`);
      }).catch(err => {
        console.error('Error recording confirmation:', err);
      })
    );
    return;
  }

  // Build URL with query parameters for dashboard
  let url = '/dashboard';
  if (medicineId && scheduledDatetime && notificationType === 'confirmation') {
    url += `?confirm=${medicineId}&time=${encodeURIComponent(scheduledDatetime)}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus().then(client => {
            // Send message to the client to show confirmation modal
            if (medicineId && scheduledDatetime && notificationType === 'confirmation') {
              client.postMessage({
                type: 'SHOW_CONFIRMATION_MODAL',
                medicineId: medicineId,
                scheduledDatetime: scheduledDatetime
              });
            }
            return client;
          });
        }
      }
      
      // No existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event);
  
  // Optional: Track that user dismissed the notification
  const data = event.notification.data || {};
  if (data.medicineId && data.scheduledDatetime) {
    // Could track dismissals if needed
  }
});
