'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PERMIT_TYPES,
  ADDITIONAL_PPE,
  HAZARD_REDUCTION_ITEMS,
  SPECIAL_CONDITION_REQUIREMENTS_LEFT,
  SPECIAL_CONDITION_REQUIREMENTS_RIGHT,
  AIR_MONITORING_GASES,
} from './permitOptions';

type JsonMap = Record<string, any>;

/* ---------------- Air Monitoring ---------------- */
const INITIAL_TIME_COLS = 5; // default number of "Time:" columns
const GAS_ROWS = AIR_MONITORING_GASES.map(({ gas }) => gas);
// Safe ranges (keys with special characters MUST be quoted)
const SAFE_RANGE: Record<string, string> = {
  LEL: '<10%',
  'O₂': '19.5-23.5%',
  'H₂S': '<10ppm',
  CO: '<35ppm',
  VOC: '—',
};

/* ---------------- Permit Types transforms ---------------- */
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
      if (it === 'Burning/Welding/Cutting') return 'Burning/Brazing/Welding';
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

/* ---------------- PPE rendering transform ---------------- */
type PPECategory = {
  key: string;
  label: string;
  items: string[];
  postInputs?: Array<{
    dependsOn: string[];
    key: string;
    label: string;
    placeholder?: string;
  }>;
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

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

  // Additional respiratory items
  headItems.push(
    'Face Shield',
    'Full Face Respirator*',
    'Powered Air Purifying Respirator (PAPR)',
    'Supplied Air or SCBA',
    '5-Min Escape Pack'
  );

  // HAND adjustments
  const handOrig = additionalPpe.HAND ?? [];
  const handItems = handOrig.map((it) => {
    const low = it.toLowerCase();
    if (low === 'impact gloves') return 'Impact Gloves';
    if (low.startsWith('chemical gloves')) return 'Chemical Gloves';
    return it;
  });

  // BODY from OTHER_PPE with mapping/removals
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
    .filter(
      (it) =>
        ![
          'Material guards',
          'H2S Monitor',
          'Other PPE – Level A',
          'Other PPE – Level B',
          'Other PPE – Level C',
        ].includes(it)
    );

  // OTHER SAFETY EQUIPMENT
  const otherOrig = additionalPpe.OTHER ?? [];
  let otherItems = otherOrig.map((it) => {
    if (it === 'Intentionally Split equip / 12 volt lighting') return 'Intrinsically Safe Equipment';
    if (it === 'GFCI') return 'GFCI Protection';
    if (it === 'Air Mover, In/Out') return 'Forced Air Ventilation';
    return it;
  });

  // Filter out unwanted + normalize
  otherItems = otherItems.filter(
    (it) =>
      ![
        'Descent Device',
        'X Ray barricades',
        'X-Ray barricades',
        'Rail Switch Locks',
        'Blue Flag / Derailer',
        'Other',
        'Other Special PPE',
      ].includes(it)
  );

  // Add requested items (ensure unique)
  otherItems = uniq([
    ...otherItems,
    'Ladder(s)',
    'Tripod/Hoist',
    'First Aid Kit',
    'Portable Lighting',
    'Escape/Rescue Air Cylinder',
    'Barricading Materials',
  ]);

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
      ],
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
        },
      ],
    },
    { key: 'OTHER_PPE', label: 'BODY', items: bodyItems },
    { key: 'OTHER', label: 'OTHER SAFETY EQUIPMENT', items: otherItems },
  ];
}

/* ---------------- Hazard text transforms ---------------- */
function transformHazard(items: string[]): string[] {
  return items.map((it) => {
    if (it.includes('exercise “You Can Stop”') || it.includes('exercise "You Can Stop"')) {
      return 'Everyone understand they can exercise "Stop Work Authority"';
    }
    if (it.includes('Matrix/Assemblies products identified')) {
      return 'Muster Points/ Emergency Exits identified';
    }
    if (it === 'Multi-unit work discussed') return 'Multi-Craft work discussed';
    if (it.startsWith('Area barricaded required'))
      return 'Area barricade required (overhead work, regulated areas, etc.)';
    if (it === 'Grounding bonding required') return 'Grounding/bonding required';
    if (it.startsWith('Radio communication')) return 'Radio communication';
    return it;
  });
}

/* ---------------- Equipment Condition (replaced list) ---------------- */
const EQUIPMENT_CONDITION_NEW = [
  'Equipment In-Service',
  'Equipment depressurized/drained',
  'Equipment cleaned/gas free',
  'Equipment blinded/disconnected/air gapped',
  'Abatement completed (asbestos, lead, ect.)',
  'Fall Protection equipment inspected',
  'Fall Protection Rescue Plan reviewed with employees',
];

/* ---------------- Special Conditions transforms & ordering ---------------- */
function renameSC(item: string): string {
  // Normalize firefighting to one canonical string
  if (
    item === 'Firefighting equipment inspected inspection current' ||
    item === 'Firefighting equipment inspected/ inspection current'
  ) {
    return 'Firefighting equipment inspected/ inspection current';
  }

  // Existing & previous renames
  if (item === 'Fire resistant/blanket or barriers are in place')
    return 'Fire resistant blankets or barriers are in place';
  if (item === 'Fire Watch required (assigned as course)') return 'Fire Watch required and assigned';
  if (item === 'Fire extinguishers required') return 'Fire extinguishers readily accessible';
  if (item === 'Audit for safety watch/spotter required')
    return 'Additional fire/safety watch/spotter required';
  if (item === 'Ventilation as required') return 'Ventilation is adequate';
  if (item === 'Multiple personnel plan or attendant required')
    return 'Multiple confined space attendants required';
  if (item === 'Resource team required on site as a place')
    return 'Rescue team/equipment/plan on site and in place';
  if (item === 'Ensure communication with committee has been documented')
    return 'Communication with entrants has been determined';
  if (item === 'Use of special lifeline required') return 'Use of tripod/lifeline required'; // will be filtered out

  // New renames
  if (item === 'Pre-plan inspection/guards required')
    return 'Wall/floor openings covered or sealed';
  if (item === 'Damage controls/operations required')
    return 'Flammable liquids/vapors/dusts removed or controlled';
  if (
    item ===
    'Flammable/Combustible materials have been removed or protected (within 50’ of hot work area)'
  )
    return 'Combustible materials have been removed or protected (within 50’ of hot work area)';
  if (item === 'Storage drum/valve equipment items verified')
    return 'Area atmosphere tested with gas monitor';

  return item;
}

