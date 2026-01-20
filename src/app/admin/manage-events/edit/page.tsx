// src/app/admin/manage-events/edit/page.tsx

'use client';
import { useSearchParams } from 'next/navigation';
import EditEventForm from 'components/EditEventForm';
import { Suspense } from 'react';

function EditEventPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  // Convert string ID to number if present, otherwise pass null
  const numericId = id ? parseInt(id, 10) : null;

  // @ts-expect-error - EditEventForm props definition might be missing id in current types
  return <EditEventForm id={numericId} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <EditEventPageContent />
    </Suspense>
  );
}