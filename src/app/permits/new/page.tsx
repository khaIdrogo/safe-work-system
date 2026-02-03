'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PERMIT_TYPES,
  ADDITIONAL_PPE,
  HAZARD_REDUCTION_ITEMS,
  EQUIPMENT_CONDITION_ITEMS,
  SPECIAL_CONDITION_REQUIREMENTS_LEFT,
  SPECIAL_CONDITION_REQUIREMENTS_RIGHT,
  ADDITIONAL_DOCUMENTS,
  AIR_MONITORING_GASES
} from './permitOptions';

type JsonMap = Record<string, any>;

// ---------------- Air Monitoring ----------------
const DYNAMIC_TIME_COLS = 9; // editable time headers (t1..t9)

// Gases from constants
const GAS_ROWS = AIR_MONITORING_GASES.map(({ gas }) => gas);

// Safe ranges
const SAFE_RANGE: Record<string, string> = {
  'LEL': '<10%',
  'O₂': '19.5-23.5%',
  'H₂S': '<10ppm',
  'CO': '<35ppm',
  'VOC': '—',
};

// ---------------- Permit Types transforms ----------------
function transformHotWork(items: string[]): string[] {
  const removed = new Set([
    'Use of electric power tools',
    'Hot tar activities',
    'In-situ care maintenance activities (Mow-Edge Weed eat)',
    'Electrical work that could result in arc/spark',
    'Use of low volt tools/equip',
  ]);
  return items
    .filter((it) => !removed.has(it))
    .map((it) => {
      if (it === 'Burning/Welding/Cutting') return 'Burning/Welding';
      if (it === 'Grinding/Chopping (Grinding)') return 'Grinding/Cutting';
      return it;
    });
}

function transformConfinedSpace(items: string[]): string[] {
  const removed = new Set([
    'Entry after cooling off',
    'Switching building entries',
    'Breaking lines connections blow-up work',
  ]);
  return items.filter((it) => !removed.has(it));
}

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

// ---------------- PPE rendering transform ----------------
type PPECategory = {
  key: string;    // original key to store under additional_ppe JSON
  label: string;  // display label
  items: string[];
  postInputs?: Array<{
    dependsOn: string[];
    key: string;
    label: string;
    placeholder?: string;
  }>;
};

function buildPPERender(additionalPpe: typeof ADDITIONAL_PPE): PPECategory[] {
  // HEAD/FACE/RESPIRATORY from HAND_FACE_RESPIRATORY
  const headOrig = additionalPpe.HAND_FACE_RESPIRATORY ?? [];
  const headItems = headOrig
    .map((it) => {
      const low = it.toLowerCase();
      if (low.includes('clamping')) return 'Cutting Goggles (Torch)';
      if (low === 'full face*') return ''; // remove
      if (low === 'hearing prot.') return 'Hearing Protection';
      if (low === 'double hearing protect') return 'Double Hearing Protection';
      if (low === 'half face*') return 'Half Face Respirator*';
      return it;
    })
    .filter(Boolean) as string[];

  headItems.push(
    'Face Shield',
    'Full Face Respirator*',
    'Powered Air Purifying Respirator (PAPR)',
    'Supplied Air or SCBA',
    '5-Min Escape Pack'
  );

  // HAND
  const handOrig = additionalPpe.HAND ?? [];
  const handItems = handOrig.map((it) => {
    const low = it.toLowerCase();
    if (low === 'impact gloves') return 'Impact Gloves';
    if (low.startsWith('chemical gloves')) return 'Chemical Gloves';
    return it;
  });

  // BODY from OTHER_PPE with mapping/removals applied earlier
  const bodyOrig = additionalPpe.OTHER_PPE ?? [];
  const bodyItems = bodyOrig
    .map((it) => {
      const low = it.toLowerCase();
      if (low === 'full body harness') return 'Fall Protection Harness & Lanyards';
      if (low === 'smoldering ppes') return 'Rescue Lifeline';
      if (low === 'fire retardant clothing') return 'Fire Retardant (FR) Clothing';
      if (low === 'kmit two watch vest') return 'Chemical Suit';
      return it;
    })
    .filter((it) => ![
      'Material guards',
      'H2S Monitor',
      'Other PPE – Level A',
      'Other PPE – Level B',
      'Other PPE – Level C',
    ].includes(it));

  // OTHER SAFETY EQUIPMENT (from OTHER) with new filtering/remap
  const otherOrig = additionalPpe.OTHER ?? [];
  const otherItems = otherOrig
    .map((it) => {
      if (it === 'Intentionally Split equip / 12 volt lighting') {
        return 'Intrinsically Safe Equipment';
      }
      return it;
    })
    .filter((it) => ![
      'Descent Device',
      'X Ray barricades',
      'X-Ray barricades',
      'Rail Switch Locks',
      'Blue Flag / Derailer',
      'Other',
      'Other Special PPE',
    ].includes(it));

  return [
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
      items: otherItems,
    },
  ];
}

