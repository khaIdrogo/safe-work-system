'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PermitForm from '../_components/PermitForm';

export default function EditPermitPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [initialData, setInitialData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('safe_work_permits')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        alert(`Could not load permit: ${error.message}`);
        window.history.back();
        return;
      }
      setInitialData(data);
      setLoading(false);
    })();
  }, [id]);

  if (!id) return <div className="p-4">Invalid permit id.</div>;
  if (loading) return <div className="p-4">Loading permit…</div>;

  return <PermitForm mode="edit" recordId={id} initialData={initialData} />;
}
