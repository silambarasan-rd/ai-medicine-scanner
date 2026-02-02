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
  const notificationType = data.data.notificationType;
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

  // Build URL based on notification type
  let url = data.url || '/dashboard';
  
  // For confirmation notifications, add query params
  if (notificationType === 'confirmation' && medicineId && scheduledDatetime) {
    url = `/dashboard?confirm=${medicineId}&time=${encodeURIComponent(scheduledDatetime)}`;
  }
  // For reminder notifications, go to medicine details page
  else if (notificationType === 'reminder' && medicineId) {
    url = `/medicine-details/${medicineId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      console.log(`Found ${clientList.length} open windows`);
      console.log('Notification type:', notificationType);
      console.log('Medicine ID:', medicineId);
      console.log('Scheduled datetime:', scheduledDatetime);
      
      // For confirmation notifications, try to focus existing dashboard window
      if (notificationType === 'confirmation') {
        console.log('This is a confirmation notification, looking for dashboard...');
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          // Check for both '/' and '/dashboard' since they route to the same page
          const clientUrl = new URL(client.url);
          const isDashboard = clientUrl.pathname === '/' || clientUrl.pathname === '/dashboard';
          
          console.log(`Window ${i}: ${clientUrl.pathname} - isDashboard: ${isDashboard}`, client);
          
          if (isDashboard && 'focus' in client) {
            console.log('Found dashboard window, focusing and sending postMessage...');
            return client.focus().then(client => {
              // Send message to the client to show confirmation modal
              console.log('Sending SHOW_CONFIRMATION_MODAL message to client');
              client.postMessage({
                type: 'SHOW_CONFIRMATION_MODAL',
                medicineId: medicineId,
                medicineName: data.medicineName,
                dosage: data.dosage,
                mealTiming: data.mealTiming,
                scheduledDatetime: scheduledDatetime
              });
              return client;
            });
          }
        }
        console.log('No dashboard window found, opening new one');
      }
      
      // For reminder notifications, try to focus existing window or open medicine details
      if (notificationType === 'reminder') {
        console.log('This is a reminder notification, looking for any open window...');
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            console.log('Found open window, focusing it');
            return client.focus().then(client => {
              console.log('Sending SHOW_MEDICINE_DETAILS message to client');
              client.postMessage({
                type: 'SHOW_MEDICINE_DETAILS',
                medicineId: medicineId,
                medicineName: data.medicineName,
                dosage: data.dosage,
                mealTiming: data.mealTiming,
                scheduledDatetime: scheduledDatetime,
                url: url
              });
              return client;
            });
          }
        }
        console.log('No open window found, opening new one');
      }
      
      // No existing window or couldn't focus, open a new one
      if (clients.openWindow) {
        console.log('Opening new window with URL:', url);
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