function buildSpecialConditionsList(left: string[], right: string[]): string[] {
  let combined = [...left, ...right]
    .map(renameSC)
    .filter(
      (it) =>
        it !== 'Vehicle engines turned off (TV Protection)' &&
        it !== 'Stop all work and report unsafe conditions' &&
        it.toLowerCase() !== 'other' &&
        it !== 'Operational activity considered' &&
        it !== 'Use of tripod/lifeline required'
    );

  // unique
  combined = Array.from(new Set(combined));

  const target = 'Firefighting equipment inspected/ inspection current';
  const areaHazards = 'Area has been inspected for obvious hazards';
  const wallFloor = 'Wall/floor openings covered or sealed';
  const flamRemoved = 'Flammable liquids/vapors/dusts removed or controlled';
  const fireWatch = 'Fire Watch required and assigned';

  // Remove the ones we will explicitly insert in order
  combined = combined.filter((x) => ![areaHazards, wallFloor, flamRemoved, fireWatch].includes(x));

  const idx = combined.indexOf(target);
  if (idx >= 0) {
    const before = combined.slice(0, idx + 1);
    const after = combined.slice(idx + 1);
    return [...before, areaHazards, wallFloor, flamRemoved, fireWatch, ...after];
  }

  // If target not found, place the block at the front
  return [
    target,
    areaHazards,
    wallFloor,
    flamRemoved,
    fireWatch,
    ...combined.filter((x) => x !== target),
  ];
}

