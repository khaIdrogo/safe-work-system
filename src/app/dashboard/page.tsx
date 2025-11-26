'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Role = 'admin' | 'permit_writer' | 'inspector';
export default function Dashboard() {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/auth/signin'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
      setRole((data?.role ?? 'inspector') as Role);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Main Dashboard</h2>
      <p className="text-sm">Your role: <strong>{role ?? 'loading...'}</strong></p>
      <div className="flex flex-wrap gap-4">
        {(role === 'admin' || role === 'permit_writer') && (
          <Link href="/permits/dashboard" className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded">Safe Work Permit System</Link>
        )}
        {(role === 'admin' || role === 'inspector') && (
          <Link href="/inspections/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded">Inspections</Link>
        )}
      </div>
      <div className="mt-6">
        <Link href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.href = '/auth/signin'; }} className="text-red-600 underline">Sign out</Link>
      </div>
    </div>
  );
}
