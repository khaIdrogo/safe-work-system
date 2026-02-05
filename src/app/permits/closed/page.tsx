'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { printPermitHtml } from '@/lib/printTemplate';

type PermitRow = {
  id: string;
  permit_number: number | null;
  facility: string | null;
  location: string | null;
  contractor: string | null;
  date_issued: string | null;
  status?: string | null;
};

const PAGE_SIZE = 25;
// Adjust to whatever “closed” statuses you use
const CLOSED_VALUES = ['closed', 'Closed', 'complete', 'completed', 'Complete', 'Completed'];

export default function ClosedPermitsPage() {
  const [items, setItems] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [permitNo, setPermitNo] = useState<string>('');
  const [facility, setFacility] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [contractor, setContractor] = useState<string>('');
  const [dateIssued, setDateIssued] = useState<string>(''); // yyyy-mm-dd

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso ?? '';
    return d.toISOString().slice(0, 10);
  };

  // Fetch API
  const fetchPage = async (targetPage: number) => {
    setLoading(true);

    // base select with count
    let query = supabase
      .from('safe_work_permits')
      .select('id, permit_number, facility, location, contractor, date_issued, status', {
        count: 'exact',
      })
      .in('status', CLOSED_VALUES)
      .order('date_issued', { ascending: false });

    // Filters
    const permitNumberInt = parseInt(permitNo, 10);
    if (!Number.isNaN(permitNumberInt)) {
      query = query.eq('permit_number', permitNumberInt);
    }
    if (facility.trim()) {
      query = query.ilike('facility', `%${facility.trim()}%`);
    }
    if (location.trim()) {
      query = query.ilike('location', `%${location.trim()}%`);
    }
    if (contractor.trim()) {
      query = query.ilike('contractor', `%${contractor.trim()}%`);
    }
    if (dateIssued) {
      // capture whole day: [date, date + 1 day)
      const start = new Date(dateIssued);
      if (!isNaN(start.getTime())) {
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        query = query.gte('date_issued', start.toISOString()).lt('date_issued', end.toISOString());
      } else {
        // fallback exact: if storage is just YYYY-MM-DD text
        query = query.eq('date_issued', dateIssued);
      }
    }

    // Pagination
    const from = (targetPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      alert(error.message);
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as PermitRow[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        window.location.href = '/auth/signin';
        return;
      }

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

      fetchPage(1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => {
    setPage(1);
    fetchPage(1);
  };

  const onReset = () => {
    setPermitNo('');
    setFacility('');
    setLocation('');
    setContractor('');
    setDateIssued('');
    setPage(1);
    fetchPage(1);
  };

  const onPrev = () => {
    if (page <= 1) return;
    const p = page - 1;
    setPage(p);
    fetchPage(p);
  };

  const onNext = () => {
    if (page >= totalPages) return;
    const p = page + 1;
    setPage(p);
    fetchPage(p);
  };

  const onView = async (id: string, permitNumber: number | null) => {
    const { data, error } = await supabase
      .from('safe_work_permits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const num = permitNumber ?? 0;
    const html = printPermitHtml(data, num);

    const w = window.open('', '_blank');
    if (!w) {
      alert('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    // optional: w.print();
  };

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
          <td className="border p-2 italic" colSpan={6}>No closed permits found.</td>
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
          <button
            className="text-blue-700 underline"
            onClick={() => onView(it.id, it.permit_number)}
            title="Open print view"
          >
            View
          </button>
        </td>
      </tr>
    ));
  }, [items, loading]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Closed Permits</h2>

      {/* Filters */}
      <div className="border rounded p-3 mb-3">
        <div className="grid md:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm font-medium">Permit Number</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={permitNo}
              onChange={(e) => setPermitNo(e.target.value)}
              placeholder="e.g., 250123"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Facility</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              placeholder="contains…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Location</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="contains…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Contractor</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="contains…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Date Issued</label>
            <input
              type="date"
              className="mt-1 w-full border rounded px-2 py-1"
              value={dateIssued}
              onChange={(e) => setDateIssued(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            className="bg-blue-600 text-white px-3 py-1 rounded"
            onClick={onSearch}
            disabled={loading}
          >
            Search
          </button>
          <button
            className="bg-gray-600 text-white px-3 py-1 rounded"
            onClick={onReset}
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
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

      {/* Pagination */}
      <div className="mt-3 flex items-center gap-3">
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={onPrev}
          disabled={loading || page <= 1}
        >
          Previous
        </button>
        <span>
          Page <b>{page}</b> of <b>{totalPages}</b> ({totalCount} total)
        </span>
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={onNext}
          disabled={loading || page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
