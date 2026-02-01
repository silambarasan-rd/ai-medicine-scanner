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

    // Fetch the medicine
    const { data: medicine, error } = await supabase
      .from('user_medicines')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Medicine not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching medicine:', error);
      return NextResponse.json(
        { error: 'Failed to fetch medicine' },
        { status: 500 }
      );
    }

    return NextResponse.json(medicine);
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
    const { name, dosage, occurrence, custom_occurrence, scheduled_date, timing, meal_timing, notes } = body;

    // Validate required fields
    if (!name || !occurrence || !scheduled_date || !timing || !meal_timing) {
      return NextResponse.json(
        { error: 'Missing required fields: name, occurrence, scheduled_date, timing, meal_timing' },
        { status: 400 }
      );
    }

    // Update medicine
    const { data: medicine, error } = await supabase
      .from('user_medicines')
      .update({
        name,
        dosage,
        occurrence,
        custom_occurrence,
        scheduled_date,
        timing,
        meal_timing,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Medicine not found' },
          { status: 404 }
        );
      }
      console.error('Error updating medicine:', error);
      return NextResponse.json(
        { error: 'Failed to update medicine' },
        { status: 500 }
      );
    }

    return NextResponse.json(medicine);
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

    // Delete medicine
    const { error } = await supabase
      .from('user_medicines')
      .delete()
      .eq('id', id)
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
