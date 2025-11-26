'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function CompletedInspections() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/auth/signin'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
      if (data?.role !== 'admin' && data?.role !== 'inspector') { alert('Access denied'); window.location.href = '/dashboard'; return; }
      const { data: rows, error } = await supabase.from('inspections').select('id, inspection_type, inspector, project_title, date_of_inspection').order('date_of_inspection', { ascending: false });
      if (error) alert(error.message); else setItems(rows ?? []);
    })();
  }, []);
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Completed Inspections</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-kmGray">
              <th className="border p-2 text-left">Type</th>
              <th className="border p-2 text-left">Inspector</th>
              <th className="border p-2 text-left">Project</th>
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border p-2">{it.inspection_type}</td>
                <td className="border p-2">{it.inspector}</td>
                <td className="border p-2">{it.project_title}</td>
                <td className="border p-2">{it.date_of_inspection}</td>
                <td className="border p-2">
                  <button className="text-blue-700 underline" onClick={async () => {
                    const { data, error } = await supabase.from('inspections').select('*').eq('id', it.id).single();
                    if (error) return alert(error.message);
                    const w = window.open('', '_blank'); if (!w) return;
                    w.document.write(`<h1>${it.inspection_type}</h1><pre>${JSON.stringify(data, null, 2)}</pre>`);
                    w.document.close(); w.focus(); w.print();
                  }}>Print</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (<tr><td className="border p-2 italic" colSpan={5}>No completed inspections yet.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
