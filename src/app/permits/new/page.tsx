'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PERMIT_TYPES,
  ADDITIONAL_PPE,
  HAZARD_REDUCTION_ITEMS,
  EQUIPMENT_CONDITION_ITEMS,
  SPECIAL_CONDITIONS_HEADER,
  SPECIAL_CONDITION_REQUIREMENTS_LEFT,
  SPECIAL_CONDITION_REQUIREMENTS_RIGHT,
  ADDITIONAL_DOCUMENTS,
  AIR_MONITORING_GASES
} from './permitOptions';

type JsonMap = Record<string, any>;

// ---------------- Air Monitoring Columns ----------------
const STATIC_COLS = ['Initial', '2nd Check'] as const;
const DYNAMIC_TIME_COLS = 9; // number of "Time:" columns (editable headers)

// Use gases exactly from constants; we will show Safe Range for known gases.
const GAS_ROWS = AIR_MONITORING_GASES.map(({ gas }) => gas);

// Safe ranges
const SAFE_RANGE: Record<string, string> = {
  'LEL': '<10%',
  'O₂': '19.5-23.5%',
  'H₂S': '<10ppm',
  'CO': '<35ppm',
  'VOC': '—',
};

// ------------- PPE Render Transform (display labels & items) -------------
type PPECategory = {
  key: string;                // original key in ADDITIONAL_PPE for storage (e.g., 'HAND_FACE_RESPIRATORY')
  label: string;              // display label (e.g., 'HEAD/FACE/RESPIRATORY')
  items: string[];            // display item labels
  postInputs?: Array<{
    // conditional extra inputs that appear based on selected checkboxes
    dependsOn: string[];      // item labels that trigger this input
    key: string;              // storage key for the input
    label: string;            // display label
    placeholder?: string;
  }>;
};

function buildPPERender(additionalPpe: typeof ADDITIONAL_PPE): PPECategory[] {
  // HEAD/FACE/RESPIRATORY from HAND_FACE_RESPIRATORY
  const headOrig = additionalPpe.HAND_FACE_RESPIRATORY ?? [];
  const headItems = headOrig
    .map((it) => {
      if (it.toLowerCase().includes('clamping')) return 'Cutting Goggles (Torch)';
      if (it.toLowerCase() === 'full face*') return ''; // remove
      if (it.toLowerCase() === 'hearing prot.') return 'Hearing Protection';
      if (it.toLowerCase() === 'double hearing protect') return 'Double Hearing Protection';
      if (it.toLowerCase() === 'half face*') return 'Half Face Respirator*';
      return it;
    })
    .filter(Boolean);

  // Add new respiratory items
  headItems.push(
    'Face Shield',
    'Full Face Respirator*',
    'Powered Air Purifying Respirator (PAPR)',
    'Supplied Air or SCBA',
    '5-Min Escape Pack'
  );

  // HAND category tweaks
  const handOrig = additionalPpe.HAND ?? [];
  const handItems = handOrig
    .map((it) => {
      if (it.toLowerCase() === 'impact gloves') return 'Impact Gloves';
      if (it.toLowerCase().startsWith('chemical gloves')) return 'Chemical Gloves';
      return it;
    });

  // BODY (from OTHER_PPE) with removes/relabels
  const bodyOrig = additionalPpe.OTHER_PPE ?? [];
  const bodyItems = bodyOrig
    .map((it) => {
      if (it.toLowerCase() === 'full body harness') return 'Fall Protection Harness & Lanyards';
      if (it.toLowerCase() === 'smoldering ppes') return 'Rescue Lifeline';
      if (it.toLowerCase() === 'fire retardant clothing') return 'Fire Retardant (FR) Clothing';
      if (it.toLowerCase() === 'kmit two watch vest') return 'Chemical Suit';
      return it;
    })
    .filter((it) => ![
      'Material guards',
      'H2S Monitor',
      'Other PPE – Level A',
      'Other PPE – Level B',
      'Other PPE – Level C',
    ].includes(it));

  // OTHER SAFETY EQUIPMENT (from OTHER)
  const otherEquipOrig = additionalPpe.OTHER ?? [];
  const otherEquipItems = otherEquipOrig; // label only changes

  const categories: PPECategory[] = [
    {
      key: 'HAND_FACE_RESPIRATORY',
      label: 'HEAD/FACE/RESPIRATORY',
      items: headItems,
      postInputs: [
        {
          dependsOn: ['Half Face Respirator*', 'Full Face Respirator*'],
          key: 'resp_cartridge_type',
          label: '*Cartridge Type Required:',
          placeholder: 'Enter cartridge type',
        },
      ]
    },
    {
      key: 'HAND',
      label: 'HAND',
      items: handItems,
      postInputs: [
        {
          dependsOn: ['Chemical Gloves'],
          key: 'chem_gloves_type',
          label: 'Type:',
          placeholder: 'Enter chemical glove type',
        }
      ]
    },
    {
      key: 'OTHER_PPE',
      label: 'BODY',
      items: bodyItems,
    },
    {
      key: 'OTHER',
      label: 'OTHER SAFETY EQUIPMENT',
      items: otherEquipItems,
    },
  ];

  return categories;
}

