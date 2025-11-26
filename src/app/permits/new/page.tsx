'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type YesNoNA = 'Yes' | 'No' | 'N/A';

export default function NewPermit() {
  const [facility, setFacility] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    const payload = { facility, description_of_work: description };
    const { data, error } = await supabase.from('safe_work_permits').insert(payload).select('permit_number').single();
    if (error) { alert(error.message); return; }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Permit #${data.permit_number}</title></head><body>
      <h1>Safe Work Permit Number: ${data.permit_number}</h1>
      <p>Facility: ${payload.facility}</p>
      <p>Description: ${payload.description_of_work}</p>
      </body></html>
    `);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div>
      <h2>Create Permit</h2>
      <input placeholder="Facility" value={facility} onChange={(e) => setFacility(e.target.value)} />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