export default function NewPermit() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // VOC N/A default true (row disabled until unchecked)
  const [vocNA, setVocNA] = useState<boolean>(true);

  // Energy Control N/A default true (section disabled until unchecked)
  const [energyNA, setEnergyNA] = useState<boolean>(true);

  // Number of dynamic "Time:" columns for Air Monitoring
  const [timeColCount, setTimeColCount] = useState<number>(INITIAL_TIME_COLS);

  // Dynamic header time values for "Time:" columns (type="time" next to label)
  const [timeHeaders, setTimeHeaders] = useState<string[]>(
    Array.from({ length: INITIAL_TIME_COLS }, () => '')
  );

  // current date/time defaults
  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultTime = useMemo(() => new Date().toTimeString().slice(0, 5), []);

  // min time for Time Issued (no past time for today)
  const minTimeForDate = (dateStr: string): string => {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today ? new Date().toTimeString().slice(0, 5) : '00:00';
  };

  // Main form state
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
    date_issued: defaultDate,
    time_issued: defaultTime,
    date_expires: '',
    time_expires: '',
    permit_types: {} as JsonMap,        // includes PRCS/NPRCS + hotwork_exact_area/hotwork_other
    ppe_requirements: {} as JsonMap,
    additional_ppe: {} as JsonMap,
    hazard_reduction: {} as JsonMap,     // { item: { yes, na }, other_text?, radio_channel? }
    equipment_condition: {} as JsonMap,  // { item: { yes, na }, other_text? }
    energy_control: {} as JsonMap,       // { zero_energy, personal_locks, lock_box_number }
    special_conditions: {} as JsonMap,   // { item: { yes, na }, comm_type?, fire_watch_after?, fire_watch_length?, other_text? }
    additional_documents: {} as JsonMap,
    // Air Monitoring
    air_monitoring: {} as JsonMap,                // { gas: { 'Initial Reading', t1..tN } }
    air_monitoring_initials: {} as JsonMap,       // { initial: string, t1: string, ... }
    air_monitoring_headers: {} as JsonMap,        // optional carry-over; not required now
    instrument_info: {} as JsonMap,      // { make, model, serial, bump_tested, calibration_current }
    // New: Confined Space sections
    confined_hazard_assessment: {} as JsonMap, // { hazard: boolean, other_text? }
    confined_rescue_plan: {} as JsonMap,       // { non_entry, entry, notes, reviewed, supervisor_initials }
    confined_entrants: {
      time_pairs: 3,
      rows: Array.from({ length: 3 }, () => ({
        name: '',
        times: Array.from({ length: 3 }, () => ({ in: '', out: '' })),
      })),
    } as JsonMap,
    confined_attendants: {
      rows: Array.from({ length: 2 }, () => ({
        name: '',
        times: Array.from({ length: 2 }, () => ({ start: '', stop: '' })),
      })),
    } as JsonMap,
    confined_rescue_team: {
      rows: Array.from({ length: 4 }, () => ({
        name: '',
        times: Array.from({ length: 2 }, () => ({ start: '', stop: '' })),
      })),
    } as JsonMap,

    signatures: { issuer: '', receiver: '', entry_supervisor: '' } as JsonMap,
  });

  // Permit number (YY####)
  const [nextPermitNumber, setNextPermitNumber] = useState<number | null>(null);

  /* ---------- Auth ---------- */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        window.location.href = '/auth/signin';
        return;
      }
      setUserId(uid);

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).single();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'permit_writer')) {
        alert('Access denied. Requires admin or permit writer.');
        window.location.href = '/dashboard';
      }
    })();
  }, []);

  /* ---------- Init Air Monitoring grid ---------- */
  useEffect(() => {
    setFormData((prev) => {
      if (Object.keys(prev.air_monitoring ?? {}).length > 0) return prev;

      // build gas rows with Initial Reading + t1..tN
      const table: JsonMap = {};
      GAS_ROWS.forEach((gas) => {
        table[gas] = { 'Initial Reading': '' };
        for (let i = 1; i <= timeColCount; i++) {
          table[gas][`t${i}`] = '';
        }
      });

      // per-column initials (Initial Reading + t1..tN)
      const initials: JsonMap = { initial: '' };
      for (let i = 1; i <= timeColCount; i++) initials[`t${i}`] = '';

      // optional headers carry-over
      const headers: JsonMap = {};
      for (let i = 1; i <= timeColCount; i++) headers[`t${i}`] = '';

      return {
        ...prev,
        air_monitoring: table,
        air_monitoring_initials: initials,
        air_monitoring_headers: headers,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  /* ---------- Helpers ---------- */
  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateIssued = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => {
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
    setFormData((prev) => {
      const minTime = minTimeForDate(prev.date_issued);
      const coerced = value < minTime ? minTime : value;
      return { ...prev, time_issued: coerced };
    });
  };

  const toggleSimple = (section: keyof typeof formData, key: string) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [key]: !((prev[section] as JsonMap)[key] ?? false),
      },
    }));
  };

  const toggleNested = (section: keyof typeof formData, category: string, key: string) => {
    setFormData((prev) => {
      const sec = (prev[section] as JsonMap) ?? {};
      const cat = (sec[category] as JsonMap) ?? {};
      return {
        ...prev,
        [section]: {
          ...sec,
          [category]: {
            ...cat,
            [key]: !(cat[key] ?? false),
          },
        },
      };
    });
  };

  const setNestedText = (section: keyof typeof formData, key: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [key]: value,
      },
    }));
  };

  const setAirCell = (gas: string, colKey: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      air_monitoring: {
        ...prev.air_monitoring,
        [gas]: { ...(prev.air_monitoring?.[gas] ?? {}), [colKey]: value },
      },
    }));
  };

  const setHeaderLabel = (idx: number, value: string) => {
    // header "Time:" inputs
    setTimeHeaders((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
    // optional: keep a copy in formData as well (not strictly required)
    setFormData((prev) => ({
      ...prev,
      air_monitoring_headers: {
        ...prev.air_monitoring_headers,
        [`t${idx + 1}`]: value,
      },
    }));
  };

  const setInitialsForColumn = (key: 'initial' | `t${number}`, value: string) => {
    setFormData((prev) => ({
      ...prev,
      air_monitoring_initials: {
        ...(prev.air_monitoring_initials ?? {}),
        [key]: value,
      },
    }));
  };

  const addTimeColumn = () => {
    setTimeColCount((prevCount) => {
      const newCount = prevCount + 1;

      // add new time header (time input next to "Time:")
      setTimeHeaders((prev) => [...prev, '']);

      // add new tN keys to each gas row and initials/header maps
      setFormData((prev) => {
        const nextMonitoring = { ...(prev.air_monitoring ?? {}) };
        const nextInitials = { ...(prev.air_monitoring_initials ?? {}) };
        const nextHeaders = { ...(prev.air_monitoring_headers ?? {}) };
        const newKey = `t${newCount}`;
        GAS_ROWS.forEach((gas) => {
          nextMonitoring[gas] = { ...(nextMonitoring[gas] ?? {}), [newKey]: '' };
        });
        nextInitials[newKey] = '';
        nextHeaders[newKey] = '';
        return {
          ...prev,
          air_monitoring: nextMonitoring,
          air_monitoring_initials: nextInitials,
          air_monitoring_headers: nextHeaders,
        };
      });

      return newCount;
    });
  };

  // +12h for Expires
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

  useEffect(() => {
    const { date_issued, time_issued } = formData;
    if (!date_issued || !time_issued) return;

    const start = new Date(`${date_issued}T${time_issued}`);
    if (isNaN(start.getTime())) return;

    const end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
    setFormData((prev) => ({
      ...prev,
      date_expires: fmtDate(end),
      time_expires: fmtTime(end),
    }));
  }, [formData.date_issued, formData.time_issued]);

  /* ---------- Monitoring enabled if HOT WORK OR CONFINED SPACE (incl. PRCS/NPRCS) ---------- */
  const hotWorkItems = useMemo(() => transformHotWork(PERMIT_TYPES?.HOT_WORK ?? []), []);
  const anyHotWorkSelected = hotWorkItems.some((it) => !!formData.permit_types[it]);

  const monitoringEnabled = useMemo(() => {
    const anySelected = (keys: string[]) => keys?.some((k) => !!formData.permit_types[k]);
    const confList = transformConfinedSpace(PERMIT_TYPES?.CONFINED_SPACE ?? []);
    const hotWorkSelected = anySelected(hotWorkItems);
    const confinedSelected =
      anySelected(confList) || !!formData.permit_types?.PRCS || !!formData.permit_types?.NPRCS;
    return hotWorkSelected || confinedSelected;
  }, [formData.permit_types, hotWorkItems]);

  const confinedList = useMemo(
    () => transformConfinedSpace(PERMIT_TYPES?.CONFINED_SPACE ?? []),
    []
  );
  const isPRCS = !!formData.permit_types?.PRCS;

  /* ---------- Permit number YY#### ---------- */
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

  /* ---------- Confined Space helpers (new sections) ---------- */
  const CS_HAZARDS = [
    'Oxygen deficient atmosphere',
    'Oxygen enriched atmosphere',
    'Carbon Monoxide',
    'Flammable/Combustibles',
    'Corrosive Chemicals',
    'Painting or Solvent Fumes',
    'Welding/Burning Fumes',
    'Engulfment',
    'Protruding Objects',
    'Impalement Hazards',
    'Slippery Surfaces',
    'Stored Pressure',
    'Moving Equipment/Machinery',
    'Exposed Electrical Parts',
    'High Temperatures',
    'Fall Hazards',
    'Other',
  ];

  const toggleCSHazard = (hazard: string) => {
    setFormData((prev) => {
      const sec = (prev.confined_hazard_assessment as JsonMap) ?? {};
      return {
        ...prev,
        confined_hazard_assessment: { ...sec, [hazard]: !(sec?.[hazard] ?? false) },
      };
    });
  };

  const addEntrantRow = () => {
    setFormData((prev) => {
      const ent = (prev.confined_entrants as JsonMap) ?? {};
      const timePairs = ent.time_pairs ?? 3;
      const rows = (ent.rows as any[]) ?? [];
      const newRow = {
        name: '',
        times: Array.from({ length: timePairs }, () => ({ in: '', out: '' })),
      };
      return {
        ...prev,
        confined_entrants: { time_pairs: timePairs, rows: [...rows, newRow] },
      };
    });
  };

  const addEntrantTimePair = () => {
    setFormData((prev) => {
      const ent = (prev.confined_entrants as JsonMap) ?? {};
      const timePairs = (ent.time_pairs ?? 3) + 1;
      const rows = ((ent.rows as any[]) ?? []).map((r: any) => ({
        ...r,
        times: [...r.times, { in: '', out: '' }],
      }));
      return {
        ...prev,
        confined_entrants: { time_pairs: timePairs, rows },
      };
    });
  };

  const setEntrantName = (rowIdx: number, value: string) => {
    setFormData((prev) => {
      const ent = (prev.confined_entrants as JsonMap) ?? {};
      const rows = ((ent.rows as any[]) ?? []).map((r: any, i: number) =>
        i === rowIdx ? { ...r, name: value } : r
      );
      return { ...prev, confined_entrants: { ...ent, rows } };
    });
  };

  const setEntrantTime = (
    rowIdx: number,
    pairIdx: number,
    field: 'in' | 'out',
    value: string
  ) => {
    setFormData((prev) => {
      const ent = (prev.confined_entrants as JsonMap) ?? {};
      const rows = ((ent.rows as any[]) ?? []).map((r: any, i: number) => {
        if (i !== rowIdx) return r;
        const times = r.times.map((t: any, j: number) =>
          j === pairIdx ? { ...t, [field]: value } : t
        );
        return { ...r, times };
      });
      return { ...prev, confined_entrants: { ...ent, rows } };
    });
  };

  const setAttendantName = (sectionKey: 'confined_attendants' | 'confined_rescue_team', rowIdx: number, value: string) => {
    setFormData((prev) => {
      const sec = (prev[sectionKey] as JsonMap) ?? {};
      const rows = ((sec.rows as any[]) ?? []).map((r: any, i: number) =>
        i === rowIdx ? { ...r, name: value } : r
      );
      return { ...prev, [sectionKey]: { ...sec, rows } };
    });
  };

  const setAttendantTime = (
    sectionKey: 'confined_attendants' | 'confined_rescue_team',
    rowIdx: number,
    pairIdx: number,
    field: 'start' | 'stop',
    value: string
  ) => {
    setFormData((prev) => {
      const sec = (prev[sectionKey] as JsonMap) ?? {};
      const rows = ((sec.rows as any[]) ?? []).map((r: any, i: number) => {
        if (i !== rowIdx) return r;
        const times = r.times.map((t: any, j: number) =>
          j === pairIdx ? { ...t, [field]: value } : t
        );
        return { ...r, times };
      });
      return { ...prev, [sectionKey]: { ...sec, rows } };
    });
  };

  /* ---------- Submit (back-dating guard + CS rule) ---------- */
  const handleSubmit = async () => {
    try {
      if (!userId) return alert('Not signed in');

      // Guard: issued cannot be in the past
      const issued = new Date(`${formData.date_issued}T${formData.time_issued}`);
      const nowLocal = new Date();
      if (isNaN(issued.getTime()) || issued.getTime() < nowLocal.getTime()) {
        alert('Date/Time Issued cannot be in the past.');
        return;
      }

      // Confined Space rule: if any "Entry into ..." is selected, either PRCS or NPRCS must be selected
      const anyEntryIntoSelected = confinedList.some(
        (item) => item.toLowerCase().startsWith('entry into') && !!formData.permit_types[item]
      );
      const hasPRCSorNPRCS = !!formData.permit_types?.PRCS || !!formData.permit_types?.NPRCS;
      if (anyEntryIntoSelected && !hasPRCSorNPRCS) {
        alert('*Please select either PRCS or NPRCS');
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

  /* ---------- PPE, Hazard & SC helpers ---------- */
  const PPE_RENDER = useMemo(() => buildPPERender(ADDITIONAL_PPE), []);
  const HAZ_LIST = useMemo(() => transformHazard(HAZARD_REDUCTION_ITEMS), []);
  const SPECIAL_LIST = useMemo(
    () =>
      buildSpecialConditionsList(
        SPECIAL_CONDITION_REQUIREMENTS_LEFT,
        SPECIAL_CONDITION_REQUIREMENTS_RIGHT
      ),
    []
  );

  // Compute the "red range" once: items 1-11 (inclusive) by label anchors
  const { scRedStartIdx, scRedEndIdx } = useMemo(() => {
    const start = SPECIAL_LIST.indexOf('100% spark containment required');
    const end = SPECIAL_LIST.indexOf('No unusual odors/vapors present');
    return { scRedStartIdx: start, scRedEndIdx: end };
  }, [SPECIAL_LIST]);

  // Combined hazard/equipment Yes/NA togglers
  const setYesNA = (
    section: 'hazard_reduction' | 'equipment_condition',
    item: string,
    field: 'yes' | 'na',
    value: boolean
  ) => {
    setFormData((prev) => {
      const sec = (prev[section] as JsonMap) ?? {};
      const cur = (sec[item] as JsonMap) ?? { yes: false, na: false };
      const next = { ...cur, [field]: value };
      if (field === 'yes' && value) next.na = false;
      if (field === 'na' && value) next.yes = false;
      return { ...prev, [section]: { ...sec, [item]: next } };
    });
  };
  const getYes = (section: 'hazard_reduction' | 'equipment_condition', item: string) =>
    !!formData[section]?.[item]?.yes;
  const getNA = (section: 'hazard_reduction' | 'equipment_condition', item: string) =>
    !!formData[section]?.[item]?.na;

  // Special conditions Yes/NA togglers
  const setSCYesNA = (item: string, field: 'yes' | 'na', value: boolean) => {
    setFormData((prev) => {
      const sc = (prev.special_conditions as JsonMap) ?? {};
      const cur = (sc[item] as JsonMap) ?? { yes: false, na: false };
      const next = { ...cur, [field]: value };
      if (field === 'yes' && value) next.na = false;
      if (field === 'na' && value) next.yes = false;
      return { ...prev, special_conditions: { ...sc, [item]: next } };
    });
  };
  const getSCYes = (item: string) => !!formData.special_conditions?.[item]?.yes;
  const getSCNA = (item: string) => !!formData.special_conditions?.[item]?.na;

  // Time min updates as date changes
  const minTime = minTimeForDate(formData.date_issued);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create New Safe Work Permit</h2>

      {/* Permit Number */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Number</div>
        <div className="p-3">
          <div className="text-2xl font-bold">{nextPermitNumber ?? `${yearPrefix}0001`}</div>
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

      {/* Permit Types */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Types</div>

        {/* HOT WORK & CONFINED SPACE side-by-side */}
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {/* HOT WORK */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2 text-red-600">HOT WORK</div>
            <div className="space-y-2">
              {hotWorkItems.map((item) => {
                const checked = !!(formData.permit_types as JsonMap)[item];
                const redItems = new Set(['Burning/Brazing/Welding', 'Grinding/Cutting', 'Use of torch']);
                return (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSimple('permit_types', item)}
                    />
                    <span className={redItems.has(item) ? 'text-red-600 font-semibold' : ''}>{item}</span>
                  </label>
                );
              })}
              {/* Exact area of Hot Work */}
              {anyHotWorkSelected && (
                <div className="mt-2">
                  <label className="font-medium">Exact area of Hot Work</label>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1"
                    value={(formData.permit_types?.hotwork_exact_area as string) ?? ''}
                    onChange={(e) => setNestedText('permit_types', 'hotwork_exact_area', e.target.value)}
                  />
                </div>
              )}
              {/* Other (specify) in red */}
              <div className="mt-2">
                <label className="text-red-600 font-semibold">Other (specify)</label>
                <input
                  className="mt-1 w-full border rounded px-2 py-1"
                  value={(formData.permit_types?.hotwork_other as string) ?? ''}
                  onChange={(e) => setNestedText('permit_types', 'hotwork_other', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CONFINED SPACE (PRCS/NPRCS mutually exclusive) */}
          <div className="border p-2 rounded">
            <div className="font-medium mb-2 flex items-center gap-4">
              <span>CONFINED SPACE</span>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.permit_types.PRCS}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      permit_types: {
                        ...(prev.permit_types ?? {}),
                        PRCS: !prev.permit_types?.PRCS,
                        NPRCS: false,
                      },
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
                    setFormData((prev) => ({
                      ...prev,
                      permit_types: {
                        ...(prev.permit_types ?? {}),
                        NPRCS: !prev.permit_types?.NPRCS,
                        PRCS: false,
                      },
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

        {/* Remaining categories (GENERAL WORK replaced; exclude vehicle/prcs etc.) */}
        <div className="px-3 pb-3 grid md:grid-cols-2 gap-4">
          {/* GENERAL WORK */}
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
            .filter(
              ([key]) =>
                !['VEHICLE_ENTRY', 'PRCS', 'NPRCS', 'DNCS', 'HOT_WORK', 'CONFINED_SPACE', 'GENERAL_WORK'].includes(
                  key
                )
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
                    onChange={(e) => setNestedText('permit_types', `${category}_other`, e.target.value)}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* PRCS-only: Confined Space Hazard Assessment */}
      {isPRCS && (
        <div className="border rounded">
          <div className="bg-kmGray px-3 py-2 font-semibold">Confined Space Hazard Assessment</div>
          <div className="p-3 space-y-3">
            <div className="text-xs text-gray-700">
              check all that apply to the space or may be introduced by work
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {CS_HAZARDS.map((hz) => {
                const isOther = hz === 'Other';
                const checked = !!(formData.confined_hazard_assessment?.[hz]);
                return (
                  <div key={hz} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCSHazard(hz)}
                    />
                    <span>{hz}</span>
                    {isOther && checked && (
                      <input
                        className="ml-2 border rounded px-2 py-1 flex-1"
                        placeholder="Specify other hazard"
                        value={formData.confined_hazard_assessment?.other_text ?? ''}
                        onChange={(e) =>
                          setNestedText('confined_hazard_assessment', 'other_text', e.target.value)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PPE */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">
          Personal Protective Equipment (Minimum PPE Requirements: Hard Hat, Safety Glasses, Gloves,
          Safety Toe Footwear, and Reflective Vest)
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
                            setFormData((prev) => {
                              const sec = (prev.additional_ppe as JsonMap) ?? {};
                              const origCat = sec[key] ?? {};
                              return {
                                ...prev,
                                additional_ppe: {
                                  ...sec,
                                  [key]: { ...origCat, [pi.key]: val },
                                },
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

      {/* Hazard Reduction & Equipment Condition */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Hazard Reduction &amp; Equipment Condition</div>
        <div className="p-3 grid md:grid-cols-2 gap-6">
          {/* Hazard Reduction side */}
          <div>
            <div className="grid grid-cols-[1fr,60px,60px] gap-2 items-center font-medium mb-2">
              <div>Hazard Reduction</div>
              <div className="text-center">Yes</div>
              <div className="text-center">N/A</div>
            </div>
            <div className="space-y-1">
              {HAZ_LIST.map((item) => {
                const isOther = item.toLowerCase().startsWith('other');
                const isRadio = item === 'Radio communication';
                return (
                  <div
                    key={item}
                    className="grid grid-cols-[1fr,60px,60px] gap-2 items-center border rounded px-2 py-1"
                  >
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

                    {isRadio && getYes('hazard_reduction', item) && (
                      <div className="col-span-3 mt-1">
                        <label className="text-sm font-medium">Radio Channel #</label>
                        <input
                          className="mt-1 w-40 border rounded px-2 py-1"
                          value={(formData.hazard_reduction?.radio_channel as string) ?? ''}
                          onChange={(e) => setNestedText('hazard_reduction', 'radio_channel', e.target.value)}
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
              {EQUIPMENT_CONDITION_NEW.map((item) => {
                const isOther = item.toLowerCase().startsWith('other');
                return (
                  <div
                    key={item}
                    className="grid grid-cols-[1fr,60px,60px] gap-2 items-center border rounded px-2 py-1"
                  >
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

      {/* Energy Control (N/A default) */}
      <div className={['border rounded', energyNA ? 'opacity-60 pointer-events-none' : ''].join(' ')}>
        <div className="bg-kmGray px-3 py-2 font-semibold flex items-center justify-between">
          <span>Energy Control</span>
          <label className="text-sm flex items-center gap-2 pr-2 pointer-events-auto">
            <input type="checkbox" checked={energyNA} onChange={() => setEnergyNA((v) => !v)} />
            N/A
          </label>
        </div>
        <div className="p-3 grid md:grid-cols-3 gap-4 items-center">
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Verified Zero-Energy State</div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.energy_control.zero_energy}
                onChange={() =>
                  setNestedText('energy_control', 'zero_energy', !formData.energy_control?.zero_energy)
                }
                disabled={energyNA}
              />
              <span>Yes</span>
            </label>
          </div>

          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Personal Locks Hung</div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.energy_control.personal_locks}
                onChange={() =>
                  setNestedText(
                    'energy_control',
                    'personal_locks',
                    !formData.energy_control?.personal_locks
                  )
                }
                disabled={energyNA}
              />
              <span>Yes</span>
            </label>
          </div>

          <div className="border p-2 rounded">
            <label className="font-medium">Lock Box Number</label>
            <input
              className="mt-1 w-40 border rounded px-2 py-1"
              value={formData.energy_control.lock_box_number ?? ''}
              onChange={(e) => setNestedText('energy_control', 'lock_box_number', e.target.value)}
              disabled={energyNA}
            />
          </div>
        </div>
      </div>

      {/* Special Conditions */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Special Conditions</div>
        <div className="p-3">
          <div className="grid grid-cols-[1fr,60px,60px] gap-2 items-center font-medium mb-2">
            <div>Item</div>
            <div className="text-center">Yes</div>
            <div className="text-center">N/A</div>
          </div>

          <div className="space-y-1">
            {SPECIAL_LIST.map((item, idx) => {
              const isComm = item === 'Communication with entrants has been determined';
              const isFireWatch = item === 'Fire Watch required and assigned';
              const yes = getSCYes(item);
              const na = getSCNA(item);

              const isRed =
                scRedStartIdx >= 0 && scRedEndIdx >= 0 && idx >= scRedStartIdx && idx <= scRedEndIdx;

              return (
                <div key={item} className="border rounded px-2 py-1">
                  <div className="grid grid-cols-[1fr,60px,60px] gap-2 items-center">
                    <div className={`text-sm flex items-center gap-2 flex-wrap ${isRed ? 'text-red-600' : ''}`}>
                      <span>{item}</span>
                      {isComm && yes && (
                        <span className="flex items-center gap-1">
                          <span>Comm. Type:</span>
                          <input
                            className="w-40 border rounded px-2 py-0.5"
                            value={(formData.special_conditions?.comm_type as string) ?? ''}
                            onChange={(e) => setNestedText('special_conditions', 'comm_type', e.target.value)}
                          />
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={yes}
                        onChange={(e) => setSCYesNA(item, 'yes', e.target.checked)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={na}
                        onChange={(e) => setSCYesNA(item, 'na', e.target.checked)}
                      />
                    </div>
                  </div>

                  {isFireWatch && yes && (
                    <div className="mt-2 grid md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">
                          Fire watch duration after hot work completed:
                        </span>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={formData.special_conditions.fire_watch_after === '30'}
                            onChange={() => setNestedText('special_conditions', 'fire_watch_after', '30')}
                          />
                          30 min
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={formData.special_conditions.fire_watch_after === '>30'}
                            onChange={() => setNestedText('special_conditions', 'fire_watch_after', '>30')}
                          />
                          {'>'}30 min
                        </label>
                      </div>

                      {formData.special_conditions.fire_watch_after === '>30' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Length of time:</span>
                          <input
                            className="w-24 border rounded px-2 py-0.5"
                            value={(formData.special_conditions.fire_watch_length as string) ?? ''}
                            onChange={(e) =>
                              setNestedText('special_conditions', 'fire_watch_length', e.target.value)
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <label className="font-medium">Other special conditions</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={(formData.special_conditions?.other_text as string) ?? ''}
              onChange={(e) => setNestedText('special_conditions', 'other_text', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* PRCS-only: Confined Space Rescue Plan */}
      {isPRCS && (
        <div className="border rounded">
          <div className="bg-kmGray px-3 py-2 font-semibold">Confined Space Rescue Plan</div>
          <div className="p-3 space-y-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.confined_rescue_plan?.non_entry}
                  onChange={() =>
                    setNestedText(
                      'confined_rescue_plan',
                      'non_entry',
                      !(formData.confined_rescue_plan?.non_entry ?? false)
                    )
                  }
                />
                Non-Entry Rescue Plan
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.confined_rescue_plan?.entry}
                  onChange={() =>
                    setNestedText(
                      'confined_rescue_plan',
                      'entry',
                      !(formData.confined_rescue_plan?.entry ?? false)
                    )
                  }
                />
                Entry Rescue Plan
              </label>
            </div>

            <div>
              <label className="font-medium">Rescue Plan Details</label>
              <textarea
                rows={4}
                className="mt-1 w-full border rounded px-2 py-1"
                value={formData.confined_rescue_plan?.notes ?? ''}
                onChange={(e) => setNestedText('confined_rescue_plan', 'notes', e.target.value)}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4 items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.confined_rescue_plan?.reviewed}
                  onChange={() =>
                    setNestedText(
                      'confined_rescue_plan',
                      'reviewed',
                      !(formData.confined_rescue_plan?.reviewed ?? false)
                    )
                  }
                />
                Authorizing Entry Supervisor has developed or reviewed the rescue plan
              </label>

              <div>
                <label className="font-medium">Entry Supervisor Initials</label>
                <input
                  className="mt-1 w-40 border rounded px-2 py-1"
                  value={formData.confined_rescue_plan?.supervisor_initials ?? ''}
                  onChange={(e) =>
                    setNestedText('confined_rescue_plan', 'supervisor_initials', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRCS-only: Confined Space Authorized Entrant(s) Log — INTERLEAVED */}
      {isPRCS && (
        <div className="border rounded">
          <div className="bg-kmGray px-3 py-2 font-semibold">Confined Space Authorized Entrant(s) Log</div>
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
                onClick={addEntrantRow}
              >
                Add a name
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
                onClick={addEntrantTimePair}
              >
                Add Time In/Out
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left min-w-[220px] w-64 whitespace-nowrap">
                      Name
                    </th>
                    {/* Interleaved headers: In1, Out1, In2, Out2, ... */}
                    {Array.from({ length: formData.confined_entrants?.time_pairs ?? 3 }).flatMap((_, i) => [
                      <th key={`h-in-${i}`} className="border px-2 py-1 text-left">Time In</th>,
                      <th key={`h-out-${i}`} className="border px-2 py-1 text-left">Time Out</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {(formData.confined_entrants?.rows ?? []).map((row: any, rIdx: number) => (
                    <tr key={`row-${rIdx}`}>
                      <td className="border px-2 py-1 min-w-[220px] w-64 whitespace-nowrap">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={row.name}
                          onChange={(e) => setEntrantName(rIdx, e.target.value)}
                        />
                      </td>
                      {/* Interleaved cells: In1, Out1, In2, Out2, ... */}
                      {row.times.flatMap((t: any, pIdx: number) => [
                        <td key={`in-${rIdx}-${pIdx}`} className="border px-2 py-1">
                          <input
                            type="time"
                            className="w-full border rounded px-2 py-1"
                            value={t.in}
                            onChange={(e) => setEntrantTime(rIdx, pIdx, 'in', e.target.value)}
                          />
                        </td>,
                        <td key={`out-${rIdx}-${pIdx}`} className="border px-2 py-1">
                          <input
                            type="time"
                            className="w-full border rounded px-2 py-1"
                            value={t.out}
                            onChange={(e) => setEntrantTime(rIdx, pIdx, 'out', e.target.value)}
                          />
                        </td>,
                      ])}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* PRCS-only: Confined Space Authorized Attendant(s) */}
      {isPRCS && (
        <div className="border rounded">
          <div className="bg-kmGray px-3 py-2 font-semibold">Confined Space Authorized Attendant(s)</div>
          <div className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Name</th>
                    <th className="border px-2 py-1 text-left">Start Time</th>
                    <th className="border px-2 py-1 text-left">Stop Time</th>
                    <th className="border px-2 py-1 text-left">Start Time</th>
                    <th className="border px-2 py-1 text-left">Stop Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.confined_attendants?.rows ?? []).map((row: any, rIdx: number) => (
                    <tr key={`att-${rIdx}`}>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={row.name}
                          onChange={(e) => setAttendantName('confined_attendants', rIdx, e.target.value)}
                        />
                      </td>
                      {row.times.map((t: any, pIdx: number) => (
                        <td key={`att-${rIdx}-${pIdx}-start`} className="border px-2 py-1">
                          <input
                            type="time"
                            className="w-full border rounded px-2 py-1"
                            value={t.start}
                            onChange={(e) =>
                              setAttendantTime('confined_attendants', rIdx, pIdx, 'start', e.target.value)
                            }
                          />
                        </td>
                      ))}
                      {row.times.map((t: any, pIdx: number) => (
                        <td key={`att-${rIdx}-${pIdx}-stop`} className="border px-2 py-1">
                          <input
                            type="time"
                            className="w-full border rounded px-2 py-1"
                            value={t.stop}
                            onChange={(e) =>
                              setAttendantTime('confined_attendants', rIdx, pIdx, 'stop', e.target.value)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRCS-only: Confined Space Rescue Team */}
      {isPRCS && (
        <div className="border rounded">
          <div className="bg-kmGray px-3 py-2 font-semibold">Confined Space Rescue Team</div>
          <div className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Name</th>
                    <th className="border px-2 py-1 text-left">Start Time</th>
                    <th className="border px-2 py-1 text-left">Stop Time</th>
                    <th className="border px-2 py-1 text-left">Start Time</th>
                    <th className="border px-2 py-1 text-left">Stop Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.confined_rescue_team?.rows ?? []).map((row: any, rIdx: number) => (
                    <tr key={`team-${rIdx}`}>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={row.name}
                          onChange={(e) => setAttendantName('confined_rescue_team', rIdx, e.target.value)}
                        />
                      </td>
                      {row.times.map((t: any, pIdx: number) => (
                        <td key={`team-${rIdx}-${pIdx}-start`} className="border px-2 py-1">
                          <input
                            type="time"
                            className="w-full border rounded px-2 py-1"
                            value={t.start}
                            onChange={(e) =>
                              setAttendantTime('confined_rescue_team', rIdx, pIdx, 'start', e.target.value)
                            }
                          />
                        </td>
                      ))}
                      {row.times.map((t: any, pIdx: number) => (
                        <td key={`team-${rIdx}-${pIdx}-stop`} className="border px-2 py-1">
                          <input
                            type="time"
                            className="w-full border rounded px-2 py-1"
                            value={t.stop}
                            onChange={(e) =>
                              setAttendantTime('confined_rescue_team', rIdx, pIdx, 'stop', e.target.value)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Air Monitoring (Perform continuous air monitoring, record hourly) */}
      <div
        className={['border rounded', monitoringEnabled ? '' : 'opacity-60 pointer-events-none'].join(' ')}
      >
        <div className="bg-kmGray px-3 py-2 font-semibold flex items-center justify-between">
          <span>Air Monitoring (Perform continuous air monitoring, record hourly)</span>
          <div className="flex items-center gap-3">
            {/* VOC N/A */}
            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={vocNA}
                onChange={() => setVocNA((v) => !v)}
                disabled={!monitoringEnabled}
              />
              VOC N/A
            </label>

            {/* Add Time Column */}
            <button
              type="button"
              className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
              onClick={addTimeColumn}
              disabled={!monitoringEnabled}
            >
              Add Time Column
            </button>
          </div>
        </div>

        <div className="p-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Top header: initials row (merged over Gas+Safe Range), plus initials inputs over remaining columns */}
              <tr>
                <th className="border px-2 py-1 text-left" colSpan={2}>
                  Initials of tester
                </th>
                {/* Initial Reading column initials */}
                <th className="border px-2 py-1 text-left">
                  <input
                    className="w-24 border rounded px-1 py-0.5"
                    value={formData.air_monitoring_initials?.initial ?? ''}
                    onChange={(e) => setInitialsForColumn('initial', e.target.value)}
                    disabled={!monitoringEnabled}
                    placeholder="Initials"
                  />
                </th>
                {/* initials over each Time column */}
                {Array.from({ length: timeColCount }).map((_, idx) => (
                  <th key={`h-top-${idx}`} className="border px-2 py-1 text-left">
                    <input
                      className="w-24 border rounded px-1 py-0.5"
                      value={formData.air_monitoring_initials?.[`t${idx + 1}`] ?? ''}
                      onChange={(e) => setInitialsForColumn(`t${idx + 1}` as any, e.target.value)}
                      disabled={!monitoringEnabled}
                      placeholder="Initials"
                    />
                  </th>
                ))}
              </tr>

              {/* Labels row: Gas | Safe Range | Initial Reading | Time: + time input per column */}
              <tr>
                <th className="border px-2 py-1 text-left">Gas</th>
                <th className="border px-2 py-1 text-left">Safe Range</th>
                <th className="border px-2 py-1 text-left">Initial Reading</th>
                {Array.from({ length: timeColCount }).map((_, idx) => (
                  <th key={`h-${idx}`} className="border px-2 py-1 text-left">
                    <div className="flex items-center gap-2">
                      <span>Time:</span>
                      <input
                        type="time"
                        className="w-28 border rounded px-1 py-0.5"
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
                    {/* Initial Reading */}
                    <td className="border px-1 py-1">
                      <input
                        className="w-full border rounded px-1 py-0.5"
                        value={formData.air_monitoring?.[gas]?.['Initial Reading'] ?? ''}
                        onChange={(e) => setAirCell(gas, 'Initial Reading', e.target.value)}
                        disabled={!monitoringEnabled || rowDisabled}
                      />
                    </td>
                    {/* Dynamic Time columns (t1..tN) readings */}
                    {Array.from({ length: timeColCount }).map((_, idx) => {
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

      {/* Instrument Info (condensed) */}
      <div
        className={['border rounded', monitoringEnabled ? '' : 'opacity-60 pointer-events-none'].join(' ')}
      >
        <div className="bg-kmGray px-3 py-2 font-semibold">Instrument Info</div>
        <div className="p-3 grid md:grid-cols-3 gap-4">
          {/* Make, Model, Serial */}
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

          {/* Bump Tested + Calibration Current */}
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
                setFormData((prev) => ({
                  ...prev,
                  signatures: { ...(prev.signatures ?? {}), issuer: e.target.value },
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
                setFormData((prev) => ({
                  ...prev,
                  signatures: { ...(prev.signatures ?? {}), receiver: e.target.value },
                }))
              }
            />
          </div>

          {/* PRCS-only signature field */}
          {isPRCS && (
            <div className="md:col-span-2">
              <label className="font-medium">Confined Space Authorized Entry Supervisor</label>
              <input
                className="mt-1 w-full border rounded px-2 py-1"
                value={formData.signatures.entry_supervisor ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    signatures: { ...(prev.signatures ?? {}), entry_supervisor: e.target.value },
                  }))
                }
              />
            </div>
          )}
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
        <button onClick={() => window.history.back()} className="bg-kmRed text-white px-4 py-2 rounded">
          Cancel
        </button>
      </div>
    </div>
  );
}
``