export default function NewPermit() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // VOC N/A default: true (row disabled unless unchecked)
  const [vocNA, setVocNA] = useState<boolean>(true);

  // Energy Control N/A default: true (section disabled unless unchecked)
  const [energyNA, setEnergyNA] = useState<boolean>(true);

  // Dynamic header labels for the "Time:" columns
  const [timeHeaders, setTimeHeaders] = useState<string[]>(
    Array.from({ length: DYNAMIC_TIME_COLS }, () => '')
  );

  // Main form state
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
    date_issued: '',
    time_issued: '',
    date_expires: '',
    time_expires: '',
    permit_types: {} as JsonMap,        // includes PRCS/NPRCS flags next to Confined Space
    ppe_requirements: {} as JsonMap,
    additional_ppe: {} as JsonMap,
    hazard_reduction: {} as JsonMap,
    equipment_condition: {} as JsonMap,
    energy_control: {} as JsonMap,
    special_conditions: {} as JsonMap,
    additional_documents: {} as JsonMap,
    air_monitoring: {} as JsonMap,      // table: { [gas]: { Initial, second, t1..tN } }
    air_monitoring_headers: {} as JsonMap, // { t1: '10:00', t2: '11:00', ... }
    instrument_info: {} as JsonMap,     // { make, model, serial, bump_tested: boolean|null, calibration_current: boolean|null }
    signatures: { issuer: '', receiver: '' } as JsonMap,
  });

  // Permit number (YY####) — integer like 260001
  const [nextPermitNumber, setNextPermitNumber] = useState<number | null>(null);

  // ---------- Auth ----------
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        window.location.href = '/auth/signin';
        return;
      }
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'permit_writer')) {
        alert('Access denied. Requires admin or permit writer.');
        window.location.href = '/dashboard';
      }
    })();
  }, []);

  // ---------- Init Air Monitoring grid ----------
  useEffect(() => {
    setFormData(prev => {
      if (Object.keys(prev.air_monitoring ?? {}).length > 0) return prev;
      const table: JsonMap = {};
      GAS_ROWS.forEach(gas => {
        table[gas] = { Initial: '', second: '' };
        for (let i = 1; i <= DYNAMIC_TIME_COLS; i++) {
          table[gas][`t${i}`] = '';
        }
      });
      // init headers: { t1: '', t2: '', ... }
      const headers: JsonMap = {};
      for (let i = 1; i <= DYNAMIC_TIME_COLS; i++) headers[`t${i}`] = '';
      return { ...prev, air_monitoring: table, air_monitoring_headers: headers };
    });
  }, []);

  // ---------- Simple helpers ----------
  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSimple = (section: keyof typeof formData, key: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [key]: !((prev[section] as JsonMap)[key] ?? false)
      }
    }));
  };

  const toggleNested = (
    section: keyof typeof formData,
    category: string,
    key: string
  ) => {
    setFormData(prev => {
      const sec = (prev[section] as JsonMap) ?? {};
      const cat = (sec[category] as JsonMap) ?? {};
      return {
        ...prev,
        [section]: {
          ...sec,
          [category]: {
            ...cat,
            [key]: !(cat[key] ?? false)
          }
        }
      };
    });
  };

  const setNestedText = (section: keyof typeof formData, key: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [key]: value
      }
    }));
  };

  const setAirCell = (gas: string, colKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      air_monitoring: {
        ...prev.air_monitoring,
        [gas]: { ...(prev.air_monitoring?.[gas] ?? {}), [colKey]: value }
      }
    }));
  };

  const setHeaderLabel = (idx: number, value: string) => {
    setTimeHeaders(prev => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
    setFormData(prev => ({
      ...prev,
      air_monitoring_headers: {
        ...prev.air_monitoring_headers,
        [`t${idx + 1}`]: value
      }
    }));
  };

  // ---------- Auto "+12 hours" for Expires ----------
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

  useEffect(() => {
    const { date_issued, time_issued } = formData;
    if (!date_issued || !time_issued) return;

    const start = new Date(`${date_issued}T${time_issued}`);
    if (isNaN(start.getTime())) return;

    const end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
    setFormData(prev => ({
      ...prev,
      date_expires: fmtDate(end),
      time_expires: fmtTime(end),
    }));
  }, [formData.date_issued, formData.time_issued]);

  // ---------- Monitoring enabled if Hot Work OR Confined Space (incl. PRCS/NPRCS) ----------
  const monitoringEnabled = useMemo(() => {
    const anySelected = (keys: string[]) => keys?.some(k => !!formData.permit_types[k]);
    const hotWorkSelected = anySelected(PERMIT_TYPES?.HOT_WORK ?? []);
    const confinedSelected =
      anySelected(PERMIT_TYPES?.CONFINED_SPACE ?? []) ||
      !!formData.permit_types?.PRCS ||
      !!formData.permit_types?.NPRCS;
    return hotWorkSelected || confinedSelected;
  }, [formData.permit_types]);

  // ---------- Permit number YY#### ----------
  const yearPrefix = useMemo(() => {
    const d = formData.date_issued ? new Date(formData.date_issued) : new Date();
    return String(d.getFullYear() % 100).padStart(2, '0');
  }, [formData.date_issued]);

  useEffect(() => {
    (async () => {
      const min = parseInt(`${yearPrefix}0000`, 10);
      const max = parseInt(`${yearPrefix}9999`, 10);

      const { data, error } = await supabase
        .from('safe_work_permits')
        .select('permit_number')
        .gte('permit_number', min)
        .lte('permit_number', max)
        .order('permit_number', { ascending: false })
        .limit(1);

      if (error) {
        setNextPermitNumber(min + 1);
        return;
      }

      if (data && data.length > 0 && typeof data[0].permit_number === 'number') {
        setNextPermitNumber(data[0].permit_number + 1);
      } else {
        setNextPermitNumber(min + 1);
      }
    })();
  }, [yearPrefix]);

  // ---------- Submit ----------
  const handleSubmit = async () => {
    try {
      if (!userId) return alert('Not signed in');

      setLoading(true);

      const payload: any = {
        ...formData,
        created_by: userId,
        permit_number: nextPermitNumber ?? null,
      };

      const { data, error } = await supabase
        .from('safe_work_permits')
        .insert([payload])
        .select('permit_number')
        .single();

      setLoading(false);

      if (error) {
        alert(`Error: ${error.message}`);
        return;
      }

      const w = window.open('', '_blank');
      if (!w) return;

      w.document.write(`
        <html>
          <head><title>Permit #${data.permit_number}</title></head>
          <body style="font-family: Arial, Helvetica, sans-serif; padding: 24px;">
            <h1>Safe Work Permit #${data.permit_number ?? '-'}</h1>
            <table border="1" cellspacing="0" cellpadding="6" width="100%">
              <tr><th>Date Issued</th><td>${formData.date_issued || '-'}</td><th>Time Issued</th><td>${formData.time_issued || '-'}</td></tr>
              <tr><th>Date Expires</th><td>${formData.date_expires || '-'}</td><th>Time Expires</th><td>${formData.time_expires || '-'}</td></tr>
              <tr><th>Facility</th><td>${formData.facility || '-'}</td><th>Location</th><td>${formData.location || '-'}</td></tr>
              <tr><th>Contractor</th><td colspan="3">${formData.contractor || '-'}</td></tr>
              <tr><th>Description of Work</th><td colspan="3">${formData.description_of_work || '-'}</td></tr>
            </table>
          </body>
        </html>
      `);
      w.document.close();
      w.focus();
      w.print();
    } catch (e: any) {
      setLoading(false);
      alert(e?.message ?? 'Unexpected error');
    }
  };

  // ---------- PPE transformed config ----------
  const PPE_RENDER = useMemo(() => buildPPERender(ADDITIONAL_PPE), []);

  // ---------- UI ----------
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create New Safe Work Permit</h2>

      {/* Permit Number */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Number</div>
        <div className="p-3">
          <div className="text-2xl font-bold">
            {nextPermitNumber ?? `${yearPrefix}0001`}
          </div>
        </div>
      </div>

      {/* Permit Details (condensed row for dates/times) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Details</div>
        <div className="p-3 grid md:grid-cols-4 gap-4">
          <div>
            <label className="font-medium">Date Issued</label>
            <input
              name="date_issued"
              type="date"
              value={formData.date_issued}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="font-medium">Time Issued</label>
            <input
              name="time_issued"
              type="time"
              value={formData.time_issued}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="font-medium">Date Expires</label>
            <input
              name="date_expires"
              type="date"
              value={formData.date_expires}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
              readOnly
            />
          </div>
          <div>
            <label className="font-medium">Time Expires</label>
            <input
              name="time_expires"
              type="time"
              value={formData.time_expires}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
              readOnly
            />
          </div>

          <div className="md:col-span-2">
            <label className="font-medium">Facility</label>
            <input
              name="facility"
              value={formData.facility}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-medium">Location</label>
            <input
              name="location"
              value={formData.location}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>

          <div className="md:col-span-4">
            <label className="font-medium">Contractor</label>
            <input
              name="contractor"
              value={formData.contractor}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>

          <div className="md:col-span-4">
            <label className="font-medium">Description of Work</label>
            <textarea
              name="description_of_work"
              rows={3}
              value={formData.description_of_work}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
        </div>
      </div>

      {/* Permit Types (top row: Hot Work + Confined Space) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Types</div>

        {/* Top row: HOT WORK & CONFINED SPACE side by side */}
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {/* HOT WORK */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Hot Work</div>
            <div className="space-y-2">
              {(PERMIT_TYPES?.HOT_WORK ?? []).map((item) => {
                const checked = !!(formData.permit_types as JsonMap)[item];
                return (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSimple('permit_types', item)}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
              <input
                placeholder="Other (specify)"
                className="mt-2 w-full border rounded px-2 py-1"
                value={(formData.permit_types?.hotwork_other as string) ?? ''}
                onChange={(e) => setNestedText('permit_types', 'hotwork_other', e.target.value)}
              />
            </div>
          </div>

          {/* CONFINED SPACE with PRCS/NPRCS inline */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2 flex items-center gap-4">
              <span>Confined Space</span>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.permit_types.PRCS}
                  onChange={() => toggleSimple('permit_types', 'PRCS')}
                />
                PRCS
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.permit_types.NPRCS}
                  onChange={() => toggleSimple('permit_types', 'NPRCS')}
                />
                NPRCS
              </label>
            </div>
            <div className="space-y-2">
              {(PERMIT_TYPES?.CONFINED_SPACE ?? []).map((item) => {
                const checked = !!(formData.permit_types as JsonMap)[item];
                return (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSimple('permit_types', item)}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
              <input
                placeholder="Other (specify)"
                className="mt-2 w-full border rounded px-2 py-1"
                value={(formData.permit_types?.confined_other as string) ?? ''}
                onChange={(e) => setNestedText('permit_types', 'confined_other', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Remaining categories excluding VEHICLE_ENTRY, PRCS, NPRCS, DNCS, HOT_WORK, CONFINED_SPACE */}
        <div className="px-3 pb-3 grid md:grid-cols-2 gap-4">
          {Object.entries(PERMIT_TYPES)
            .filter(([key]) =>
              !['VEHICLE_ENTRY', 'PRCS', 'NPRCS', 'DNCS', 'HOT_WORK', 'CONFINED_SPACE'].includes(key)
            )
            .map(([category, items]) => (
              <div key={category} className="border p-2 rounded">
                <div className="font-medium mb-2">{category.replace(/_/g, ' ')}</div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const checked = !!(formData.permit_types as JsonMap)[item];
                    return (
                      <label key={item} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSimple('permit_types', item)}
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                  <input
                    placeholder="Other (specify)"
                    className="mt-2 w-full border rounded px-2 py-1"
                    value={(formData.permit_types?.[`${category}_other`] as string) ?? ''}
                    onChange={(e) =>
                      setNestedText('permit_types', `${category}_other`, e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* PPE (renamed & transformed) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">
          Personal Protective Equipment (Minimum PPE Requirements: Hard Hat, Safety Glasses, Gloves, Safety Toe Footwear, and Reflective Vest)
        </div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {PPE_RENDER.map(({ key, label, items, postInputs }) => {
            const catObj = (formData.additional_ppe as JsonMap)[key] ?? {};
            const isSelected = (name: string) => !!catObj[name];

            return (
              <div key={key} className="border p-2 rounded">
                <div className="font-medium mb-2">{label}</div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <label key={item} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected(item)}
                        onChange={() => toggleNested('additional_ppe', key, item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}

                  {/* Conditional extra inputs */}
                  {postInputs?.map((pi) => {
                    const show = pi.dependsOn.some(isSelected);
                    if (!show) return null;
                    return (
                      <div key={pi.key} className="mt-2">
                        <label className="font-medium">{pi.label}</label>
                        <input
                          className="mt-1 w-full border rounded px-2 py-1"
                          placeholder={pi.placeholder ?? ''}
                          value={(catObj?.[pi.key] as string) ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => {
                              const sec = (prev.additional_ppe as JsonMap) ?? {};
                              const origCat = sec[key] ?? {};
                              return {
                                ...prev,
                                additional_ppe: {
                                  ...sec,
                                  [key]: { ...origCat, [pi.key]: val }
                                }
                              };
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hazard Reduction */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Hazard Reduction</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {HAZARD_REDUCTION_ITEMS.map((item) => {
            const checked = !!(formData.hazard_reduction as JsonMap)[item];
            return (
              <div key={item} className="border p-2 rounded">
                <div className="font-medium mb-2">{item}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSimple('hazard_reduction', item)}
                  />
                  <span>Yes</span>
                </label>
              </div>
            );
          })}
          <div className="md:col-span-2">
            <label className="font-medium">Other (specify)</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={(formData.hazard_reduction?.other_text as string) ?? ''}
              onChange={(e) => setNestedText('hazard_reduction', 'other_text', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Equipment Condition */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Equipment Condition</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {EQUIPMENT_CONDITION_ITEMS.map((item) => {
            const checked = !!(formData.equipment_condition as JsonMap)[item];
            return (
              <div key={item} className="border p-2 rounded">
                <div className="font-medium mb-2">{item}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSimple('equipment_condition', item)}
                  />
                  <span>Yes</span>
                </label>
              </div>
            );
          })}
          <div className="md:col-span-2">
            <label className="font-medium">Other (specify)</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={(formData.equipment_condition?.other_text as string) ?? ''}
              onChange={(e) =>
                setNestedText('equipment_condition', 'other_text', e.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* Energy Control (default N/A -> disabled) */}
      <div
        className={[
          'border rounded',
          energyNA ? 'opacity-60 pointer-events-none' : ''
        ].join(' ')}
      >
        <div className="bg-kmGray px-3 py-2 font-semibold flex items-center justify-between">
          <span>Energy Control</span>
          <label className="text-sm flex items-center gap-2 pr-2 pointer-events-auto">
            <input
              type="checkbox"
              checked={energyNA}
              onChange={() => setEnergyNA(v => !v)}
            />
            N/A
          </label>
        </div>
        <div className="p-3 grid md:grid-cols-3 gap-4">
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Verified lockout/tagout</div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.energy_control.lockout_verified}
                onChange={() => toggleSimple('energy_control', 'lockout_verified')}
                disabled={energyNA}
              />
              <span>Yes</span>
            </label>
          </div>
          <div className="border p-2 rounded md:col-span-2">
            <label className="font-medium">Lock Box Number</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.energy_control.lock_box_number ?? ''}
              onChange={(e) =>
                setNestedText('energy_control', 'lock_box_number', e.target.value)
              }
              disabled={energyNA}
            />
          </div>
        </div>
      </div>

      {/* Special Conditions */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Special Conditions</div>
        <div className="p-3 grid md:grid-cols-3 gap-4">
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Header</div>
            <div className="space-y-2">
              {SPECIAL_CONDITIONS_HEADER.map((item) => {
                const group = (formData.special_conditions as JsonMap)['HEADER'] ?? {};
                const checked = !!group[item];
                return (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNested('special_conditions', 'HEADER', item)}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Requirements (Left)</div>
            <div className="space-y-2">
              {SPECIAL_CONDITION_REQUIREMENTS_LEFT.map((item) => {
                const group = (formData.special_conditions as JsonMap)['LEFT'] ?? {};
                const checked = !!group[item];
                return (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNested('special_conditions', 'LEFT', item)}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Requirements (Right)</div>
            <div className="space-y-2">
              {SPECIAL_CONDITION_REQUIREMENTS_RIGHT.map((item) => {
                const group = (formData.special_conditions as JsonMap)['RIGHT'] ?? {};
                const checked = !!group[item];
                return (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNested('special_conditions', 'RIGHT', item)}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-3">
          <label className="font-medium">Other special conditions</label>
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={(formData.special_conditions?.other_text as string) ?? ''}
            onChange={(e) => setNestedText('special_conditions', 'other_text', e.target.value)}
          />
        </div>
      </div>

      {/* Air Monitoring (Perform continuous air monitoring, record hourly) */}
      <div
        className={[
          'border rounded',
          monitoringEnabled ? '' : 'opacity-60 pointer-events-none',
        ].join(' ')}
      >
        <div className="bg-kmGray px-3 py-2 font-semibold">
          Air Monitoring (Perform continuous air monitoring, record hourly)
        </div>
        <div className="p-3 overflow-x-auto">
          {/* VOC N/A: default checked; disables VOC row even when section enabled */}
          <div className="mb-2 text-sm flex items-center gap-4">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={vocNA}
                onChange={() => setVocNA(v => !v)}
                disabled={!monitoringEnabled}
              />
              VOC N/A (disable VOC row)
            </label>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">Gas</th>
                <th className="border px-2 py-1 text-left">Safe Range</th>
                <th className="border px-2 py-1 text-left">{STATIC_COLS[0]}</th>
                <th className="border px-2 py-1 text-left">{STATIC_COLS[1]}</th>
                {Array.from({ length: DYNAMIC_TIME_COLS }).map((_, idx) => (
                  <th key={`h-${idx}`} className="border px-2 py-1 text-left">
                    <div className="flex items-center gap-2">
                      <span>Time:</span>
                      <input
                        className="w-24 border rounded px-1 py-0.5"
                        value={timeHeaders[idx] ?? ''}
                        onChange={(e) => setHeaderLabel(idx, e.target.value)}
                        disabled={!monitoringEnabled}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GAS_ROWS.map((gas) => {
                const rowDisabled = gas === 'VOC' && vocNA;
                return (
                  <tr key={gas} className={rowDisabled ? 'bg-gray-100' : ''}>
                    <td className="border px-2 py-1 font-medium">{gas}</td>
                    <td className="border px-2 py-1 text-gray-700">{SAFE_RANGE[gas] ?? '—'}</td>
                    {/* Initial */}
                    <td className="border px-1 py-1">
                      <input
                        className="w-full border rounded px-1 py-0.5"
                        value={formData.air_monitoring?.[gas]?.['Initial'] ?? ''}
                        onChange={(e) => setAirCell(gas, 'Initial', e.target.value)}
                        disabled={!monitoringEnabled || rowDisabled}
                      />
                    </td>
                    {/* 2nd Check */}
                    <td className="border px-1 py-1">
                      <input
                        className="w-full border rounded px-1 py-0.5"
                        value={formData.air_monitoring?.[gas]?.['second'] ?? ''}
                        onChange={(e) => setAirCell(gas, 'second', e.target.value)}
                        disabled={!monitoringEnabled || rowDisabled}
                      />
                    </td>
                    {/* Dynamic Time columns (t1..tN) */}
                    {Array.from({ length: DYNAMIC_TIME_COLS }).map((_, idx) => {
                      const key = `t${idx + 1}`;
                      return (
                        <td key={key} className="border px-1 py-1">
                          <input
                            className="w-full border rounded px-1 py-0.5"
                            value={formData.air_monitoring?.[gas]?.[key] ?? ''}
                            onChange={(e) => setAirCell(gas, key, e.target.value)}
                            disabled={!monitoringEnabled || rowDisabled}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instrument Info (tied to monitoringEnabled) */}
      <div
        className={[
          'border rounded',
          monitoringEnabled ? '' : 'opacity-60 pointer-events-none',
        ].join(' ')}
      >
        <div className="bg-kmGray px-3 py-2 font-semibold">Instrument Info</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          <div>
            <label className="font-medium">Make</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.make ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'make', e.target.value)}
              disabled={!monitoringEnabled}
            />
          </div>
          <div>
            <label className="font-medium">Model</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.model ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'model', e.target.value)}
              disabled={!monitoringEnabled}
            />
          </div>
          <div>
            <label className="font-medium">Serial</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.serial ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'serial', e.target.value)}
              disabled={!monitoringEnabled}
            />
          </div>

          {/* Bump Tested Before Use: Yes/No (mutually exclusive checkboxes) */}
          <div className="flex items-center gap-6">
            <span className="font-medium">Bump Tested Before Use:</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={formData.instrument_info.bump_tested === true}
                onChange={() =>
                  setNestedText('instrument_info', 'bump_tested', true)
                }
                disabled={!monitoringEnabled}
              />
              Yes
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={formData.instrument_info.bump_tested === false}
                onChange={() =>
                  setNestedText('instrument_info', 'bump_tested', false)
                }
                disabled={!monitoringEnabled}
              />
              No
            </label>
          </div>

          {/* Calibration Current: Yes/No */}
          <div className="flex items-center gap-6">
            <span className="font-medium">Calibration Current:</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={formData.instrument_info.calibration_current === true}
                onChange={() =>
                  setNestedText('instrument_info', 'calibration_current', true)
                }
                disabled={!monitoringEnabled}
              />
              Yes
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={formData.instrument_info.calibration_current === false}
                onChange={() =>
                  setNestedText('instrument_info', 'calibration_current', false)
                }
                disabled={!monitoringEnabled}
              />
              No
            </label>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Signatures</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          <div>
            <label className="font-medium">Permit Issuer</label>
            <input
              name="issuer"
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.signatures.issuer}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  signatures: { ...(prev.signatures ?? {}), issuer: e.target.value }
                }))
              }
            />
          </div>
          <div>
            <label className="font-medium">Permit Receiver</label>
            <input
              name="receiver"
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.signatures.receiver}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  signatures: { ...(prev.signatures ?? {}), receiver: e.target.value }
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-kmGreen text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>
        <button
          onClick={() => window.history.back()}
          className="bg-kmRed text-white px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
