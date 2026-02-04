'use client';

import type { Album } from 'types/album';

interface LinksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | null) => void;
}

export function LinksTab() {
  return (
    <div className="p-5 text-center text-gray-400 text-sm">
      External link fields are not stored in the V3 schema.
    </div>
  );
}
