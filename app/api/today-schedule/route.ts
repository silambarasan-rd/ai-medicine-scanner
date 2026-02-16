import { createClient } from '@/app/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type ScheduleStatus = 'pending' | 'taken' | 'skipped';

type TimingGroup = 'morning' | 'afternoon' | 'evening' | 'night';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: medicines, error: medicinesError } = await supabase
      .from('user_medicines')
      .select(
        'id, name, dosage, occurrence, scheduled_date, timing, meal_timing, dose_amount, dose_unit, pharmacy_medicine_id, pharmacy_medicines ( name, dosage, stock_unit, image_url )'
      )
      .eq('user_id', user.id);

    if (medicinesError) {
      console.error('Error fetching medicines:', medicinesError);
      return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 });
    }

    const { data: confirmations, error: confirmationsError } = await supabase
      .from('medicine_confirmations')
      .select('id, medicine_id, scheduled_datetime, taken, skipped')
      .eq('user_id', user.id)
      .gte('scheduled_datetime', today.toISOString())
      .lt('scheduled_datetime', tomorrow.toISOString());

    if (confirmationsError) {
      console.error('Error fetching confirmations:', confirmationsError);
      return NextResponse.json({ error: 'Failed to fetch confirmations' }, { status: 500 });
    }

    const confirmationMap = new Map<string, typeof confirmations[0]>();
    confirmations?.forEach((confirmation) => {
      const scheduledTime = new Date(confirmation.scheduled_datetime).getTime();
      confirmationMap.set(`${confirmation.medicine_id}-${scheduledTime}`, confirmation);
    });

    const isScheduledForDate = (occurrence: string | null, scheduledDate: string | null, date: Date) => {
      if (!occurrence || !scheduledDate) return false;

      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      const startDate = new Date(scheduledDate);
      startDate.setHours(0, 0, 0, 0);

      if (occurrence === 'once') {
        return startDate.getTime() === dateOnly.getTime();
      }

      if (occurrence === 'daily') {
        return startDate <= dateOnly;
      }

      if (occurrence === 'weekly') {
        const daysDiff = Math.floor((dateOnly.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff % 7 === 0;
      }

      if (occurrence === 'monthly') {
        return startDate.getDate() === dateOnly.getDate() && startDate <= dateOnly;
      }

      return false;
    };

    const parseTiming = (timing: string | null) => {
      const [hourPart, minutePart] = (timing || '09:00').split(':');
      const hours = Number.parseInt(hourPart || '9', 10);
      const minutes = Number.parseInt(minutePart || '0', 10);
      return { hours, minutes };
    };

    const getTimingGroup = (hours: number): TimingGroup => {
      if (hours < 12) return 'morning';
      if (hours < 17) return 'afternoon';
      if (hours < 21) return 'evening';
      return 'night';
    };

    const formatTiming = (hours: number, minutes: number) => {
      const safeHours = Number.isFinite(hours) ? hours : 9;
      const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
      return `${safeHours.toString().padStart(2, '0')}:${safeMinutes.toString().padStart(2, '0')}`;
    };

    const scheduledMedicines = (medicines || [])
      .filter((medicine) => isScheduledForDate(medicine.occurrence, medicine.scheduled_date, today))
      .map((medicine) => {
        const { hours, minutes } = parseTiming(medicine.timing);
        const scheduledDatetime = new Date(today);
        scheduledDatetime.setHours(hours, minutes, 0, 0);

        const confirmation = confirmationMap.get(`${medicine.id}-${scheduledDatetime.getTime()}`);
        const status: ScheduleStatus = confirmation?.taken
          ? 'taken'
          : confirmation?.skipped
            ? 'skipped'
            : 'pending';

        const timingGroup = getTimingGroup(hours);
        const scheduledTime = medicine.timing || formatTiming(hours, minutes);
        const pharmacyMedicine = Array.isArray(medicine.pharmacy_medicines) ? medicine.pharmacy_medicines[0] : null;
        const name = medicine.name || pharmacyMedicine?.name || 'Medicine';
        const dosage = medicine.dosage || pharmacyMedicine?.dosage || null;

        return {
          id: medicine.id,
          name,
          dosage,
          timing: timingGroup,
          scheduled_time: scheduledTime,
          meal_timing: medicine.meal_timing,
          status,
          confirmation_id: confirmation?.id || null,
          scheduled_datetime: scheduledDatetime.toISOString(),
          dose_amount: medicine.dose_amount ?? null,
          dose_unit: medicine.dose_unit ?? null,
          pharmacy_medicine_id: medicine.pharmacy_medicine_id ?? null,
          pharmacy_medicine: pharmacyMedicine ?? null,
        };
      });

    const timingOrder: Record<TimingGroup, number> = {
      morning: 0,
      afternoon: 1,
      evening: 2,
      night: 3,
    };

    const statusOrder: Record<ScheduleStatus, number> = {
      pending: 0,
      taken: 1,
      skipped: 2,
    };

    scheduledMedicines.sort((a, b) => {
      const timingDiff = timingOrder[a.timing] - timingOrder[b.timing];
      if (timingDiff !== 0) return timingDiff;

      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      return a.scheduled_time.localeCompare(b.scheduled_time);
    });

    const total = scheduledMedicines.length;
    const taken = scheduledMedicines.filter((medicine) => medicine.status === 'taken').length;
    const pending = scheduledMedicines.filter((medicine) => medicine.status === 'pending').length;

    return NextResponse.json({
      total,
      taken,
      pending,
      medicines: scheduledMedicines,
    });
  } catch (error) {
    console.error('Error in today schedule endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
