'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
export default function InspectionDashboard() {
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/auth/signin'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
      if (data?.role !== 'admin' && data?.role !== 'inspector') { alert('You do not have access to Inspections.'); window.location.href = '/dashboard'; }
    })();
  }, []);
  return (
    <div>
      <h2 className="text-xl font-bold">Inspection Dashboard</h2>
      <div className="flex gap-4 mt-4">
        <Link href="/inspections/new" target="_blank" className="bg-green-600 text-white px-4 py-2 rounded">Perform New Inspection</Link>
        <Link href="/inspections/completed" className="bg-gray-600 text-white px-4 py-2 rounded">View Completed Inspections</Link>
      </div>
    </div>
  );
}
