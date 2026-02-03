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

  // --- Form state mirrors DB columns ---
  const [formData, setFormData] = useState({
    date_issued: '',
    time_issued: '',
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',

    // JSONB fields
    permit_types: {} as JsonMap,         // flat map: { [label]: boolean, other_text?: string }
    ppe_requirements: {} as JsonMap,     // (kept for future if you add general PPE here)
    additional_ppe: {} as JsonMap,       // nested: { [category]: { [label]: boolean, other_text?: string } }
    hazard_reduction: {} as JsonMap,     // flat: { [label]: boolean, other_text?: string }
    equipment_condition: {} as JsonMap,  // flat: { [label]: boolean, other_text?: string }
    energy_control: {} as JsonMap,       // { lockout_verified?: boolean, lock_box_number?: string }
    special_conditions: {} as JsonMap,   // nested: { HEADER: {...}, LEFT: {...}, RIGHT: {...}, other_text?: string }
    additional_documents: {} as JsonMap, // flat: { [label]: boolean, other_text?: string }
    air_monitoring: {} as JsonMap,       // { [gas]: { reading: string, safeRange: string } }
    instrument_info: {} as JsonMap,      // { make, model, serial, calibration }
    signatures: { issuer: '' } as JsonMap,
  });

  // --- Auth / role gate (must be admin or permit_writer) ---
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        window.location.href = '/auth/signin';
        return;
      }
      setUserId(user.id);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || !profile || (profile.role !== 'admin' && profile.role !== 'permit_writer')) {
        alert('Access denied (requires admin or permit_writer).');
        window.history.back();
      }
    })();
  }, []);

  // --- Simple helpers (same interaction pattern, styling matches your inspection page) ---
  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSimple = (section: keyof typeof formData, label: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as JsonMap),
        [label]: !((prev[section] as JsonMap)[label] ?? false),
      },
    }));
  };

  const setSimpleOther = (section: keyof typeof formData, text: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...(prev[section] as JsonMap), other_text: text },
    }));
  };

  const toggleNested = (
    section: keyof typeof formData,
    category: string,
    label: string
  ) => {
    setFormData(prev => {
      const sec = (prev[section] as JsonMap) ?? {};
      const cat = sec[category] ?? {};
      return {
        ...prev,
        [section]: {
          ...sec,
          [category]: {
            ...cat,
            [label]: !(cat[label] ?? false),
          },
        },
      };
    });
  };

  const setNestedOther = (
    section: keyof typeof formData,
    category: string,
    text: string
  ) => {
    setFormData(prev => {
      const sec = (prev[section] as JsonMap) ?? {};
      const cat = sec[category] ?? {};
      return {
        ...prev,
        [section]: {
          ...sec,
          [category]: { ...cat, other_text: text },
        },
      };
    });
  };

  const setAirReading = (gas: string, reading: string, safeRange: string) => {
    setFormData(prev => {
      const cur = prev.air_monitoring[gas] ?? {};
      return {
        ...prev,
        air_monitoring: {
          ...prev.air_monitoring,
          [gas]: { ...cur, reading, safeRange },
        },
      };
    });
  };

  const setNestedField = (section: keyof typeof formData, key: string, val: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...(prev[section] as JsonMap), [key]: val },
    }));
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!userId) return alert('Not signed in');

    setLoading(true);
    const payload: any = {
      ...formData,
      created_by: userId,
      // status left to default 'open' per your schema
    };

    const { data, error } = await supabase
      .from('safe_work_permits')
      .insert([payload])
      .select('permit_number')
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    // Simple printout (consistent with your inspection pattern: a new window with basic info)
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html>
        <head><title>Permit #${data.permit_number}</title></head>
        <body>
          <h1 style="text-align:center">Safe Work Permit #${data.permit_number}</h1>
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
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create New Safe Work Permit</h2>

      {/* Header block */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Header</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          <div>
            <label className="font-medium">Date Issued</label>
            <input
              type="date"
              name="date_issued"
              value={formData.date_issued}
              onChange={handleText}
              className="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="font-medium">Time Issued</label>
            <input
              type="time"
              name="time_issued"
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

      {/* PERMIT TYPES */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Permit Types</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {Object.entries(PERMIT_TYPES).map(([category, items]) => (
            <div key={category} className="border rounded p-2">
              <div className="font-medium mb-2">{category.replace(/_/g, ' ')}</div>
              <div className="space-y-2">
                {items.map((label) => {
                  const checked = !!(formData.permit_types as JsonMap)[label];
                  return (
                    <label key={label} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSimple('permit_types', label)}
                      />
                      {label}
                    </label>
                  );
                })}
                <input
                  placeholder="Other (specify)"
                  className="mt-2 w-full border rounded px-2 py-1"
                  value={(formData.permit_types?.other_text as string) ?? ''}
                  onChange={(e) => setSimpleOther('permit_types', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ADDITIONAL PPE (nested) */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Additional PPE</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {Object.entries(ADDITIONAL_PPE).map(([category, items]) => (
            <div key={category} className="border rounded p-2">
              <div className="font-medium mb-2">{category.replace(/_/g, ' ')}</div>
              <div className="space-y-2">
                {items.map((label) => {
                  const catObj = (formData.additional_ppe as JsonMap)[category] ?? {};
                  const checked = !!catObj[label];
                  return (
                    <label key={label} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNested('additional_ppe', category, label)}
                      />
                      {label}
                    </label>
                  );
                })}
                <input
                  placeholder="Other (specify)"
                  className="mt-2 w-full border rounded px-2 py-1"
                  value={
                    ((formData.additional_ppe as JsonMap)[category]?.other_text as string) ?? ''
                  }
                  onChange={(e) => setNestedOther('additional_ppe', category, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HAZARD REDUCTION */}
      <div className="border rounded">
        <div className="bg-kmGray px-3 py-2 font-semibold">Hazard Reduction</div>
        <div className="p-3 grid md:grid-cols-2 gap-4">
          {HAZARD_REDUCTION_ITEMS.map((label) => {
            const checked = !!(formData.hazard_reduction as JsonMap)[label];
            return (
              <div key={label} className="border p-2 rounded">
                <div className="font-medium mb-2">{label}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSimple('hazard_reduction', label)}
                  />
                  Select
                </label>
              </div>
            );
          })}
          <div className="md:col-span-2">
            <label className="font-medium">Other (specify)</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={(formData.hazard_reduction?.other_text as string) ?? ''}
              onChange={(e) => setSimpleOther('hazard_reduction', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* EQUIPMENT CONDITION */}
      <div className="border rounded">
