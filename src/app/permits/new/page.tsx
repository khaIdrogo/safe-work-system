'use client';

import { useEffect, useState } from 'react';
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

export default function NewPermit() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Main form state (JSONB sections are plain objects here)
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
    date_issued: '',
    time_issued: '',
    permit_types: {} as JsonMap,
    ppe_requirements: {} as JsonMap,
    additional_ppe: {} as JsonMap,
    hazard_reduction: {} as JsonMap,
    equipment_condition: {} as JsonMap,
    energy_control: {} as JsonMap,
    special_conditions: {} as JsonMap,
    additional_documents: {} as JsonMap,
    air_monitoring: {} as JsonMap,
    instrument_info: {} as JsonMap,
    signatures: { issuer: '' } as JsonMap
  });

  // Require signed-in user with role admin or permit_writer
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        window.location.href = '/auth/signin';
        return;
      }
      setUserId(uid);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (error || !profile || (profile.role !== 'admin' && profile.role !== 'permit_writer')) {
        alert('Access denied. Requires admin or permit writer.');
        window.location.href = '/dashboard';
      }
    })();
  }, []);

  // ---------- helpers ----------
  const handleText = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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

  const setNestedText = (
    section: keyof typeof formData,
    key: string,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [key]: value
      }
    }));
  };

  const setAirReading = (gas: string, reading: string, safeRange: string) => {
    setFormData(prev => {
      const current = prev.air_monitoring?.[gas] ?? {};
      return {
        ...prev,
        air_monitoring: {
          ...prev.air_monitoring,
          [gas]: { ...current, reading, safeRange }
        }
      };
    });
  };

  // ---------- submit ----------
  const handleSubmit = async () => {
    try {
      setLoading(true);

      const payload: any = {
        ...formData,
        created_by: userId ?? null
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
            <h1>Safe Work Permit #${data.permit_number}</h1>
            <table border="1" cellspacing="0" cellpadding="6" width="100%">
              <tr><th>Date Issued</th><td>${formData.date_issued || '-'}</td><th>Time Issued</th><td>${formData.time_issued || '-'}</td></tr>
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

  // ---------- UI (styled like your New Inspection page) ----------
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create New Safe Work Permit</h2>

      {/* Header block */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Details</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
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

          <div className="md:col-span-2">
            <label className="font-medium">Contractor</label>
            <input
              name="contractor"
              value={formData.contractor}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>

          <div className="md:col-span-2">
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
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {Object.entries(PERMIT_TYPES).map(([category, items]) => (
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
                  value={(formData.permit_types?.other_text as string) ?? ''}
                  onChange={(e) => setNestedText('permit_types', 'other_text', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional PPE */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Additional PPE</div>
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
        <div className="p-3 grid md:grid-cols-2 gap-4">
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
          <div className="border p-2 rounded">
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
            onChange={(e) =>
              setNestedText('special_conditions', 'other_text', e.target.value)
            }
          />
        </div>
      </div>

      {/* Additional Documents */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Additional Documents</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {ADDITIONAL_DOCUMENTS.map((item) => {
            const checked = !!(formData.additional_documents as JsonMap)[item];
            return (
              <div key={item} className="border p-2 rounded">
                <div className="font-medium mb-2">{item}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSimple('additional_documents', item)}
                  />
                  <span>Included</span>
                </label>
              </div>
            );
          })}
          <div className="md:col-span-2">
            <label className="font-medium">Other (specify)</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={(formData.additional_documents?.other_text as string) ?? ''}
              onChange={(e) =>
                setNestedText('additional_documents', 'other_text', e.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* Air Monitoring */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Air Monitoring</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {AIR_MONITORING_GASES.map(({ gas, safeRange }) => {
            const reading = formData.air_monitoring?.[gas]?.reading ?? '';
            return (
              <div key={gas} className="border p-2 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{gas}</span>
                  <span className="text-sm text-gray-600">Safe: {safeRange}</span>
                </div>
                <input
                  placeholder={`Reading for ${gas}`}
                  className="mt-2 w-full border rounded px-2 py-1"
                  value={reading}
                  onChange={(e) => setAirReading(gas, e.target.value, safeRange)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Instrument Info */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Instrument Info</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          <div>
            <label className="font-medium">Make</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.make ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'make', e.target.value)}
            />
          </div>
          <div>
            <label className="font-medium">Model</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.model ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'model', e.target.value)}
            />
          </div>
          <div>
            <label className="font-medium">Serial</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.serial ?? ''}
              onChange={(e) => setNestedText('instrument_info', 'serial', e.target.value)}
            />
          </div>
          <div>
            <label className="font-medium">Last Calibration Date</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={formData.instrument_info.calibration ?? ''}
              onChange={(e) =>
                setNestedText('instrument_info', 'calibration', e.target.value)
              }
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
