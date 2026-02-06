import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const createSupabaseClient = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
