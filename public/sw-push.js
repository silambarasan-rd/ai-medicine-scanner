// ============================================================================
// PUSH NOTIFICATION HANDLERS FOR MEDICINE REMINDERS
// ============================================================================

// Handle push notification events
self.addEventListener('push', function(event) {
  console.log('Push notification received:', event, event.data);
  
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
      const payload = event.data.json();
      const payloadData = (payload.data && payload.data.data) || payload.data || payload;

      notificationData = {
        ...notificationData,
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        tag: payloadData.medicineId || notificationData.tag,
        data: payloadData
      };

      // Add action buttons for confirmation notifications
      if (payloadData.notificationType === 'confirmation') {
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

  const data = event.notification.data || {};
  const payloadData = (data.data && data.data.data) || data.data || data;
  const medicineId = payloadData.medicineId;
  const scheduledDatetime = payloadData.scheduledDatetime;
  const notificationType = payloadData.notificationType;
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
      }).finally(() => {
        event.notification.close();
      })
    );
    return;
  }

  // Build URL based on notification type
  let url = payloadData.url || '/dashboard';
  
  // For confirmation notifications, add query params
  if (notificationType === 'confirmation' && medicineId && scheduledDatetime) {
    url = `/dashboard?confirm=${medicineId}&time=${encodeURIComponent(scheduledDatetime)}`;
  }
  // For reminder notifications, go to medicine details page
  else if (notificationType === 'reminder' && medicineId) {
    url = `/medicine-details/${medicineId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      console.log(`Found ${clientList.length} open windows`);
      console.log('Notification type:', notificationType);
      console.log('Medicine ID:', medicineId);
      console.log('Scheduled datetime:', scheduledDatetime);
      
      // For confirmation notifications, try to focus existing dashboard window
      if (notificationType === 'confirmation') {
        console.log('This is a confirmation notification, looking for dashboard...');
        const dashboardClients = [];
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          // Check for both '/' and '/dashboard' since they route to the same page
          const clientUrl = new URL(client.url);
          const isDashboard = clientUrl.pathname === '/' || clientUrl.pathname === '/dashboard';
          
          console.log(`Window ${i}: ${clientUrl.pathname} - isDashboard: ${isDashboard}`, client);
          
          if (isDashboard) {
            dashboardClients.push(client);
          }
        }

        if (dashboardClients.length > 0) {
          console.log(`Found ${dashboardClients.length} dashboard window(s), sending postMessage...`);
          dashboardClients.forEach((client) => {
            client.postMessage({
              type: 'SHOW_CONFIRMATION_MODAL',
              medicineId: medicineId,
              medicineName: payloadData.medicineName,
              dosage: payloadData.dosage,
              mealTiming: payloadData.mealTiming,
              scheduledDatetime: scheduledDatetime
            });
          });

          const primaryClient = dashboardClients[0];
          if ('focus' in primaryClient) {
            console.log('Focusing dashboard window...');
            return primaryClient.focus().catch((err) => {
              console.warn('Error focusing dashboard window:', err);
            });
          }

          return;
        }

        console.log('No dashboard window found, opening new one');
      }
      
      // For reminder notifications, notify any open window and focus one if possible
      if (notificationType === 'reminder') {
        console.log('This is a reminder notification, looking for any open window...');

        if (clientList.length > 0) {
          console.log(`Found ${clientList.length} open window(s), sending postMessage...`);
          clientList.forEach((client) => {
            client.postMessage({
              type: 'SHOW_MEDICINE_DETAILS',
              medicineId: medicineId,
              medicineName: payloadData.medicineName,
              dosage: payloadData.dosage,
              mealTiming: payloadData.mealTiming,
              scheduledDatetime: scheduledDatetime,
              url: url
            });
          });

          const primaryClient = clientList[0];
          if ('focus' in primaryClient) {
            console.log('Focusing open window...');
            return primaryClient.focus().catch((err) => {
              console.warn('Error focusing open window:', err);
            });
          }

          return;
        }

        console.log('No open window found, opening new one');
      }
      
      // No existing window or couldn't focus, open a new one
      if (clients.openWindow) {
        console.log('Opening new window with URL:', url);
        return clients.openWindow(url);
      }
    }).finally(() => {
      event.notification.close();
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
