// src/app/edit-collection/tabs/PeopleTab.tsx
'use client';

import React from 'react';
import type { Album } from 'types/album';

interface PeopleTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function PeopleTab() {
  return (
    <div className="p-5 text-center text-gray-400 text-sm">
      Credits are not stored in the V3 schema.
    </div>
  );
}
