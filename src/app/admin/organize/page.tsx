'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrganizePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/edit-collection');
  }, [router]);

  return (
    <div className="p-6 text-sm text-gray-700">
      Redirecting to the V3 Edit Collection experience…
    </div>
  );
}
