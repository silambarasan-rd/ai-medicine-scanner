import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

// GET /api/medicines/[id] - Get a specific medicine
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    let medicines: any[] | null = null;

    // Try fetching by group id first
    const { data: groupMedicines, error: groupError } = await supabase
      .from('user_medicines')
      .select('*')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .order('timing', { ascending: true });

    if (groupError) {
      if (groupError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Medicine not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching medicine by group_id:', groupError);
      return NextResponse.json(
        { error: 'Failed to fetch medicine' },
        { status: 500 }
      );
    }

    medicines = groupMedicines;

    if (!medicines || medicines.length === 0) {
      // Fallback: fetch by row id (used by notifications)
      const { data: idMedicines, error: idError } = await supabase
        .from('user_medicines')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .order('timing', { ascending: true });

      if (idError) {
        if (idError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Medicine not found' },
            { status: 404 }
          );
        }
        console.error('Error fetching medicine by id:', idError);
        return NextResponse.json(
          { error: 'Failed to fetch medicine' },
          { status: 500 }
        );
      }

      medicines = idMedicines;
    }

    if (!medicines || medicines.length === 0) {
      return NextResponse.json(
        { error: 'Medicine not found' },
        { status: 404 }
      );
    }

    const base = medicines[0];
    
    // Return a simplified view for single medicine display
    return NextResponse.json({
      id: base.id,
      name: base.name,
      dosage: base.dosage,
      timing: base.timing,
      meal_timing: base.meal_timing,
      occurrence: base.occurrence,
      custom_occurrence: base.custom_occurrence,
      scheduled_date: base.scheduled_date,
      notes: base.notes,
      created_at: base.created_at,
      // Also include the grouped format for backward compatibility
      group: {
        id: base.group_id,
        name: base.name,
        dosage: base.dosage,
        occurrence: base.occurrence,
        custom_occurrence: base.custom_occurrence,
        scheduled_date: base.scheduled_date,
        notes: base.notes,
        schedules: medicines.map((medicine) => ({
          timing: medicine.timing,
          meal_timing: medicine.meal_timing,
        })),
      }
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/medicines/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/medicines/[id] - Update a medicine
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Parse request body
    const body = await request.json();
    const { name, dosage, occurrence, custom_occurrence, scheduled_date, timing, meal_timing, notes, schedules, timezone } = body;

    // Get user timezone (default to UTC if not provided)
    const userTimezone = timezone || 'UTC';

    // Validate required fields
    if (!name || !occurrence || !scheduled_date) {
      return NextResponse.json(
        { error: 'Missing required fields: name, occurrence, scheduled_date' },
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
      const invalidSchedule = schedules.find((schedule: { timing?: string; meal_timing?: string }) =>
        !schedule?.timing || !schedule?.meal_timing
      );
      if (invalidSchedule) {
        return NextResponse.json(
          { error: 'Each schedule requires timing and meal_timing' },
          { status: 400 }
        );
      }
    }

    const { error: deleteError } = await supabase
      .from('user_medicines')
      .delete()
      .eq('group_id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error clearing medicine group:', deleteError);
      return NextResponse.json(
        { error: 'Failed to update medicine' },
        { status: 500 }
      );
    }

    const insertPayload = hasSchedules
      ? schedules.map((schedule: { timing: string; meal_timing: string }) => ({
          user_id: user.id,
          group_id: id,
          name,
          dosage,
          occurrence,
          custom_occurrence,
          scheduled_date,
          timing: schedule.timing,
          meal_timing: schedule.meal_timing,
          notes,
          timezone: userTimezone, // Store timezone
        }))
      : [
          {
            user_id: user.id,
            group_id: id,
            name,
            dosage,
            occurrence,
            custom_occurrence,
            scheduled_date,
            timing,
            meal_timing,
            notes,
            timezone: userTimezone, // Store timezone
          },
        ];

    const { data: medicines, error } = await supabase
      .from('user_medicines')
      .insert(insertPayload)
      .select();

    if (error) {
      console.error('Error updating medicine:', error);
      return NextResponse.json(
        { error: 'Failed to update medicine' },
        { status: 500 }
      );
    }

    return NextResponse.json(medicines);
  } catch (error) {
    console.error('Unexpected error in PUT /api/medicines/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/medicines/[id] - Delete a medicine
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Delete medicine group
    const { error } = await supabase
      .from('user_medicines')
      .delete()
      .eq('group_id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting medicine:', error);
      return NextResponse.json(
        { error: 'Failed to delete medicine' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/medicines/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
