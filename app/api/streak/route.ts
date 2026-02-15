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

        const scheduleDate = new Date(medicine.scheduled_date);
        const scheduleDateStr = scheduleDate.toISOString().split('T')[0];

        // Check if medicine is scheduled for this date
        if (medicine.occurrence === 'once') {
          if (scheduleDateStr === dateStr) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'daily') {
          if (scheduleDate <= date) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'weekly') {
          const daysDiff = Math.floor((date.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff % 7 === 0) {
            medicineIds.push(medicine.id);
          }
        } else if (medicine.occurrence === 'monthly') {
          if (scheduleDate.getDate() === date.getDate() && scheduleDate <= date) {
            medicineIds.push(medicine.id);
          }
        }
      });

      return medicineIds;
    };

    // Helper function to check if all medicines for a date were taken
    const isDateComplete = (date: Date): boolean => {
      const dateStr = date.toISOString().split('T')[0];
      const scheduledMedicines = getMedicinesForDate(date);

      if (scheduledMedicines.length === 0) return false;

      const takenMedicines = confirmations?.filter(conf => {
        const confDate = new Date(conf.scheduled_datetime).toISOString().split('T')[0];
        return confDate === dateStr && conf.taken === true && scheduledMedicines.includes(conf.medicine_id);
      });

      return takenMedicines?.length === scheduledMedicines.length;
    };

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from yesterday and count backwards
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1);

    while (checkDate >= new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)) {
      if (isDateComplete(checkDate)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Streak breaks if medicines were not taken or no medicines scheduled
        break;
      }
    }

    // Calculate best streak
    let bestStreak = currentStreak;
    let tempStreak = 0;
    checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1);

    // Check last 365 days for best streak
    for (let i = 0; i < 365; i++) {
      if (isDateComplete(checkDate)) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        // Reset streak counter when day is incomplete or no medicines scheduled
        tempStreak = 0;
      }
      checkDate.setDate(checkDate.getDate() - 1);
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
