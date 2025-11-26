
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NewPermit() {
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
    date_issued: '',
    time_issued: '',
    permit_types: {},
    ppe_requirements: {},
    additional_ppe: {},
    hazard_reduction: {},
    equipment_condition: {},
    energy_control: {},
    special_conditions: {},
    additional_documents: {},
    air_monitoring: {},
    instrument_info: {},
    signatures: { issuer: '' }
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = (section: string, key: string) => {
    setFormData({
      ...formData,
      [section]: { ...formData[section], [key]: !formData[section][key] }
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('safe_work_permits')
      .insert([formData])
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
        <body style="font-family: Arial; padding: 20px;">
          <h1>Safe Work Permit #${data.permit_number}</h1>
          <p><strong>Facility:</strong> ${formData.facility}</p>
          <p><strong>Location:</strong> ${formData.location}</p>
          <p><strong>Contractor:</strong> ${formData.contractor}</p>
          <p><strong>Description of Work:</strong> ${formData.description_of_work}</p>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded space-y-6">
      <h2 className="text-2xl font-bold">New Safe Work Permit</h2>

      {/* Header Section */}
      <div className="grid grid-cols-2 gap-4">
        <input name="date_issued" type="date" value={formData.date_issued} onChange={handleChange} className="border p-2 rounded" />
        <input name="time_issued" type="time" value={formData.time_issued} onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Facility & Location */}
      <input name="facility" placeholder="Facility" value={formData.facility} onChange={handleChange} className="w-full border p-2 rounded" />
      <input name="location" placeholder="Location" value={formData.location} onChange={handleChange} className="w-full border p-2 rounded" />
      <input name="contractor" placeholder="Contractor" value={formData.contractor} onChange={handleChange} className="w-full border p-2 rounded" />
      <textarea name="description_of_work" placeholder="Description of Work" value={formData.description_of_work} onChange={handleChange} className="w-full border p-2 rounded" />

      {/* Permit Types */}
      <h3 className="text-lg font-semibold">Permit Types</h3>
      <div className="space-y-2">
        <label><input type="checkbox" onChange={() => handleCheckboxChange('permit_types','burning_welding')} /> Burning/Welding/Cutting</label>
        <label><input type="checkbox" onChange={() => handleCheckboxChange('permit_types','drilling_grinding')} /> Drilling/Chipping/Grinding</label>
        <label><input type="checkbox" onChange={() => handleCheckboxChange('permit_types','hot_tap')} /> Hot Tap Activities</label>
        <label><input type="checkbox" onChange={() => handleCheckboxChange('permit_types','electrical_arc')} /> Electrical Work (Arc/Spark)</label>
        <input name="permit_types_other" placeholder="Other" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* PPE Requirements */}
      <h3 className="text-lg font-semibold">PPE Requirements</h3>
      <div className="space-y-2">
        <label><input type="checkbox" onChange={() => handleCheckboxChange('ppe_requirements','welding_gloves')} /> Welding Gloves</label>
        <label><input type="checkbox" onChange={() => handleCheckboxChange('ppe_requirements','chemical_gloves')} /> Chemical Gloves</label>
        <label><input type="checkbox" onChange={() => handleCheckboxChange('ppe_requirements','full_face')} /> Full Face Protection</label>
        <input name="ppe_other" placeholder="Other PPE" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Hazard Reduction */}
      <h3 className="text-lg font-semibold">Hazard Reduction</h3>
      <div className="space-y-2">
        <label>Employee understands emergency action: <input type="checkbox" onChange={() => handleCheckboxChange('hazard_reduction','emergency_action')} /></label>
        <label>Environmental impacts identified: <input type="checkbox" onChange={() => handleCheckboxChange('hazard_reduction','environmental_impacts')} /></label>
        <input name="hazard_other" placeholder="Other" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Equipment Condition */}
      <h3 className="text-lg font-semibold">Equipment Condition</h3>
      <div className="space-y-2">
        <label>Equipment in good condition: <input type="checkbox" onChange={() => handleCheckboxChange('equipment_condition','good_condition')} /></label>
        <label>Guards in place: <input type="checkbox" onChange={() => handleCheckboxChange('equipment_condition','guards_in_place')} /></label>
        <input name="equipment_other" placeholder="Other" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Energy Control */}
      <h3 className="text-lg font-semibold">Energy Control</h3>
      <div className="space-y-2">
        <label>Verified lockout/tagout: <input type="checkbox" onChange={() => handleCheckboxChange('energy_control','lockout_verified')} /></label>
        <input name="lock_box_number" placeholder="Lock Box Number" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Special Conditions */}
      <h3 className="text-lg font-semibold">Special Conditions</h3>
      <div className="space-y-2">
        <label>Transfer operations ceased: <input type="checkbox" onChange={() => handleCheckboxChange('special_conditions','transfer_ceased')} /></label>
        <label>Area Ops notified: <input type="checkbox" onChange={() => handleCheckboxChange('special_conditions','ops_notified')} /></label>
        <input name="special_other" placeholder="Other" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Additional Documents */}
      <h3 className="text-lg font-semibold">Additional Documents</h3>
      <div className="space-y-2">
        <label><input type="checkbox" onChange={() => handleCheckboxChange('additional_documents','confined_space_plan')} /> Confined Space Entry Plan</label>
        <label><input type="checkbox" onChange={() => handleCheckboxChange('additional_documents','rescue_plan')} /> Rescue Plan</label>
        <input name="documents_other" placeholder="Other" onChange={handleChange} className="border p-2 rounded" />
      </div>

      {/* Air Monitoring */}
      <h3 className="text-lg font-semibold">Air Monitoring</h3>
      <input name="air_monitoring_required" placeholder="Continuous Monitoring Required? Yes/No" onChange={handleChange} className="border p-2 rounded" />

      {/* Instrument Info */}
      <h3 className="text-lg font-semibold">Instrument Info</h3>
      <input name="instrument_make" placeholder="Make" onChange={handleChange} className="border p-2 rounded" />
      <input name="instrument_model" placeholder="Model" onChange={handleChange} className="border p-2 rounded" />
      <input name="instrument_serial" placeholder="Serial" onChange={handleChange} className="border p-2 rounded" />
      <input name="instrument_calibration" placeholder="Last Calibration Date" onChange={handleChange} className="border p-2 rounded" />

      {/* Signatures */}
      <h3 className="text-lg font-semibold">Signatures</h3>
      <input name="issuer" placeholder="Permit Issuer" value={formData.signatures.issuer} onChange={(e) => setFormData({ ...formData, signatures: { issuer: e.target.value } })} className="w-full border p-2 rounded" />

      <div className="flex space-x-4">
        <button onClick={handleSubmit} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">{loading ? 'Submitting...' : 'Submit'}</button>
        <button onClick={() => window.history.back()} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
      </div>
    </div>
  );
}
