import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { medicineId, scheduledDatetime, taken, skipped, notes } = body;

    if (!medicineId || !scheduledDatetime) {
      return NextResponse.json({ error: 'Medicine ID and scheduled datetime required' }, { status: 400 });
    }

    // Upsert confirmation record
    const { data, error } = await supabase
      .from('medicine_confirmations')
      .upsert({
        user_id: user.id,
        medicine_id: medicineId,
        scheduled_datetime: scheduledDatetime,
        confirmed_at: new Date().toISOString(),
        taken: taken || false,
        skipped: skipped || false,
        notes: notes || null
      }, {
        onConflict: 'user_id,medicine_id,scheduled_datetime'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving confirmation:', error);
      return NextResponse.json({ error: 'Failed to save confirmation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, confirmation: data });
  } catch (error) {
    console.error('Error in confirmations endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('medicine_confirmations')
      .select(`
        *,
        user_medicines (
          name,
          dosage,
          timing,
          meal_timing
        )
      `)
      .eq('user_id', user.id);

    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    }

    if (startDate) {
      query = query.gte('scheduled_datetime', startDate);
    }

    if (endDate) {
      query = query.lte('scheduled_datetime', endDate);
    }

    query = query.order('scheduled_datetime', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching confirmations:', error);
      return NextResponse.json({ error: 'Failed to fetch confirmations' }, { status: 500 });
    }

    return NextResponse.json({ confirmations: data });
  } catch (error) {
    console.error('Error in get confirmations endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
