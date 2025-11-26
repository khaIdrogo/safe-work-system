'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    })();
  }, []);
  return (
    <header className="bg-kmDark text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg">Safe Work System</span>
        <span className="text-sm opacity-75">| Permit & Inspection Management</span>
      </div>
      <div className="flex items-center gap-2">
        {email && <span className="text-sm hidden sm:block">Signed in: {email}</span>}
        <Link href="/dashboard" className="ml-2 rounded bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm text-white">Home</Link>
      </div>
    </header>
  );
}
