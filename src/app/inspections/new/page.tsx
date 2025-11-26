'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type YesNoNA = 'Yes' | 'No' | 'N/A';

export default function NewInspection() {
  const [inspector, setInspector] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [entity, setEntity] = useState('');
  const [date, setDate] = useState('');
  const [comments, setComments] = useState('');

  const PPE = ['Eye Protection','Safety Shoes','Clothing','Gloves','Respirators','Hearing Protection','Face Shields','Hard Hats'];
  const [ppeChecks, setPpeChecks] = useState<Record<string, YesNoNA>>(Object.fromEntries(PPE.map((k) => [k, 'N/A'])) as Record<string, YesNoNA>);
  const [other1, setOther1] = useState('');
  const [other2, setOther2] = useState('');
  const [other1Val, setOther1Val] = useState<YesNoNA>('N/A');
  const [other2Val, setOther2Val] = useState<YesNoNA>('N/A');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/auth/signin'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
      if (data?.role !== 'admin' && data?.role !== 'inspector') { alert('Access denied'); window.close(); }
    })();
  }, []);

  const renderYNN = (current: YesNoNA, onChange: (v: YesNoNA) => void) => (
    <div className="flex gap-3">
      {(['Yes','No','N/A'] as YesNoNA[]).map((opt) => (
        <label key={opt} className="flex items-center gap-1"><input type="radio" checked={current===opt} onChange={() => onChange(opt)} />{opt}</label>
      ))}
    </div>
  );

  const submit = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return alert('Not signed in');
    const payload = {
      inspection_type: 'Field Safety Inspection',
      inspector,
      project_title: projectTitle,
      entity_receiving_inspection: entity,
      date_of_inspection: date,
      ppe_checks: { ...ppeChecks, Other1: { label: other1, val: other1Val }, Other2: { label: other2, val: other2Val } },
      comments,
      status: 'completed',
      created_by: auth.user.id
    };
    const { error } = await supabase.from('inspections').insert(payload);
    if (error) return alert(error.message);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Inspection</title></head><body>
      <h1 style="text-align:center">Field Safety Inspection</h1>
      <table border="1" cellspacing="0" cellpadding="6" width="100%">
        <tr><th>Inspector</th><td>${inspector}</td><th>Date</th><td>${date}</td></tr>
        <tr><th>Project Title & Number</th><td colspan="3">${projectTitle}</td></tr>
        <tr><th>Entity Receiving Inspection</th><td colspan="3">${entity}</td></tr>
      </table>
      <h3>Personal Protective Equipment</h3>
      <table border="1" cellspacing="0" cellpadding="6" width="100%">
        <tr><th>Item</th><th>Yes</th><th>No</th><th>N/A</th></tr>
        ${Object.entries(ppeChecks).map(([k,v])=>`<tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>`).join('')}
      </table>
      <h3>Comments</h3>
      <div style="border:1px solid #aaa; padding:8px;">${comments}</div>
      </body></html>
    `);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Perform New Inspection</h2>
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Field Safety Inspection</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          <div><label>Inspector</label><input value={inspector} onChange={(e) => setInspector(e.target.value)} /></div>
          <div><label>Date of Inspection</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="md:col-span-2"><label>Project Title and Number</label><input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} /></div>
          <div className="md:col-span-2"><label>Entity Receiving Inspection</label><input value={entity} onChange={(e) => setEntity(e.target.value)} /></div>
        </div>
        <div className="bg-kmGray px-3 py-2 font-semibold">Personal Protective Equipment</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {Object.keys(ppeChecks).map((item) => (
            <div key={item} className="border p-2 rounded">
              <div className="font-medium mb-2">{item}</div>
              {renderYNN(ppeChecks[item], (v) => setPpeChecks({ ...ppeChecks, [item]: v }))}
            </div>
          ))}
          <div className="border p-2 rounded"><label>Other 1</label><input value={other1} onChange={(e) => setOther1(e.target.value)} className="mt-1 mb-2 w-full" />{renderYNN(other1Val, setOther1Val)}</div>
          <div className="border p-2 rounded"><label>Other 2</label><input value={other2} onChange={(e) => setOther2(e.target.value)} className="mt-1 mb-2 w-full" />{renderYNN(other2Val, setOther2Val)}</div>
        </div>
        <div className="bg-kmGray px-3 py-2 font-semibold">Comments</div>
        <div className="p-3"><textarea rows={5} value={comments} onChange={(e) => setComments(e.target.value)} className="w-full" /></div>
      </div>
      <div className="flex gap-4"><button className="bg-kmGreen text-white px-4 py-2 rounded" onClick={submit}>Submit</button><button className="bg-kmRed text-white px-4 py-2 rounded" onClick={() => window.close()}>Cancel</button></div>
    </div>
  );
}
