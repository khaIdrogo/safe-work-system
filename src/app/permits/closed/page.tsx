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
  permit_types?: Record<string, any> | null;
};

const PAGE_SIZE = 25;

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

  // NEW: Permit Type filter (client-side derived)
  const [permitTypeFilter, setPermitTypeFilter] = useState<string>(''); // '', 'Hot Work', 'Confined Space', 'General Work', 'Other'

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso ?? '';
    return d.toISOString().slice(0, 10);
  };

  // Derive a human Permit Type from JSONB booleans
  const derivePermitType = (pt?: Record<string, any> | null): 'Hot Work' | 'Confined Space' | 'General Work' | 'Other' => {
    if (!pt) return 'Other';
    if (pt.PRCS || pt.NPRCS) return 'Confined Space';
    if (pt['Burning/Brazing/Welding'] || pt['Grinding/Cutting'] || pt['Use of torch']) return 'Hot Work';

    const GENERAL_WORK_REPLACED = [
      'Install equipment/materials',
      'Inspect/troubleshoot/test',
      'Run conduit/wire/pipe/tubing',
      'Use of hand tools',
      'Use of electric/power tools',
      'Working at elevations/overhead',
      'Hand paint/wire brush/scrape',
      'Hydro/pneumatic pressure test',
      'Crane/lifting equipment',
      'Use of heavy equipment',
    ];
    if (GENERAL_WORK_REPLACED.some((k) => !!pt[k])) return 'General Work';
    return 'Other';
  };

  const fetchPage = async (targetPage: number) => {
    setLoading(true);

    let query = supabase
      .from('safe_work_permits')
      .select('id, permit_number, facility, location, contractor, date_issued, status, permit_types', {
        count: 'exact',
      })
      .eq('status', 'closed') // canonical
      .order('date_issued', { ascending: false });

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
      const start = new Date(dateIssued);
      if (!isNaN(start.getTime())) {
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        query = query.gte('date_issued', start.toISOString()).lt('date_issued', end.toISOString());
      } else {
        query = query.eq('date_issued', dateIssued);
      }
    }

    // Pagination (server-side)
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
    setPermitTypeFilter(''); // reset permit type filter
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
  };

  // Client-side permit type derivation and filter (applied to current page items)
  const pageItemsFiltered = useMemo(() => {
    if (!permitTypeFilter) return items;
    return items.filter((it) => derivePermitType(it.permit_types) === permitTypeFilter);
  }, [items, permitTypeFilter]);

  const body = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td className="border p-2 italic" colSpan={7}>Loading…</td>
        </tr>
      );
    }
    if (pageItemsFiltered.length === 0) {
      return (
        <tr>
          <td className="border p-2 italic" colSpan={7}>No closed permits found.</td>
        </tr>
      );
    }
    return pageItemsFiltered.map((it) => (
      <tr key={it.id}>
        <td className="border p-2">{it.permit_number ?? '-'}</td>
        <td className="border p-2">{derivePermitType(it.permit_types)}</td>
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
  }, [items, pageItemsFiltered, loading]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Closed Permits</h2>

      {/* Filters */}
      <div className="border rounded p-3 mb-3">
        <div className="grid md:grid-cols-6 gap-3">
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

          {/* NEW: Permit Type (client-side filter) */}
          <div>
            <label className="block text-sm font-medium">Permit Type</label>
            <select
              className="mt-1 w-full border rounded px-2 py-1"
              value={permitTypeFilter}
              onChange={(e) => setPermitTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="Hot Work">Hot Work</option>
              <option value="Confined Space">Confined Space</option>
              <option value="General Work">General Work</option>
              <option value="Other">Other</option>
            </select>
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

        {/* Small note about client-side permit type filter */}
        {permitTypeFilter && (
          <div className="text-xs text-gray-600 mt-2">
            * Permit Type filter is applied on the current page after server filters.
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-kmGray">
              <th className="border p-2 text-left">Permit Number</th>
              <th className="border p-2 text-left">Permit Type</th>
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
``
