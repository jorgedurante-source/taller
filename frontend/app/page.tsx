'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Get slug from localStorage
      const savedSlug = localStorage.getItem('current_slug') || 'kabul';

      if (user) {
        if (user.role === 'admin' || user.role === 'mechanic' || user.role === 'staff') {
          router.replace(`/${savedSlug}/dashboard`);
        } else if (user.role === 'client') {
          router.replace(`/${savedSlug}/client`);
        } else if (user.role === 'superuser') {
          router.replace('/superadmin/dashboard');
        } else {
          router.replace(`/${savedSlug}/login`);
        }
      } else {
        // Check for super token
        const superToken = localStorage.getItem('super_token');
        if (superToken) {
          router.replace('/superadmin/dashboard');
        } else {
          router.replace(`/${savedSlug}/login`);
        }
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="font-bold text-slate-800 text-3xl tracking-tighter italic uppercase">MECH<span className="text-blue-600">HUB</span></div>
      <div className="text-slate-400 mt-2 font-bold uppercase text-[10px] tracking-widest">Iniciando Ecosistema...</div>
    </div>
  );
}
