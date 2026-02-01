import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

// GET /api/profile - Get user profile
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

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // Return profile or empty profile with user data
    const profileData = profile || {
      id: user.id,
      email: user.email,
      name: '',
      phone: '',
      emergency_contact: '',
      medical_conditions: '',
      profile_picture_url: '',
    };

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Unexpected error in GET /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update user profile
export async function PUT(request: NextRequest) {
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
    const { name, phone, emergency_contact, medical_conditions, profile_picture_url } = body;

    // Update or insert profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email,
        name,
        phone,
        emergency_contact,
        medical_conditions,
        profile_picture_url,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Unexpected error in PUT /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
