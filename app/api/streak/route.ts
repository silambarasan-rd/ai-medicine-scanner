import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';

// Helper to convert UTC date to IST date key (YYYY-MM-DD in IST)
const getISTDateKey = (utcDate: Date): string => {
  const istDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to create UTC Date from IST date key
const createUTCFromISTDateKey = (istDateKey: string): Date => {
  const [year, month, day] = istDateKey.split('-').map(Number);
  // Create date in IST then convert to UTC
  const istDate = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  return istDate;
};

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all user medicines with their schedules
    const { data: medicines, error: medicinesError } = await supabase
      .from('user_medicines')
      .select('id, scheduled_date, occurrence')
      .eq('user_id', user.id);

    if (medicinesError) {
      console.error('Error fetching medicines:', medicinesError);
      return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 });
    }

    // Get all confirmations
    const { data: confirmations, error: confirmationsError } = await supabase
      .from('medicine_confirmations')
      .select('medicine_id, scheduled_datetime, taken')
      .eq('user_id', user.id)
      .order('scheduled_datetime', { ascending: true });

    if (confirmationsError) {
      console.error('Error fetching confirmations:', confirmationsError);
      return NextResponse.json({ error: 'Failed to fetch confirmations' }, { status: 500 });
    }

    // Helper function to get all medicine IDs scheduled for a given IST date
    const getMedicinesForISTDate = (istDateKey: string): string[] => {
      const medicineIds: string[] = [];

      medicines?.forEach(medicine => {
        if (!medicine.scheduled_date) return;

        // Parse scheduled_date as UTC date key
        const scheduleDateStr = medicine.scheduled_date.split('T')[0];
        const scheduleDate = new Date(scheduleDateStr + 'T00:00:00Z');
        const scheduleISTKey = getISTDateKey(scheduleDate);

        // Check if medicine is scheduled for this IST date
        if (medicine.occurrence === 'once') {
          if (scheduleISTKey === istDateKey) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'daily') {
          // For daily medicines, check if the schedule date is on or before the target date
          if (scheduleISTKey <= istDateKey) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'weekly') {
          const targetDate = createUTCFromISTDateKey(istDateKey);
          const daysDiff = Math.floor((targetDate.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff % 7 === 0) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'monthly') {
          const scheduleDay = parseInt(scheduleISTKey.split('-')[2]);
          const targetDay = parseInt(istDateKey.split('-')[2]);
          if (scheduleDay === targetDay && scheduleISTKey <= istDateKey) {
            medicineIds.push(medicine.id);
          }
        }
      });

      return medicineIds;
    };

    // Helper function to check if all medicines for an IST date were taken
    // Returns: 'complete' | 'incomplete' | 'no-medicines'
    const getDateStatus = (istDateKey: string): 'complete' | 'incomplete' | 'no-medicines' => {
      const scheduledMedicines = getMedicinesForISTDate(istDateKey);

      if (scheduledMedicines.length === 0) return 'no-medicines';

      const takenMedicines = confirmations?.filter(conf => {
        // Convert UTC scheduled_datetime to IST date key
        const confISTDateKey = getISTDateKey(new Date(conf.scheduled_datetime));
        return confISTDateKey === istDateKey && conf.taken === true && scheduledMedicines.includes(conf.medicine_id);
      });

      return takenMedicines?.length === scheduledMedicines.length ? 'complete' : 'incomplete';
    };

    // Calculate current streak using IST dates
    let currentStreak = 0;
    const nowUTC = new Date();
    const todayISTKey = getISTDateKey(nowUTC);

    // Helper to get previous day key
    const getPreviousDayKey = (istDateKey: string): string => {
      const [year, month, day] = istDateKey.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCDate(date.getUTCDate() - 1);
      const prevYear = date.getUTCFullYear();
      const prevMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
      const prevDay = String(date.getUTCDate()).padStart(2, '0');
      return `${prevYear}-${prevMonth}-${prevDay}`;
    };

    // Check if today is complete first - if so, include it in streak
    const todayStatus = getDateStatus(todayISTKey);
    let checkISTKey = todayISTKey;
    
    if (todayStatus === 'complete') {
      currentStreak = 1;
      checkISTKey = getPreviousDayKey(todayISTKey);
    } else if (todayStatus === 'no-medicines') {
      checkISTKey = getPreviousDayKey(todayISTKey);
    } else {
      checkISTKey = getPreviousDayKey(todayISTKey);
    };

    // Count backwards from the check date using IST date strings
    const [todayYear] = todayISTKey.split('-').map(Number);
    const oneYearAgoKey = `${todayYear - 1}-${todayISTKey.slice(5)}`;

    let currentCheckKey = checkISTKey;
    let iterationCount = 0;
    const maxIterations = 365;

    while (iterationCount < maxIterations && currentCheckKey >= oneYearAgoKey) {
      const status = getDateStatus(currentCheckKey);
      
      if (status === 'complete') {
        currentStreak++;
      } else if (status === 'no-medicines') {
        // Skip days with no medicines - don't break the streak
      } else {
        // Streak breaks if medicines were scheduled but not all taken
        break;
      }
      
      // Move to previous day
      currentCheckKey = getPreviousDayKey(currentCheckKey);
      iterationCount++;
    }

    // Calculate best streak - check all days including today
    let bestStreak = currentStreak;
    let tempStreak = 0;
    
    // Start from today and go backwards 365 days using IST date strings
    let bestCheckKey = todayISTKey;
    
    for (let i = 0; i < 365; i++) {
      const status = getDateStatus(bestCheckKey);
      
      if (status === 'complete') {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else if (status === 'no-medicines') {
        // Skip days with no medicines - don't reset the streak
      } else {
        // Reset streak counter when day is incomplete (had medicines but not all taken)
        tempStreak = 0;
      }
      
      // Move to previous day
      bestCheckKey = getPreviousDayKey(bestCheckKey);
    }

    // Calculate milestones
    const milestoneDays = [
      { days: 7, label: 'Beginner', tier: 'bronze' },
      { days: 15, label: 'Consistent', tier: 'silver' },
      { days: 30, label: 'Dedicated', tier: 'gold' },
      { days: 90, label: 'Champion', tier: 'platinum' },
      { days: 180, label: 'Master', tier: 'diamond' },
      { days: 365, label: 'Legendary', tier: 'crown' }
    ];

    const milestones = milestoneDays.map(milestone => ({
      ...milestone,
      achieved: currentStreak >= milestone.days,
      progress: Math.min(100, Math.round((currentStreak / milestone.days) * 100))
    }));

    // Calculate completion rate
    let totalScheduled = 0;
    let totalTaken = 0;

    confirmations?.forEach(conf => {
      totalScheduled++;
      if (conf.taken) totalTaken++;
    });

    const completionRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;

    return NextResponse.json({
      currentStreak,
      bestStreak,
      milestones,
      completionRate
    });

  } catch (error) {
    console.error('Error in streak calculation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