export default function NewPermit() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // VOC N/A default true (row disabled until unchecked)
  const [vocNA, setVocNA] = useState<boolean>(true);

  // Energy Control N/A default true (section disabled until unchecked)
  const [energyNA, setEnergyNA] = useState<boolean>(true);

  // Dynamic header labels for the "Time:" columns
  const [timeHeaders, setTimeHeaders] = useState<string[]>(
    Array.from({ length: DYNAMIC_TIME_COLS }, () => '')
  );

  // Build current date/time defaults (local)
  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultTime = useMemo(() => new Date().toTimeString().slice(0, 5), []);

  // Compute min time for "Time Issued"
  const minTimeForDate = (dateStr: string): string => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    if (dateStr === todayStr) {
      return today.toTimeString().slice(0, 5);
    }
    return '00:00';
    };

  // Main form state
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
    date_issued: defaultDate, // prepopulated
    time_issued: defaultTime, // prepopulated
    date_expires: '',
    time_expires: '',
    permit_types: {} as JsonMap,        // includes PRCS/NPRCS flags next to CONFINED SPACE
    ppe_requirements: {} as JsonMap,
    additional_ppe: {} as JsonMap,
    // Combined section will still save into two JSON fields below:
    hazard_reduction: {} as JsonMap,     // { item: { yes: boolean, na: boolean } }
    equipment_condition: {} as JsonMap,  // { item: { yes: boolean, na: boolean } }
    energy_control: {} as JsonMap,
    special_conditions: {} as JsonMap,
    additional_documents: {} as JsonMap,
    air_monitoring: {} as JsonMap,      // table: { gas: { Initial, t1..tN } }
    air_monitoring_headers: {} as JsonMap, // { t1: '10:00', ... }
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
        table[gas] = { Initial: '' };
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

  // ---------- Helpers ----------
  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateIssued = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => {
      // if switching to today, ensure time_issued >= now
      const minTime = minTimeForDate(value);
      let timeIssued = prev.time_issued;
      if (value === defaultDate && timeIssued < minTime) {
        timeIssued = minTime;
      }
      return { ...prev, date_issued: value, time_issued: timeIssued };
    });
  };

  const handleTimeIssued = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => {
      const minTime = minTimeForDate(prev.date_issued);
      const coerced = value < minTime ? minTime : value;
      return { ...prev, time_issued: coerced };
    });
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

  // ---------- Monitoring enabled if HOT WORK OR CONFINED SPACE (incl. PRCS/NPRCS) ----------
  const monitoringEnabled = useMemo(() => {
    const anySelected = (keys: string[]) => keys?.some(k => !!formData.permit_types[k]);
    const hotWorkSelected = anySelected(transformHotWork(PERMIT_TYPES?.HOT_WORK ?? []));
    const confinedSelected =
      anySelected(transformConfinedSpace(PERMIT_TYPES?.CONFINED_SPACE ?? [])) ||
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

  // ---------- Submit (with back-dating validation on date+time) ----------
  const handleSubmit = async () => {
    try {
      if (!userId) return alert('Not signed in');

      // Back-date validation: disallow any issued time before now if date is today
      const issued = new Date(`${formData.date_issued}T${formData.time_issued}`);
      const nowLocal = new Date();
      if (isNaN(issued.getTime()) || issued.getTime() < nowLocal.getTime()) {
        alert('Date/Time Issued cannot be in the past.');
        return;
      }

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

  // ---------- Combined Hazard + Equipment (Yes/N/A per item) ----------
  const setYesNA = (
    section: 'hazard_reduction' | 'equipment_condition',
    item: string,
    field: 'yes' | 'na',
    value: boolean
  ) => {
    setFormData(prev => {
      const sec = (prev[section] as JsonMap) ?? {};
      const cur = (sec[item] as JsonMap) ?? { yes: false, na: false };
      const next = { ...cur, [field]: value };
      // mutual exclusivity
      if (field === 'yes' && value) next.na = false;
      if (field === 'na' && value) next.yes = false;
      return { ...prev, [section]: { ...sec, [item]: next } };
    });
  };

  // helper boolean getters
  const getYes = (section: 'hazard_reduction' | 'equipment_condition', item: string) =>
    !!(formData[section]?.[item]?.yes);
  const getNA = (section: 'hazard_reduction' | 'equipment_condition', item: string) =>
    !!(formData[section]?.[item]?.na);

  // ---------- UI ----------
  const minTime = minTimeForDate(formData.date_issued);

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

      {/* Permit Details */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Details</div>
        <div className="p-3 grid md:grid-cols-4 gap-4">
          <div>
            <label className="font-medium">Date Issued</label>
            <input
              name="date_issued"
              type="date"
              value={formData.date_issued}
              min={defaultDate}
              onChange={handleDateIssued}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="font-medium">Time Issued</label>
            <input
              name="time_issued"
              type="time"
              value={formData.time_issued}
              min={minTime}
              onChange={handleTimeIssued}
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

      {/* Permit Types (top row: HOT WORK + CONFINED SPACE) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Types</div>

        {/* Top row: HOT WORK & CONFINED SPACE side by side */}
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {/* HOT WORK */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">HOT WORK</div>
            <div className="space-y-2">
              {transformHotWork(PERMIT_TYPES?.HOT_WORK ?? []).map((item) => {
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

          {/* CONFINED SPACE (uppercased label) w/ PRCS/NPRCS mutually exclusive */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2 flex items-center gap-4">
              <span>CONFINED SPACE</span>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.permit_types.PRCS}
                  onChange={() =>
                    setFormData(prev => ({
                      ...prev,
                      permit_types: { ...(prev.permit_types ?? {}), PRCS: !prev.permit_types?.PRCS, NPRCS: false }
                    }))
                  }
                />
                PRCS
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.permit_types.NPRCS}
                  onChange={() =>
                    setFormData(prev => ({
                      ...prev,
                      permit_types: { ...(prev.permit_types ?? {}), NPRCS: !prev.permit_types?.NPRCS, PRCS: false }
                    }))
                  }
                />
                NPRCS
              </label>
            </div>
            <div className="space-y-2">
              {transformConfinedSpace(PERMIT_TYPES?.CONFINED_SPACE ?? []).map((item) => {
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

        {/* Remaining categories excluding VEHICLE_ENTRY, PRCS, NPRCS, DNCS, HOT_WORK, CONFINED_SPACE; replace GENERAL_WORK */}
        <div className="px-3 pb-3 grid md:grid-cols-2 gap-4">
          {/* GENERAL WORK (replaced list) */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">GENERAL WORK</div>
            <div className="space-y-2">
              {GENERAL_WORK_REPLACED.map((item) => {
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
                value={(formData.permit_types?.GENERAL_WORK_other as string) ?? ''}
                onChange={(e) => setNestedText('permit_types', 'GENERAL_WORK_other', e.target.value)}
              />
            </div>
          </div>

          {/* Other remaining categories */}
          {Object.entries(PERMIT_TYPES)
            .filter(([key]) =>
              !['VEHICLE_ENTRY', 'PRCS', 'NPRCS', 'DNCS', 'HOT_WORK', 'CONFINED_SPACE', 'GENERAL_WORK'].includes(key)
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

      {/* Combined: Hazard Reduction + Equipment Condition */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Hazard Reduction & Equipment Condition</div>
        <div className="p-3 grid md:grid-cols-2 gap-6">

          {/* Hazard Reduction side */}
          <div>
            <div className="grid grid-cols-[1fr,60px,60px] gap-2 items-center font-medium mb-2">
              <div>Hazard Reduction</div>
              <div className="text-center">Yes</div>
              <div className="text-center">N/A</div>
            </div>
            <div className="space-y-1">
              {HAZARD_REDUCTION_ITEMS.map((item) => {
                const isOther = item.toLowerCase().startsWith('other');
                return (
                  <div key={item} className="grid grid-cols-[1fr,60px,60px] gap-2 items-center border rounded px-2 py-1">
                    <div className="text-sm">{item}</div>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={getYes('hazard_reduction', item)}
                        onChange={(e) => setYesNA('hazard_reduction', item, 'yes', e.target.checked)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={getNA('hazard_reduction', item)}
                        onChange={(e) => setYesNA('hazard_reduction', item, 'na', e.target.checked)}
                      />
                    </div>
                    {/* Conditional "Other (specify)" appears only if "Other" Yes is selected */}
                    {isOther && getYes('hazard_reduction', item) && (
                      <div className="col-span-3 mt-1">
                        <label className="text-sm font-medium">Other (specify)</label>
                        <input
                          className="mt-1 w-full border rounded px-2 py-1"
                          value={(formData.hazard_reduction?.other_text as string) ?? ''}
                          onChange={(e) => setNestedText('hazard_reduction', 'other_text', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipment Condition side */}
          <div>
            <div className="grid grid-cols-[1fr,60px,60px] gap-2 items-center font-medium mb-2">
              <div>Equipment Condition</div>
              <div className="text-center">Yes</div>
              <div className="text-center">N/A</div>
            </div>
            <div className="space-y-1">
              {EQUIPMENT_CONDITION_ITEMS.map((item) => {
                const isOther = item.toLowerCase().startsWith('other');
                return (
                  <div key={item} className="grid grid-cols-[1fr,60px,60px] gap-2 items-center border rounded px-2 py-1">
                    <div className="text-sm">{item}</div>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={getYes('equipment_condition', item)}
                        onChange={(e) => setYesNA('equipment_condition', item, 'yes', e.target.checked)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={getNA('equipment_condition', item)}
                        onChange={(e) => setYesNA('equipment_condition', item, 'na', e.target.checked)}
                      />
                    </div>
                    {/* Conditional "Other (specify)" shows only if "Other" Yes is clicked */}
                    {isOther && getYes('equipment_condition', item) && (
                      <div className="col-span-3 mt-1">
                        <label className="text-sm font-medium">Other (specify)</label>
                        <input
                          className="mt-1 w-full border rounded px-2 py-1"
                          value={(formData.equipment_condition?.other_text as string) ?? ''}
                          onChange={(e) => setNestedText('equipment_condition', 'other_text', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

      {/* Special Conditions (Header removed) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Special Conditions</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
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
              VOC N/A
            </label>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">Gas</th>
                <th className="border px-2 py-1 text-left">Safe Range</th>
                <th className="border px-2 py-1 text-left">Initial</th>
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

      {/* Instrument Info (condensed rows) */}
      <div
        className={[
          'border rounded',
          monitoringEnabled ? '' : 'opacity-60 pointer-events-none',
        ].join(' ')}
      >
        <div className="bg-kmGray px-3 py-2 font-semibold">Instrument Info</div>
        <div className="p-3 grid md:grid-cols-3 gap-4">
          {/* Row: Make, Model, Serial */}
          <div className="md:col-span-3 grid md:grid-cols-3 gap-4">
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
          </div>

          {/* Row: Bump Tested Before Use & Calibration Current */}
          <div className="md:col-span-3 grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-6">
              <span className="font-medium">Bump Tested Before Use:</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.instrument_info.bump_tested === true}
                  onChange={() => setNestedText('instrument_info', 'bump_tested', true)}
                  disabled={!monitoringEnabled}
                />
                Yes
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.instrument_info.bump_tested === false}
                  onChange={() => setNestedText('instrument_info', 'bump_tested', false)}
                  disabled={!monitoringEnabled}
                />
                No
              </label>
            </div>

            <div className="flex items-center gap-6">
              <span className="font-medium">Calibration Current:</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.instrument_info.calibration_current === true}
                  onChange={() => setNestedText('instrument_info', 'calibration_current', true)}
                  disabled={!monitoringEnabled}
                />
                Yes
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.instrument_info.calibration_current === false}
                  onChange={() => setNestedText('instrument_info', 'calibration_current', false)}
                  disabled={!monitoringEnabled}
                />
                No
              </label>
            </div>
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
``
