import type { NotificationQueueItem } from './types.ts';

export const filterNotificationsToSend = (
  notifications: NotificationQueueItem[],
  now: Date
) =>
  notifications.filter((notification) => {
    const scheduledTime = new Date(notification.scheduled_datetime);
    const sendTime = new Date(
      scheduledTime.getTime() - notification.minutes_before * 60 * 1000
    );
    const timeDiff = Math.abs(now.getTime() - sendTime.getTime());
    // Send if within 2 minutes of scheduled send time (allows for cron timing variations)
    return timeDiff <= 2 * 60 * 1000;
  });

export const getNextScheduledTime = (
  baseTime: Date,
  occurrence: string | null,
  nowTime: Date
): Date | null => {
  if (!occurrence || occurrence === 'once' || occurrence === 'custom') {
    return null;
  }

  const nextTime = new Date(baseTime);

  const advanceOnce = () => {
    if (occurrence === 'daily') {
      nextTime.setDate(nextTime.getDate() + 1);
    } else if (occurrence === 'weekly') {
      nextTime.setDate(nextTime.getDate() + 7);
    } else if (occurrence === 'monthly') {
      nextTime.setMonth(nextTime.getMonth() + 1);
    } else {
      return false;
    }

    return true;
  };

  if (!advanceOnce()) {
    return null;
  }

  while (nextTime <= nowTime) {
    if (!advanceOnce()) {
      return null;
    }
  }

  return nextTime;
};
