import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = `${user.id}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from('medicine-images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Error uploading medicine image:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('medicine-images')
      .getPublicUrl(fileName);

    return NextResponse.json({ image_url: publicUrl });
  } catch (error) {
    console.error('Unexpected error in POST /api/pharmacy-medicines/upload:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
