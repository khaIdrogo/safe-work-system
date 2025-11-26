
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NewPermit() {
  const [formData, setFormData] = useState({
    facility: '',
    location: '',
    contractor: '',
    description_of_work: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded space-y-4">
      <h2 className="text-2xl font-bold">New Safe Work Permit</h2>
      <input
        name="facility"
        placeholder="Facility"
        value={formData.facility}
        onChange={handleChange}
        className="w-full border p-2 rounded"
      />
      <input
        name="location"
        placeholder="Location"
        value={formData.location}
        onChange={handleChange}
        className="w-full border p-2 rounded"
      />
      <input
        name="contractor"
        placeholder="Contractor"
        value={formData.contractor}
        onChange={handleChange}
        className="w-full border p-2 rounded"
      />
      <textarea
        name="description_of_work"
        placeholder="Description of Work"
        value={formData.description_of_work}
        onChange={handleChange}
        className="w-full border p-2 rounded"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  );
}
