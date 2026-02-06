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

  // Use a lightweight SW in dev; production uses the precached SW build
  const isProduction = process.env.NODE_ENV === 'production';
  const swPath = isProduction ? '/sw.js' : '/sw-push.js';

  // Register the main service worker
  const registration = await navigator.serviceWorker.register(swPath, {
    scope: '/'
  });

  // Wait for the service worker to be ready (with timeout to avoid hanging)
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Service worker ready timeout')), 5000)
      )
    ]);
  } catch (error) {
    console.warn('Service worker not ready yet:', error);
  }

  if (!registration.active) {
    const installing = registration.installing || registration.waiting;
    if (installing) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Service worker activation timeout')), 5000);
        installing.addEventListener('statechange', () => {
          if (installing.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          }
        });
      }).catch((error) => {
        console.warn('Service worker activation warning:', error);
      });
    }
  }

  if (!registration.active) {
    throw new Error('Service worker is not active. Reload the page and try again.');
  }

  return registration;
}

export async function subscribeToPushNotifications(): Promise<PushSubscription> {
  try {
    // First check if VAPID key is set
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key not configured. Check NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local');
    }

    if (!('PushManager' in window)) {
      throw new Error('Push notifications are not supported in this browser');
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
  onConfirmationRequest: (medicineId: string, scheduledDatetime: string, medicineName?: string, dosage?: string, mealTiming?: string) => void
) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Inside the confirmation modal', event);

    if (event.data?.type === 'SHOW_CONFIRMATION_MODAL') {
      onConfirmationRequest(
        event.data.medicineId,
        event.data.scheduledDatetime,
        event.data.medicineName,
        event.data.dosage,
        event.data.mealTiming
      );
    } else if (event.data?.type === 'SHOW_MEDICINE_DETAILS') {
      // For reminder notifications, navigate to medicine details
      console.log('Received SHOW_MEDICINE_DETAILS message:', event.data);
      const medicineId = event.data.medicineId;
      if (medicineId) {
        window.location.href = `/medicine-details/${medicineId}`;
      }
    }
  });
}
