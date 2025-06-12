// src/app/admin/manage-events/edit/page.js

'use client';
import { useSearchParams } from 'next/navigation';
import EditEventForm from 'components/EditEventForm';

export default function Page() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || null;

  return <EditEventForm id={id} />;
}
