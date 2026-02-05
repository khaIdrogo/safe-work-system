'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PermitRow = {
  id: string;
  permit_number: number | null;
  facility: string | null;
  location: string | null;
  contractor: string | null;
  date_issued: string | null;
  status?: string | null;
};

export default function OpenPermitsPage() {
  const [items, setItems] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso ?? '';
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    (async () => {
      // Auth
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        window.location.href = '/auth/signin';
        return;
      }
      // Role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .single();

      if (profile?.role !== 'admin' && profile?.role !== 'permit_writer') {
        alert('Access denied');
        window.location.href = '/dashboard';
        return;
      }

      // Fetch "open" permits
      // If your statuses differ, adjust the OPEN_VALUES list or switch to a direct .eq('status','open')
      const { data, error } = await supabase
        .from('safe_work_permits')
        .select('id, permit_number, facility, location, contractor, date_issued, status')
        .order('date_issued', { ascending: false });

      if (error) {
        alert(error.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const CLOSED_SET = new Set(['closed', 'complete', 'completed']);
      const OPEN_SET = new Set(['open', 'in-progress', 'in progress']); // extend if needed
      const filtered = (data ?? []).filter((r) => {
        const s = (r?.status ?? '').toString().trim().toLowerCase();
        // treat as open if it matches OPEN_SET OR (has a status and is NOT closed-ish)
        return OPEN_SET.has(s) || (s && !CLOSED_SET.has(s));
      });

      setItems(filtered as PermitRow[]);
      setLoading(false);
    })();
  }, []);

  const body = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td className="border p-2 italic" colSpan={6}>Loading…</td>
        </tr>
      );
    }
    if (items.length === 0) {
      return (
        <tr>
          <td className="border p-2 italic" colSpan={6}>No open permits found.</td>
        </tr>
      );
    }
    return items.map((it) => (
      <tr key={it.id}>
        <td className="border p-2">{it.permit_number ?? '-'}</td>
        <td className="border p-2">{it.facility ?? ''}</td>
        <td className="border p-2">{it.location ?? ''}</td>
        <td className="border p-2">{it.contractor ?? ''}</td>
        <td className="border p-2">{fmtDate(it.date_issued)}</td>
        <td className="border p-2">
          {/* If your view/edit route differs, change this href.
             Common patterns: /permits/[id], /permits/view/[id], or /permits/edit/[id] */}
          <Link href={`/permits/${it.id}`} className="text-blue-700 underline">
            View
          </Link>
        </td>
      </tr>
    ));
  }, [items, loading]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Open Permits</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-kmGray">
              <th className="border p-2 text-left">Permit Number</th>
              <th className="border p-2 text-left">Facility</th>
              <th className="border p-2 text-left">Location</th>
              <th className="border p-2 text-left">Contractor</th>
              <th className="border p-2 text-left">Date Issued</th>
              <th className="border p-2 text-left">View</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    </div>
  );
}
