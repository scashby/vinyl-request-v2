'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EditAlbumModal from 'src/app/edit-collection/EditAlbumModal';

export default function EditEntryPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id as string | undefined;
  const albumId = useMemo(() => {
    const num = idParam ? Number(idParam) : NaN;
    return Number.isNaN(num) ? null : num;
  }, [idParam]);

  if (!albumId) {
    return (
      <div className="p-6 text-sm text-gray-700">
        Invalid album id. Returning to collection…
      </div>
    );
  }

  return (
    <EditAlbumModal
      albumId={albumId}
      allAlbumIds={[albumId]}
      onClose={() => router.push('/edit-collection')}
      onRefresh={() => {}}
      onNavigate={() => {}}
    />
  );
}
