
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type YesNoNA = 'Yes' | 'No' | 'N/A';

const renderYNN = (current: YesNoNA, onChange: (v: YesNoNA) => void) => (
  <div className="flex gap-3">
    {(['Yes','No','N/A'] as YesNoNA[]).map(opt => (
      <label key={opt} className="flex items-center gap-1">
        <input type="radio" checked={current===opt} onChange={() => onChange(opt)} />{opt}
      </label>
    ))}
  </div>
);

export default function NewInspection() {
  const [inspector, setInspector] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [entity, setEntity] = useState('');
  const [date, setDate] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [workPractices, setWorkPractices] = useState('');

  // PPE Section
  const PPE = ['Eye Protection','Safety Shoes','Clothing','Gloves','Respirators','Hearing Protection','Face Shields','Hard Hats'];
  const [ppeChecks, setPpeChecks] = useState<Record<string, YesNoNA>>(Object.fromEntries(PPE.map(k => [k, 'N/A'])));

  // Helper to create section state
  const createSectionState = (items: string) => Object.fromEntries(items.split('|').map(k => [k.trim(), 'N/A']));

  // Lockout / Tagout
  const [lockoutTagoutChecks, setLockoutTagoutChecks] = useState(createSectionState('Electric|Hydraulic|Pneumatic|Lock Box In Use|Individual Personnel Locks In Place'));
  const [lockoutOther, setLockoutOther] = useState('');
  const [lockoutOtherVal, setLockoutOtherVal] = useState<YesNoNA>('N/A');
  const [lockoutComments, setLockoutComments] = useState('');

  // Hot Work
  const [hotWorkChecks, setHotWorkChecks] = useState(createSectionState('Hot Work Permit In Place|Welding PPE In Use|Fire Extinguisher Available|Hearing Protection In Use|Combustibles/Flammables Removed or Mitigated|Fire Watch Assigned|4-Gas Monitor In Use'));
  const [hotWorkOther, setHotWorkOther] = useState('');
  const [hotWorkOtherVal, setHotWorkOtherVal] = useState<YesNoNA>('N/A');
  const [hotWorkComments, setHotWorkComments] = useState('');

  // Confined Space
  const [confinedSpaceChecks, setConfinedSpaceChecks] = useState(createSectionState('Confined Space Permit In Place|Non-Permit Confined Space Entry|Non-Entry Rescue Techniques in Rescue Plan|Hole Watch Assigned|4-Gas Monitor In Use|Adequate Ventilation'));
  const [confinedOther1, setConfinedOther1] = useState('');
  const [confinedOther1Val, setConfinedOther1Val] = useState<YesNoNA>('N/A');
  const [confinedOther2, setConfinedOther2] = useState('');
  const [confinedOther2Val, setConfinedOther2Val] = useState<YesNoNA>('N/A');
  const [confinedComments, setConfinedComments] = useState('');

  // Equipment
  const [equipmentChecks, setEquipmentChecks] = useState(createSectionState('Ladders|Electric Extension Cords|Guards on Equipment|Rigging Used Equipment Properly|Use of portable engine|Fall Protection Equipment Used Properly'));
  const [equipmentOther1, setEquipmentOther1] = useState('');
  const [equipmentOther1Val, setEquipmentOther1Val] = useState<YesNoNA>('N/A');
  const [equipmentOther2, setEquipmentOther2] = useState('');
  const [equipmentOther2Val, setEquipmentOther2Val] = useState<YesNoNA>('N/A');
  const [equipmentComments, setEquipmentComments] = useState('');

  // Scaffolding
  const [scaffoldingChecks, setScaffoldingChecks] = useState(createSectionState('Scaffolding In Use|Scaffolding Inspected by Competent Person|Fall Protection Required on Scaffolding'));
  const [scaffoldingOther1, setScaffoldingOther1] = useState('');
  const [scaffoldingOther1Val, setScaffoldingOther1Val] = useState<YesNoNA>('N/A');
  const [scaffoldingOther2, setScaffoldingOther2] = useState('');
  const [scaffoldingOther2Val, setScaffoldingOther2Val] = useState<YesNoNA>('N/A');
  const [scaffoldingComments, setScaffoldingComments] = useState('');

  // Housekeeping
  const [housekeepingChecks, setHousekeepingChecks] = useState(createSectionState('Trash picked up|Tripping Hazards Minimized|Port-A-Johns|Potable Water'));
  const [housekeepingOther1, setHousekeepingOther1] = useState('');
  const [housekeepingOther1Val, setHousekeepingOther1Val] = useState<YesNoNA>('N/A');
  const [housekeepingOther2, setHousekeepingOther2] = useState('');
  const [housekeepingOther2Val, setHousekeepingOther2Val] = useState<YesNoNA>('N/A');
  const [housekeepingComments, setHousekeepingComments] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/auth/signin'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
      if (data?.role !== 'admin' && data?.role !== 'inspector') { alert('Access denied'); window.close(); }
    })();
  }, []);

  const submit = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return alert('Not signed in');

    const payload = {
      inspection_type: 'Field Safety Inspection',
      inspector,
      project_title: projectTitle,
      entity_receiving_inspection: entity,
      date_of_inspection: date,
      ppe_checks,
      lockout_tagout: { checks: lockoutTagoutChecks, other: lockoutOther, otherVal: lockoutOtherVal, comments: lockoutComments },
      hot_work: { checks: hotWorkChecks, other: hotWorkOther, otherVal: hotWorkOtherVal, comments: hotWorkComments },
      confined_space: { checks: confinedSpaceChecks, other1: confinedOther1, other1Val: confinedOther1Val, other2: confinedOther2, other2Val: confinedOther2Val, comments: confinedComments },
      equipment: { checks: equipmentChecks, other1: equipmentOther1, other1Val: equipmentOther1Val, other2: equipmentOther2, other2Val: equipmentOther2Val, comments: equipmentComments },
      scaffolding: { checks: scaffoldingChecks, other1: scaffoldingOther1, other1Val: scaffoldingOther1Val, other2: scaffoldingOther2, other2Val: scaffoldingOther2Val, comments: scaffoldingComments },
      housekeeping: { checks: housekeepingChecks, other1: housekeepingOther1, other1Val: housekeepingOther1Val, other2: housekeepingOther2, other2Val: housekeepingOther2Val, comments: housekeepingComments },
      work_practices: workPractices,
      general_comments: generalComments,
      status: 'completed',
      created_by: auth.user.id
    };

    const { error } = await supabase.from('inspections').insert(payload);
    if (error) return alert(error.message);

    // Print Template
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Inspection</title></head><body>
      <h1 style="text-align:center">Field Safety Inspection</h1>
      <table border="1" cellspacing="0" cellpadding="6" width="100%">
        <tr><th>Inspector</th><td>${inspector}</td><th>Date</th><td>${date}</td></tr>
        <tr><th>Project Title & Number</th><td colspan="3">${projectTitle}</td></tr>
        <tr><th>Entity Receiving Inspection</th><td colspan="3">${entity}</td></tr>
      </table>
      ${renderPrintSection('PPE', ppeChecks)}
      ${renderPrintSection('Lockout / Tagout', lockoutTagoutChecks, lockoutComments)}
      ${renderPrintSection('Hot Work', hotWorkChecks, hotWorkComments)}
      ${renderPrintSection('Confined Space', confinedSpaceChecks, confinedComments)}
      ${renderPrintSection('Equipment', equipmentChecks, equipmentComments)}
      ${renderPrintSection('Scaffolding', scaffoldingChecks, scaffoldingComments)}
      ${renderPrintSection('Housekeeping', housekeepingChecks, housekeepingComments)}
      <h3>Work Practices</h3><div>${workPractices}</div>
      <h3>General Comments</h3><div>${generalComments}</div>
    </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const renderPrintSection = (title: string, checks: Record<string, YesNoNA>, comments?: string) => `
    <h3>${title}</h3>
    <table border="1" cellspacing="0" cellpadding="6" width="100%">
      <tr><th>Item</th><th>Yes</th><th>No</th><th>N/A</th></tr>
      ${Object.entries(checks).map(([k,v])=>`<tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>`).join('')}
    </table>
    ${comments ? `<h4>Comments</h4><div>${comments}</div>` : ''}
  `;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Perform New Inspection</h2>
      {/* Render all sections similarly */}
      {/* PPE Section */}
      {/* Lockout / Tagout Section */}
      {/* Hot Work Section */}
      {/* Confined Space Section */}
      {/* Equipment Section */}
      {/* Scaffolding Section */}
      {/* Housekeeping Section */}
      <div>
        <label>Work Practices</label>
        <textarea rows={4} value={workPractices} onChange={e => setWorkPractices(e.target.value)} className="w-full" />
      </div>
      <div>
        <label>General Comments</label>
        <textarea rows={4} value={generalComments} onChange={e => setGeneralComments(e.target.value)} className="w-full" />
      </div>
      <div className="flex gap-4">
        <button className="bg-kmGreen text-white px-4 py-2 rounded" onClick={submit}>Submit</button>
        <button className="bg-kmRed text-white px-4 py-2 rounded" onClick={() => window.close()}>Cancel</button>
      </div>
    </div>
  );
}
