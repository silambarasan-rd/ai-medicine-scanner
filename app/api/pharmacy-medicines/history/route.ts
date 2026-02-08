import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId');
    const limitParam = searchParams.get('limit');
    let limit = 100;
    if (limitParam) {
      const parsedLimit = Number(limitParam);
      if (Number.isFinite(parsedLimit)) {
        limit = Math.min(Math.max(parsedLimit, 1), 200);
      }
    }

    let query = supabase
      .from('pharmacy_stock_history')
      .select('id, medicine_id, delta, before_stock, after_stock, stock_unit, source, note, created_at, pharmacy_medicines(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching pharmacy stock history:', error);
      return NextResponse.json({ error: 'Failed to fetch stock history' }, { status: 500 });
    }

    const history = (data || []).map((row: any) => ({
      ...row,
      medicine_name: row.pharmacy_medicines?.name ?? null,
      pharmacy_medicines: undefined,
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error('Unexpected error in GET /api/pharmacy-medicines/history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
