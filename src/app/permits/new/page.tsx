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

  // Main form state mirrors your DB columns (JSONB objects are plain JS objects here)
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
    date_issued: '',
    time_issued: '',
    // JSONB sections
    permit_types: {} as JsonMap,               // flat: { [itemLabel]: boolean }
    ppe_requirements: {} as JsonMap,           // optional/general PPE (if you want to add more later)
    additional_ppe: {} as JsonMap,             // nested: { [category]: { [itemLabel]: boolean } }
    hazard_reduction: {} as JsonMap,           // flat: { [itemLabel]: boolean }
    equipment_condition: {} as JsonMap,        // flat: { [itemLabel]: boolean }
    energy_control: {} as JsonMap,             // e.g., { lockout_verified: true, lock_box_number: '123' }
    special_conditions: {} as JsonMap,         // nested groups in one object
    additional_documents: {} as JsonMap,       // flat: { [docLabel]: boolean }
    air_monitoring: {} as JsonMap,             // { [gas]: { reading: string, safeRange: string } }
    instrument_info: {} as JsonMap,            // { make, model, serial, calibration }
    signatures: { issuer: '' } as JsonMap
  });

  // Get current user id for created_by
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  // ---------- Helpers ----------
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
      const current = prev.air_monitoring[gas] ?? {};
      return {
        ...prev,
        air_monitoring: {
          ...prev.air_monitoring,
          [gas]: { ...current, reading, safeRange }
        }
      };
    });
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Build payload for the DB insert (include created_by if we have it)
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

      // Simple print view
      const w = window.open('', '_blank');
      if (!w) return;

      w.document.write(`
        <html>
          <head><title>Permit #${data.permit_number}</title></head>
          <body style="font-family: Arial, Helvetica, sans-serif; padding: 24px;">
            <h1>Safe Work Permit #${data.permit_number}</h1>
            <p><strong>Date Issued:</strong> ${formData.date_issued || '-'}</p>
            <p><strong>Time Issued:</strong> ${formData.time_issued || '-'}</p>
            <p><strong>Facility:</strong> ${formData.facility || '-'}</p>
            <p><strong>Location:</strong> ${formData.location || '-'}</p>
            <p><strong>Contractor:</strong> ${formData.contractor || '-'}</p>
            <p><strong>Description of Work:</strong> ${formData.description_of_work || '-'}</p>
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
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded space-y-8">
      <h2 className="text-2xl font-bold">New Safe Work Permit</h2>

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          name="date_issued"
          type="date"
          value={formData.date_issued}
          onChange={handleText}
          className="border p-2 rounded"
        />
        <input
          name="time_issued"
          type="time"
          value={formData.time_issued}
          onChange={handleText}
          className="border p-2 rounded"
        />
      </div>

      {/* Facility / Location / Contractor / Description */}
      <div className="space-y-3">
        <input
          name="facility"
          placeholder="Facility"
          value={formData.facility}
          onChange={handleText}
          className="w-full border p-2 rounded"
        />
        <input
          name="location"
          placeholder="Location"
          value={formData.location}
          onChange={handleText}
          className="w-full border p-2 rounded"
        />
        <input
          name="contractor"
          placeholder="Contractor"
          value={formData.contractor}
          onChange={handleText}
          className="w-full border p-2 rounded"
        />
        <textarea
          name="description_of_work"
          placeholder="Description of Work"
          value={formData.description_of_work}
          onChange={handleText}
          className="w-full border p-2 rounded"
        />
      </div>

      {/* PERMIT TYPES */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Permit Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(PERMIT_TYPES).map(([category, items]) => (
            <fieldset key={category} className="border rounded p-3">
              <legend className="font-medium">{category.replace(/_/g, ' ')}</legend>
              <div className="mt-2 space-y-2">
                {items.map(item => {
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
                {/* Optional "Other" free text */}
                <input
                  placeholder="Other (specify)"
                  className="mt-2 w-full border p-2 rounded"
                  value={(formData.permit_types?.other_text as string) ?? ''}
                  onChange={(e) =>
                    setNestedText('permit_types', 'other_text', e.target.value)
                  }
                />
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* ADDITIONAL PPE (nested by category) */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Additional PPE</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(ADDITIONAL_PPE).map(([category, items]) => (
            <fieldset key={category} className="border rounded p-3">
              <legend className="font-medium">
                {category.replace(/_/g, ' ')}
              </legend>
              <div className="mt-2 space-y-2">
                {items.map(item => {
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
                  className="mt-2 w-full border p-2 rounded"
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
            </fieldset>
          ))}
        </div>
      </section>

      {/* HAZARD REDUCTION */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Hazard Reduction</h3>
        <div className="space-y-2">
          {HAZARD_REDUCTION_ITEMS.map(item => {
            const checked = !!(formData.hazard_reduction as JsonMap)[item];
            return (
              <label key={item} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSimple('hazard_reduction', item)}
                />
                <span>{item}</span>
              </label>
            );
          })}
          <input
            placeholder="Other (specify)"
            className="mt-2 w-full border p-2 rounded"
            value={(formData.hazard_reduction?.other_text as string) ?? ''}
            onChange={(e) =>
              setNestedText('hazard_reduction', 'other_text', e.target.value)
            }
          />
        </div>
      </section>

      {/* EQUIPMENT CONDITION */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Equipment Condition</h3>
        <div className="space-y-2">
          {EQUIPMENT_CONDITION_ITEMS.map(item => {
            const checked = !!(formData.equipment_condition as JsonMap)[item];
            return (
              <label key={item} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSimple('equipment_condition', item)}
                />
                <span>{item}</span>
              </label>
            );
          })}
          <input
            placeholder="Other (specify)"
            className="mt-2 w-full border p-2 rounded"
            value={(formData.equipment_condition?.other_text as string) ?? ''}
            onChange={(e) =>
              setNestedText('equipment_condition', 'other_text', e.target.value)
            }
          />
        </div>
      </section>

      {/* ENERGY CONTROL */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Energy Control</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!formData.energy_control.lockout_verified}
              onChange={() => toggleSimple('energy_control', 'lockout_verified')}
            />
            <span>Verified lockout/tagout</span>
          </label>
          <input
            placeholder="Lock Box Number"
            className="w-full border p-2 rounded"
            value={formData.energy_control.lock_box_number ?? ''}
            onChange={(e) =>
              setNestedText('energy_control', 'lock_box_number', e.target.value)
            }
          />
        </div>
      </section>

      {/* SPECIAL CONDITIONS */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Special Conditions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <fieldset className="border rounded p-3">
            <legend className="font-medium">Header</legend>
            <div className="mt-2 space-y-2">
              {SPECIAL_CONDITIONS_HEADER.map(item => {
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
          </fieldset>

          <fieldset className="border rounded p-3">
            <legend className="font-medium">Requirements (Left)</legend>
            <div className="mt-2 space-y-2">
              {SPECIAL_CONDITION_REQUIREMENTS_LEFT.map(item => {
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
          </fieldset>

          <fieldset className="border rounded p-3">
            <legend className="font-medium">Requirements (Right)</legend>
            <div className="mt-2 space-y-2">
              {SPECIAL_CONDITION_REQUIREMENTS_RIGHT.map(item => {
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
          </fieldset>
        </div>
        <input
          placeholder="Other special conditions"
          className="mt-3 w-full border p-2 rounded"
          value={(formData.special_conditions?.other_text as string) ?? ''}
          onChange={(e) =>
            setNestedText('special_conditions', 'other_text', e.target.value)
          }
        />
      </section>

      {/* ADDITIONAL DOCUMENTS */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Additional Documents</h3>
        <div className="space-y-2">
          {ADDITIONAL_DOCUMENTS.map(item => {
            const checked = !!(formData.additional_documents as JsonMap)[item];
            return (
              <label key={item} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSimple('additional_documents', item)}
                />
                <span>{item}</span>
              </label>
            );
          })}
          <input
            placeholder="Other (specify)"
            className="mt-2 w-full border p-2 rounded"
            value={(formData.additional_documents?.other_text as string) ?? ''}
            onChange={(e) =>
              setNestedText('additional_documents', 'other_text', e.target.value)
            }
          />
        </div>
      </section>

      {/* AIR MONITORING */}
      <section>
