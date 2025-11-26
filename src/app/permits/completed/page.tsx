'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PermitListItem = { id: string; permit_number: number; facility: string; location: string; contractor: string; date_issued: string; status: string };

export default function CompletedPermits() {
  const [items, setItems] = useState<PermitListItem[]>([]);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/auth/signin'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
      if (data?.role !== 'admin' && data?.role !== 'permit_writer') { alert('Access denied'); window.location.href = '/dashboard'; return; }
      const { data: rows, error } = await supabase.from('safe_work_permits').select('id, permit_number, facility, location, contractor, date_issued, status').order('date_issued', { ascending: false });
      if (error) alert(error.message); else setItems(rows ?? []);
    })();
  }, []);

  const renderPrintHtml = (payload: any, permitNumber: number) => `
    <html><head><title>Safe Work Permit #${'${permitNumber}'}</title>
    <style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#dcdcdc;text-align:left;padding:6px;border:1px solid #aaa}td{border:1px solid #aaa;padding:6px;vertical-align:top}.section-title{background:#cfcfcf;padding:6px;font-weight:bold;border:1px solid #999}.badge{display:inline-block;background:#eee;padding:2px 6px;margin:2px;border-radius:4px;border:1px solid #ccc}</style>
    </head><body>
      <h1 style="text-align:center">Safe Work Permit Number: ${'${permitNumber}'}</h1>
      <!-- For brevity, show JSON; in production you may replicate full layout as in new form -->
      <pre>${'${JSON.stringify(payload, null, 2)}'}</pre>
    </body></html>`;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Completed Permits</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-kmGray">
              <th className="border p-2 text-left">Permit #</th>
              <th className="border p-2 text-left">Facility</th>
              <th className="border p-2 text-left">Location</th>
              <th className="border p-2 text-left">Contractor</th>
              <th className="border p-2 text-left">Date Issued</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border p-2">{it.permit_number}</td>
                <td className="border p-2">{it.facility}</td>
                <td className="border p-2">{it.location}</td>
                <td className="border p-2">{it.contractor}</td>
                <td className="border p-2">{it.date_issued}</td>
                <td className="border p-2">{it.status}</td>
                <td className="border p-2">
                  <button className="text-blue-700 underline" onClick={async () => {
                    const { data, error } = await supabase.from('safe_work_permits').select('*').eq('id', it.id).single();
                    if (error) return alert(error.message);
                    const w = window.open('', '_blank'); if (!w) return;
                    w.document.write(renderPrintHtml(data, it.permit_number)); w.document.close(); w.focus(); w.print();
                  }}>Print</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (<tr><td className="border p-2 italic" colSpan={7}>No completed permits yet.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
