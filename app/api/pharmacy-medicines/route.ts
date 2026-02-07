import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

const normalizeTags = (tags: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();
    const category = searchParams.get('category')?.trim();
    const tagsParam = searchParams.get('tags')?.trim();

    let medicineIds: string[] | null = null;

    if (tagsParam) {
      const tagNames = normalizeTags(tagsParam.split(','));
      if (tagNames.length > 0) {
        const { data: tagRows, error: tagError } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', user.id)
          .in('name', tagNames);

        if (tagError) {
          console.error('Error fetching tags:', tagError);
          return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
        }

        const tagIds = (tagRows || []).map((tag) => tag.id);
        if (tagIds.length === 0) {
          return NextResponse.json([]);
        }

        const { data: medTagRows, error: medTagError } = await supabase
          .from('medicine_tags')
          .select('medicine_id')
          .in('tag_id', tagIds);

        if (medTagError) {
          console.error('Error fetching medicine tags:', medTagError);
          return NextResponse.json({ error: 'Failed to fetch medicines for tags' }, { status: 500 });
        }

        medicineIds = (medTagRows || []).map((row) => row.medicine_id);
        if (medicineIds.length === 0) {
          return NextResponse.json([]);
        }
      }
    }

    let queryBuilder = supabase
      .from('pharmacy_medicines')
      .select('*, medicine_tags(tag:tags(id,name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (query) {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`);
    }

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    if (medicineIds) {
      queryBuilder = queryBuilder.in('id', medicineIds);
    }

    const { data: medicines, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching pharmacy medicines:', error);
      return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 });
    }

    const response = (medicines || []).map((medicine) => ({
      ...medicine,
      tags: (medicine.medicine_tags || []).map((mt: { tag: { id: string; name: string } }) => mt.tag),
      medicine_tags: undefined,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET /api/pharmacy-medicines:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      dosage,
      description,
      category,
      safety_warnings,
      image_url,
      available_stock,
      stock_unit,
      tags,
    } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    const normalizedTags = Array.isArray(tags) ? normalizeTags(tags) : [];
    if (normalizedTags.length === 0) {
      return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 });
    }

    const { data: medicine, error } = await supabase
      .from('pharmacy_medicines')
      .insert({
        user_id: user.id,
        name: name.trim(),
        dosage: dosage || null,
        description: description || null,
        category,
        safety_warnings: safety_warnings || null,
        image_url: image_url || null,
        available_stock: available_stock ?? 0,
        stock_unit: stock_unit || (category === 'syrup' ? 'ml' : 'tablet'),
      })
      .select('*')
      .single();

    if (error || !medicine) {
      console.error('Error creating pharmacy medicine:', error);
      return NextResponse.json({ error: 'Failed to create medicine' }, { status: 500 });
    }

    const initialStock = Number(medicine.available_stock ?? 0);
    const { error: historyError } = await supabase
      .from('pharmacy_stock_history')
      .insert({
        user_id: user.id,
        medicine_id: medicine.id,
        delta: initialStock,
        before_stock: 0,
        after_stock: initialStock,
        stock_unit: medicine.stock_unit,
        source: 'initial_stock',
        note: null,
      });

    if (historyError) {
      console.error('Error creating pharmacy stock history:', historyError);
      return NextResponse.json({ error: 'Failed to create stock history' }, { status: 500 });
    }

    const { data: tagRows, error: tagError } = await supabase
      .from('tags')
      .upsert(
        normalizedTags.map((tag) => ({ user_id: user.id, name: tag })),
        { onConflict: 'user_id,name' }
      )
      .select('id,name');

    if (tagError) {
      console.error('Error upserting tags:', tagError);
      return NextResponse.json({ error: 'Failed to save tags' }, { status: 500 });
    }

    const medicineTagsPayload = (tagRows || []).map((tag) => ({
      medicine_id: medicine.id,
      tag_id: tag.id,
    }));

    const { error: medTagError } = await supabase
      .from('medicine_tags')
      .insert(medicineTagsPayload);

    if (medTagError) {
      console.error('Error inserting medicine tags:', medTagError);
      return NextResponse.json({ error: 'Failed to link tags' }, { status: 500 });
    }

    return NextResponse.json({ ...medicine, tags: tagRows || [] }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/pharmacy-medicines:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
