# Push Notification System Architecture

## Overview

Fully functional push notification system using **Supabase + Web Push + cron-job.org** (no third-party services like Firebase needed).

## Technology Stack

- **Web Push API** - Browser native push (uses `npm:web-push@3.6.7` in edge function)
- **PostgreSQL** - Queue management with auto-generating triggers
- **Supabase Edge Functions** - Deno runtime with npm package support
- **cron-job.org** - Reliable cron scheduler (every minute, better than GitHub Actions)
- **Service Worker** - Client-side push handler (`sw-push.js` for dev, `sw.js` for prod)

## High-Level Flow

```
User adds medicine (timezone auto-detected)
    ↓
DB trigger auto-creates first notification_queue entry
    ↓
cron-job.org triggers edge function (every minute)
    ↓
Edge function filters ready notifications (UTC comparison)
    ↓
Edge function uses web-push library to send
    ↓
Service worker receives & displays notification
    ↓
User clicks → Confirmation modal → Saved to DB
    ↓
Edge function generates next occurrence (recurring only)
    ↓
Calendar shows ✓/✗ status
```

## Timing Logic

```
After-Meal Medicine (e.g., scheduled for 2:00 PM)
═══════════════════════════════════════════════════

Timeline:
─────────────────────────────────────────────────────────────▶
         1:30 PM               2:00 PM
           │                     │
           ▼                     ▼
      ┌─────────┐          ┌─────────┐
      │Reminder │          │Confirm  │
      │(30 min) │          │(exact)  │
      └─────────┘          └─────────┘


Before-Meal Medicine (e.g., scheduled for 8:00 AM)
═══════════════════════════════════════════════════

Timeline:
─────────────────────────────────────────────────────────────▶
         7:45 AM               8:00 AM
           │                     │
           ▼                     ▼
      ┌─────────┐          ┌─────────┐
      │Reminder │          │Confirm  │
      │(15 min) │          │(exact)  │
      └─────────┘          └─────────┘
```

## Database Schema Relationships

```
┌──────────────────┐
│   auth.users     │
│ ────────────     │
│ id (PK)          │
└────────┬─────────┘
         │
         │ (1:N)
         │
    ┌────┴────────────────────────────────────┐
    │                                         │
    ▼                                         ▼
┌─────────────────────┐           ┌────────────────────┐
│ user_medicines      │           │ push_subscriptions │
│ ─────────────       │           │ ──────────────     │
│ id (PK)             │           │ id (PK)            │
│ user_id (FK)        │           │ user_id (FK)       │
│ name                │           │ endpoint           │
│ dosage              │           │ p256dh             │
│ timing              │           │ auth               │
│ meal_timing         │           └────────────────────┘
│ occurrence          │
└────────┬────────────┘
         │
         │ (1:N)
         │
    ┌────┴────────────────────────────────┐
    │                                     │
    ▼                                     ▼
┌────────────────────┐     ┌─────────────────────────┐
│ notification_queue │     │ medicine_confirmations  │
│ ──────────────     │     │ ─────────────────       │
│ id (PK)            │     │ id (PK)                 │
│ medicine_id (FK)   │     │ medicine_id (FK)        │
│ user_id (FK)       │     │ user_id (FK)            │
│ scheduled_datetime │     │ scheduled_datetime      │
│ notification_type  │     │ confirmed_at            │
│ minutes_before     │     │ taken                   │
│ sent_at            │     │ skipped                 │
└────────────────────┘     │ notes                   │
                           └─────────────────────────┘
```

## Component Architecture

```
┌───────────────────────────────────────────────────┐
│                 Frontend (Next.js)                │
└───────────────────────────────────────────────────┘

    Dashboard Page (dashboard/page.tsx)
         │
         ├─ Uses: pushNotifications.ts utility
         │   ├─ subscribeToPushNotifications()
         │   ├─ unsubscribeFromPushNotifications()
         │   ├─ checkNotificationStatus()
         │   └─ setupServiceWorkerListener()
         │
         ├─ Shows: ConfirmationModal component
         │   ├─ Props: medicineId, scheduledDatetime
         │   └─ Calls: /api/confirmations (POST)
         │
         └─ Calendar: Shows events with status
             ├─ Green ✓ = Taken
             ├─ Gray ✗ = Skipped
             └─ Colored = Pending


┌───────────────────────────────────────────────────┐
│                 Service Worker                     │
└───────────────────────────────────────────────────┘

    sw-push.js
         │
         ├─ push event
         │   └─ showNotification()
         │
         ├─ notificationclick event
         │   ├─ Action: 'taken' → POST /api/confirmations
         │   ├─ Action: 'skip' → POST /api/confirmations
         │   └─ Body click → Open dashboard + modal
         │
         └─ notificationclose event
             └─ Track dismissals


┌───────────────────────────────────────────────────┐
│                 API Routes                         │
└───────────────────────────────────────────────────┘

    /api/push/subscribe
         ├─ POST: Save subscription
         ├─ DELETE: Remove subscription
         └─ GET: List subscriptions

    /api/confirmations
         ├─ POST: Save confirmation
         └─ GET: List confirmations


## Edge Function Implementation

**File:** `supabase/functions/send-medicine-notifications/index.ts`

**Key features:**
- ✅ Uses `npm:web-push@3.6.7` library (Deno supports npm packages)
- ✅ Queries `notification_queue` WHERE `sent_at IS NULL`
- ✅ Fetches user subscriptions from `push_subscriptions`
- ✅ Sends real push notifications (not mocked)
- ✅ Marks as sent or logs errors
- ✅ Auto-removes invalid subscriptions (HTTP 410 Gone)

**Environment variables required:**
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
```

## User Interaction Flows

### Flow 1: Enable Notifications
```
User clicks "Enable Notifications"
   ↓
Request notification permission
   ↓
Register service worker
   ↓
Subscribe to push notifications
   ↓
Save subscription to database
   ↓
Button shows "Notifications On"
```

### Flow 2: Receive & Confirm
```
Notification arrives
   ↓
User clicks notification
   ↓
Dashboard opens
   ↓
Confirmation modal appears
   ↓
User selects "Taken" or "Skipped"
   ↓
Saved to medicine_confirmations
   ↓
Calendar updates with status
```

### Flow 3: Quick Action
```
Notification arrives with buttons
   ↓
User clicks "Taken ✓" button
   ↓
Service worker POSTs to API
   ↓
Confirmation saved immediately
   ↓
Notification dismissed
   ↓
Calendar updates next time viewed
```

## Security Model

```
┌─────────────────────────────────────────────┐
│           Security Layers                    │
└─────────────────────────────────────────────┘

1. Authentication (Supabase Auth)
   └─ User must be logged in for all operations

2. Row Level Security (RLS)
   └─ Users can only access their own:
       ├─ push_subscriptions
       ├─ medicine_confirmations
       └─ notification_queue

3. VAPID Authentication
   └─ Server identity verified by push service

4. HTTPS Only
   └─ Service workers require secure origin

5. API Authorization
   └─ Edge function uses service role key
       (stored as secret)
```
