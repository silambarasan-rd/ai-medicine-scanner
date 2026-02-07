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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: medicine, error } = await supabase
      .from('pharmacy_medicines')
      .select('*, medicine_tags(tag:tags(id,name))')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !medicine) {
      console.error('Error fetching pharmacy medicine:', error);
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
    }

    const tags = (medicine.medicine_tags || []).map((mt: { tag: { id: string; name: string } }) => mt.tag);

    return NextResponse.json({ ...medicine, tags, medicine_tags: undefined });
  } catch (error) {
    console.error('Unexpected error in GET /api/pharmacy-medicines/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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
      refill_amount,
      history_note,
      tags,
    } = body;

    const shouldUpdateStock =
      typeof refill_amount === 'number' || typeof available_stock === 'number';
    let currentStock: number | null = null;
    let currentUnit: string | null = null;

    if (shouldUpdateStock) {
      const { data: current, error: currentError } = await supabase
        .from('pharmacy_medicines')
        .select('available_stock, stock_unit')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (currentError || !current) {
        console.error('Error reading current stock:', currentError);
        return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
      }

      currentStock = Number(current.available_stock || 0);
      currentUnit = current.stock_unit || null;
    }

    const updatePayload: Record<string, unknown> = {
      ...(name ? { name: name.trim() } : {}),
      ...(dosage !== undefined ? { dosage: dosage || null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(category ? { category } : {}),
      ...(safety_warnings !== undefined ? { safety_warnings: safety_warnings || null } : {}),
      ...(image_url !== undefined ? { image_url: image_url || null } : {}),
      ...(stock_unit ? { stock_unit } : {}),
    };

    if (typeof refill_amount === 'number') {
      updatePayload.available_stock = (currentStock ?? 0) + refill_amount;
    } else if (typeof available_stock === 'number') {
      updatePayload.available_stock = available_stock;
    }

    const { data: medicine, error } = await supabase
      .from('pharmacy_medicines')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error || !medicine) {
      console.error('Error updating pharmacy medicine:', error);
      return NextResponse.json({ error: 'Failed to update medicine' }, { status: 500 });
    }

    if (shouldUpdateStock && currentStock !== null) {
      const afterStock = Number(medicine.available_stock ?? 0);
      const delta = afterStock - currentStock;
      const source = typeof refill_amount === 'number' ? 'refill' : 'manual_adjustment';

      if (delta !== 0) {
        const { error: historyError } = await supabase
          .from('pharmacy_stock_history')
          .insert({
            user_id: user.id,
            medicine_id: id,
            delta,
            before_stock: currentStock,
            after_stock: afterStock,
            stock_unit: medicine.stock_unit || currentUnit || 'tablet',
            source,
            note: history_note || null,
          });

        if (historyError) {
          console.error('Error creating pharmacy stock history:', historyError);
          return NextResponse.json({ error: 'Failed to update stock history' }, { status: 500 });
        }
      }
    }

    if (Array.isArray(tags)) {
      const normalizedTags = normalizeTags(tags);

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

      const { error: clearError } = await supabase
        .from('medicine_tags')
        .delete()
        .eq('medicine_id', id);

      if (clearError) {
        console.error('Error clearing medicine tags:', clearError);
        return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
      }

      if (tagRows && tagRows.length > 0) {
        const medicineTagsPayload = tagRows.map((tag) => ({
          medicine_id: id,
          tag_id: tag.id,
        }));

        const { error: tagInsertError } = await supabase
          .from('medicine_tags')
          .insert(medicineTagsPayload);

        if (tagInsertError) {
          console.error('Error inserting medicine tags:', tagInsertError);
          return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
        }
      }

      return NextResponse.json({ ...medicine, tags: tagRows || [] });
    }

    return NextResponse.json(medicine);
  } catch (error) {
    console.error('Unexpected error in PUT /api/pharmacy-medicines/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('pharmacy_medicines')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting pharmacy medicine:', error);
      return NextResponse.json({ error: 'Failed to delete medicine' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/pharmacy-medicines/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
