'use client';

import { useEffect } from 'react';
import { createClient } from './utils/supabase/client';
import { useRouter } from 'next/navigation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rosy-granite via-blue-slate to-deep-space-blue flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">💊</div>
        <h1 className="text-4xl font-bold text-white mb-4">MathirAI</h1>
        <div className="inline-block">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}