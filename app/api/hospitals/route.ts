import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSizeRaw = Number.parseInt(searchParams.get('pageSize') || '25', 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = clampNumber(Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25, 1, 100);
    const name = searchParams.get('name')?.trim();
    const district = searchParams.get('district')?.trim();
    const speciality = searchParams.get('speciality')?.trim();

    let queryBuilder = supabase
      .from('hospitals')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true });

    if (name) {
      queryBuilder = queryBuilder.ilike('name', `%${name}%`);
    }

    if (district) {
      queryBuilder = queryBuilder.ilike('district', `%${district}%`);
    }

    if (speciality) {
      queryBuilder = queryBuilder.ilike('speciality', `%${speciality}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      console.error('Error fetching hospitals:', error);
      return NextResponse.json({ error: 'Failed to fetch hospitals' }, { status: 500 });
    }

    const total = count ?? 0;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({
      items: data || [],
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/hospitals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
