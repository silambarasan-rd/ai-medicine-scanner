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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    // Get first and last day of the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Get all user medicines
    const { data: medicines, error: medicinesError } = await supabase
      .from('user_medicines')
      .select('id, scheduled_date, occurrence')
      .eq('user_id', user.id);

    if (medicinesError) {
      console.error('Error fetching medicines:', medicinesError);
      return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 });
    }

    // Get confirmations for the month
    const { data: confirmations, error: confirmationsError } = await supabase
      .from('medicine_confirmations')
      .select('medicine_id, scheduled_datetime, taken')
      .eq('user_id', user.id)
      .gte('scheduled_datetime', firstDay.toISOString())
      .lte('scheduled_datetime', new Date(lastDay.getTime() + 86400000).toISOString());

    if (confirmationsError) {
      console.error('Error fetching confirmations:', confirmationsError);
      return NextResponse.json({ error: 'Failed to fetch confirmations' }, { status: 500 });
    }

    // Helper function to get medicine IDs scheduled for a date
    const getMedicinesForDate = (date: Date): string[] => {
      const dateStr = date.toISOString().split('T')[0];
      const medicineIds: string[] = [];

      medicines?.forEach(medicine => {
        if (!medicine.scheduled_date) return;

        const scheduleDate = new Date(medicine.scheduled_date);
        const scheduleDateStr = scheduleDate.toISOString().split('T')[0];

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

    // Build day data for each day in the month
    const days = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const currentDate = new Date(year, month - 1, day);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Get medicines scheduled for this day
      const scheduledMedicineIds = getMedicinesForDate(currentDate);
      const total = scheduledMedicineIds.length;

      if (total === 0) {
        // No medicines scheduled for this day
        continue;
      }

      // Count how many were taken and skipped
      const taken = confirmations?.filter(conf => {
        const confDate = new Date(conf.scheduled_datetime).toISOString().split('T')[0];
        return confDate === dateStr && 
               conf.taken === true && 
               scheduledMedicineIds.includes(conf.medicine_id);
      }).length || 0;

      const skipped = confirmations?.filter(conf => {
        const confDate = new Date(conf.scheduled_datetime).toISOString().split('T')[0];
        return confDate === dateStr && 
               conf.taken === false && 
               scheduledMedicineIds.includes(conf.medicine_id);
      }).length || 0;

      const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
      
      let status: 'complete' | 'partial' | 'none';
      if (percentage === 100) {
        status = 'complete';
      } else if (percentage > 0) {
        status = 'partial';
      } else {
        status = 'none';
      }

      days.push({
        date: dateStr,
        total,
        taken,
        skipped,
        percentage,
        status
      });
    }

    return NextResponse.json({ days });

  } catch (error) {
    console.error('Error in calendar data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
