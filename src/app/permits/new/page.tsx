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

const TIME_COLUMNS = [
  'Initial',
  '1hr',
  '2hr',
  '3hr',
  '4hr',
  '5hr',
  '6hr',
  '7hr',
  '8hr',
  '9hr',
  '10hr',
  '11hr',
  '12hr',
];

// Use gases exactly from constants (no "Other" row)
const GAS_ROWS = AIR_MONITORING_GASES.map(({ gas }) => gas);

export default function NewPermit() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // UI toggle: VOC N/A disables that row
  const [vocNA, setVocNA] = useState(false);

  // Main state
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
    air_monitoring: {} as JsonMap,      // table: { [gas]: { [timeCol]: string } }
    instrument_info: {} as JsonMap,
    signatures: { issuer: '' } as JsonMap,
  });

  // Auto-generated permit number (e.g., 260001) shown and saved
  const [nextPermitNumber, setNextPermitNumber] = useState<number | null>(null);

  // ---------- Auth gate ----------
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

  // ---------- Initialize Air Monitoring (table) ----------
  useEffect(() => {
    setFormData(prev => {
      if (Object.keys(prev.air_monitoring ?? {}).length > 0) return prev;
      const table: JsonMap = {};
      GAS_ROWS.forEach(gas => {
        table[gas] = {};
        TIME_COLUMNS.forEach(col => (table[gas][col] = ''));
      });
      return { ...prev, air_monitoring: table };
    });
  }, []);

  // ---------- Helpers ----------
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

  const setNestedText = (section: keyof typeof formData, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [key]: value
      }
    }));
  };

  const setAirCell = (gas: string, col: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      air_monitoring: {
        ...prev.air_monitoring,
        [gas]: { ...(prev.air_monitoring?.[gas] ?? {}), [col]: value }
      }
    }));
  };

  // Format helpers
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

  // ---------- Auto "+12 hours" for Expires ----------
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

  // ---------- Determine monitoring enable (Hot Work OR Confined Space) ----------
  const monitoringEnabled = useMemo(() => {
    const anySelected = (keys: string[]) => keys?.some(k => !!formData.permit_types[k]);
    const hotWorkSelected = anySelected(PERMIT_TYPES?.HOT_WORK ?? []);
    const confinedSelected =
      anySelected(PERMIT_TYPES?.CONFINED_SPACE ?? []) ||
      !!formData.permit_types?.PRCS ||
      !!formData.permit_types?.NPRCS;
    return hotWorkSelected || confinedSelected;
  }, [formData.permit_types]);

  // ---------- Compute next permit number within YY0000–YY9999 ----------
  const yearPrefix = useMemo(() => {
    const d = formData.date_issued ? new Date(formData.date_issued) : new Date();
    return String(d.getFullYear() % 100).padStart(2, '0'); // e.g., '26'
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
        setNextPermitNumber(min + 1); // YY0001
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

      {/* Permit Details (condensed) */}
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

      {/* Permit Types: Hot Work + Confined Space on top row; Vehicle Entry removed; DNCS removed */}
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

      {/* Personal Protective Equipment (PPE) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Personal Protective Equipment (PPE)</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {Object.entries(ADDITIONAL_PPE).map(([category, items]) => (
            <div key={category} className="border p-2 rounded">
              <div className="font-medium mb-2">{category.replace(/_/g, ' ')}</div>
              <div className="space-y-2">
                {items.map((item) => {
                  const catObj = (formData.additional_ppe as JsonMap)[category] ?? {};
                  const checked = !!catObj[item];
                  return (
                    <label key={item} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNested('additional_ppe', category, item)}
                      />
                      <span>{item}</span>
                    </label>
                  );
                })}
                <input
                  placeholder="Other (specify)"
                  className="mt-2 w-full border rounded px-2 py-1"
                  value={
                    ((formData.additional_ppe as JsonMap)[category]?.other_text as string) ?? ''
                  }
                  onChange={(e) =>
                    setFormData(prev => {
                      const sec = (prev.additional_ppe as JsonMap) ?? {};
                      const cat = sec[category] ?? {};
                      return {
                        ...prev,
                        additional_ppe: {
                          ...sec,
                          [category]: {
                            ...cat,
                            other_text: e.target.value
                          }
                        }
                      };
                    })
                  }
                />
              </div>
            </div>
          ))}
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

      {/* Energy Control */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Energy Control</div>
        <div className="p-3 grid md:grid-cols-3 gap-4">
          <div className="border p-2 rounded">
            <div className="font-medium mb-2">Verified lockout/tagout</div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.energy_control.lockout_verified}
                onChange={() => toggleSimple('energy_control', 'lockout_verified')}
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

      {/* Air Monitoring: Perform continuous air monitoring, record hourly */}
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
          {/* VOC N/A toggle */}
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
                {TIME_COLUMNS.map((t) => (
                  <th key={t} className="border px-2 py-1 text-left">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GAS_ROWS.map((gas) => {
                const rowDisabled = gas === 'VOC' && vocNA;
                return (
                  <tr key={gas} className={rowDisabled ? 'bg-gray-100' : ''}>
                    <td className="border px-2 py-1 font-medium">{gas}</td>
                    {TIME_COLUMNS.map((col) => (
                      <td key={col} className="border px-1 py-1">
                        <input
                          className="w-full border rounded px-1 py-0.5"
                          value={formData.air_monitoring?.[gas]?.[col] ?? ''}
                          onChange={(e) => setAirCell(gas, col, e.target.value)}
                          disabled={!monitoringEnabled || rowDisabled}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instrument Info (also tied to monitoringEnabled) */}
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
          <div>
            <label className="font-medium">Last Calibration Date</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.calibration ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'calibration', e.target.value)}
              disabled={!monitoringEnabled}
            />
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Signatures</div>
        <div className="p-3">
          <label className="font-medium">Permit Issuer</label>
          <input
            name="issuer"
            placeholder="Permit Issuer"
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
