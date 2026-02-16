import { createClient } from '@/app/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    // Helper function to get all medicine IDs scheduled for a given date
    const getMedicinesForDate = (date: Date): string[] => {
      const dateStr = date.toISOString().split('T')[0];
      const medicineIds: string[] = [];

      medicines?.forEach(medicine => {
        if (!medicine.scheduled_date) return;

        // Parse scheduled_date as UTC to avoid timezone issues
        const scheduleDateStr = medicine.scheduled_date.split('T')[0];
        const scheduleDate = new Date(scheduleDateStr + 'T00:00:00Z');

        // Check if medicine is scheduled for this date
        if (medicine.occurrence === 'once') {
          if (scheduleDateStr === dateStr) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'daily') {
          // For daily medicines, check if the schedule date is on or before the target date
          if (scheduleDateStr <= dateStr) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'weekly') {
          const daysDiff = Math.floor((date.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff % 7 === 0) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'monthly') {
          const scheduleDay = parseInt(scheduleDateStr.split('-')[2]);
          const targetDay = parseInt(dateStr.split('-')[2]);
          if (scheduleDay === targetDay && scheduleDateStr <= dateStr) {
            medicineIds.push(medicine.id);
          }
        }
      });

      return medicineIds;
    };

    // Helper function to check if all medicines for a date were taken
    // Returns: 'complete' | 'incomplete' | 'no-medicines'
    const getDateStatus = (date: Date): 'complete' | 'incomplete' | 'no-medicines' => {
      const dateStr = date.toISOString().split('T')[0];
      const scheduledMedicines = getMedicinesForDate(date);

      if (scheduledMedicines.length === 0) return 'no-medicines';

      const takenMedicines = confirmations?.filter(conf => {
        const confDate = new Date(conf.scheduled_datetime).toISOString().split('T')[0];
        return confDate === dateStr && conf.taken === true && scheduledMedicines.includes(conf.medicine_id);
      });

      return takenMedicines?.length === scheduledMedicines.length ? 'complete' : 'incomplete';
    };

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayUTC = new Date(todayStr + 'T00:00:00Z');

    // Start from yesterday and count backwards
    let checkDate = new Date(todayUTC);
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);

    while (checkDate >= new Date(todayUTC.getTime() - 365 * 24 * 60 * 60 * 1000)) {
      const status = getDateStatus(checkDate);
      
      if (status === 'complete') {
        currentStreak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else if (status === 'no-medicines') {
        // Skip days with no medicines - don't break the streak
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        // Streak breaks if medicines were scheduled but not all taken
        break;
      }
    }

    // Calculate best streak
    let bestStreak = currentStreak;
    let tempStreak = 0;
    checkDate = new Date(todayUTC);
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);

    // Check last 365 days for best streak
    for (let i = 0; i < 365; i++) {
      const status = getDateStatus(checkDate);
      
      if (status === 'complete') {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else if (status === 'no-medicines') {
        // Skip days with no medicines - don't reset the streak
      } else {
        // Reset streak counter when day is incomplete (had medicines but not all taken)
        tempStreak = 0;
      }
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
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
