import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import crypto from 'crypto';

// GET /api/medicines - List all medicines for authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch medicines for the user
    const { data: medicines, error } = await supabase
      .from('user_medicines')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching medicines:', error);
      return NextResponse.json(
        { error: 'Failed to fetch medicines' },
        { status: 500 }
      );
    }

    return NextResponse.json(medicines);
  } catch (error) {
    console.error('Unexpected error in GET /api/medicines:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/medicines - Create a new medicine
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      name,
      pharmacy_medicine_id,
      dosage,
      occurrence,
      custom_occurrence,
      scheduled_date,
      timing,
      meal_timing,
      notes,
      schedules,
      timezone,
      dose_unit,
    } = body;

    // Get user timezone (default to UTC if not provided)
    const userTimezone = timezone || 'UTC';

    // Validate required fields
    if (!name || !occurrence || !scheduled_date) {
      return NextResponse.json(
        { error: 'Missing required fields: name, occurrence, scheduled_date' },
        { status: 400 }
      );
    }

    if (!pharmacy_medicine_id || !dose_unit) {
      return NextResponse.json(
        { error: 'Missing required fields: pharmacy_medicine_id, dose_unit' },
        { status: 400 }
      );
    }

    const hasSchedules = Array.isArray(schedules) && schedules.length > 0;
    if (!hasSchedules && (!timing || !meal_timing)) {
      return NextResponse.json(
        { error: 'Missing required fields: timing, meal_timing or schedules' },
        { status: 400 }
      );
    }

    if (hasSchedules) {
      const invalidSchedule = schedules.find((schedule: { timing?: string; meal_timing?: string; dose_amount?: number }) =>
        !schedule?.timing || !schedule?.meal_timing || !schedule?.dose_amount
      );
      if (invalidSchedule) {
        return NextResponse.json(
          { error: 'Each schedule requires timing, meal_timing, and dose_amount' },
          { status: 400 }
        );
      }
    }

    // Insert medicine(s)
    const groupId = crypto.randomUUID();
    const insertPayload = hasSchedules
      ? schedules.map((schedule: { timing: string; meal_timing: string; dose_amount: number }) => ({
          user_id: user.id,
          group_id: groupId,
          name,
          pharmacy_medicine_id,
          dosage,
          occurrence,
          custom_occurrence,
          scheduled_date,
          timing: schedule.timing,
          meal_timing: schedule.meal_timing,
          dose_amount: schedule.dose_amount,
          dose_unit,
          notes,
          timezone: userTimezone, // Store timezone
        }))
      : [
          {
            user_id: user.id,
            group_id: groupId,
            name,
            pharmacy_medicine_id,
            dosage,
            occurrence,
            custom_occurrence,
            scheduled_date,
            timing,
            meal_timing,
            dose_amount: body.dose_amount,
            dose_unit,
            notes,
            timezone: userTimezone, // Store timezone
          },
        ];

    const { data: medicines, error } = await supabase
      .from('user_medicines')
      .insert(insertPayload)
      .select();

    if (error) {
      console.error('Error creating medicine:', error);
      return NextResponse.json(
        { error: 'Failed to create medicine' },
        { status: 500 }
      );
    }

    return NextResponse.json(medicines, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/medicines:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
