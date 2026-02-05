'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type PageProps = {
  params: { id: string };
};

export default function PermitByIdPage({ params }: PageProps) {
  const router = useRouter();

  useEffect(() => {
    if (!params?.id) return;
    // Send the user to the existing form, in edit mode
    router.replace(`/permits/new?editId=${encodeURIComponent(params.id)}`);
  }, [params?.id, router]);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Loading permit…</h2>
      <p className="text-sm text-gray-600">One moment please.</p>
    </div>
  );
}
