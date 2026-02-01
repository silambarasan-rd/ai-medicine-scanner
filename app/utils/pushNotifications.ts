// Push notification utility functions

// VAPID public key - Generate this using web-push CLI
// Run: npx web-push generate-vapid-keys
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support service workers');
  }

  return await Notification.requestPermission();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }

  // Register the main service worker
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/'
  });

  // Wait for the service worker to be ready
  await navigator.serviceWorker.ready;

  return registration;
}

export async function subscribeToPushNotifications(): Promise<PushSubscription> {
  try {
    // First check if VAPID key is set
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key not configured. Check NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local');
    }

    // Request permission if not already granted
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission was denied');
    }

    console.log('Registering service worker...');
    const registration = await registerServiceWorker();
    console.log('Service worker registered:', registration);

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    console.log('Existing subscription:', subscription);

    if (!subscription) {
      console.log('Subscribing to push with VAPID key...');
      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('New subscription created:', subscription);
    }

    // Send subscription to backend
    console.log('Saving subscription to backend...');
    await saveSubscription(subscription);
    console.log('Subscription saved successfully');

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      return;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return;
    }

    // Remove subscription from backend
    await removeSubscription(subscription);

    // Unsubscribe from push
    await subscription.unsubscribe();
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    throw error;
  }
}

export async function checkNotificationStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = 'Notification' in window && 'serviceWorker' in navigator;
  
  if (!supported) {
    return { supported: false, permission: 'default', subscribed: false };
  }

  const permission = Notification.permission;
  
  let subscribed = false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      subscribed = !!subscription;
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
  }

  return { supported, permission, subscribed };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray as Uint8Array<ArrayBuffer>;
}

// API calls
async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });

  if (!response.ok) {
    throw new Error('Failed to save subscription');
  }
}

async function removeSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  if (!response.ok) {
    throw new Error('Failed to remove subscription');
  }
}

// Setup service worker message listener for dashboard
export function setupServiceWorkerListener(
  onConfirmationRequest: (medicineId: string, scheduledDatetime: string) => void
) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SHOW_CONFIRMATION_MODAL') {
      onConfirmationRequest(
        event.data.medicineId,
        event.data.scheduledDatetime
      );
    }
  });
}
