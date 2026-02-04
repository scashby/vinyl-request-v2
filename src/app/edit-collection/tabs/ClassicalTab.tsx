// src/app/edit-collection/tabs/ClassicalTab.tsx
'use client';

import React from 'react';
import type { Album } from 'types/album';

interface ClassicalTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function ClassicalTab() {
  return (
    <div className="p-5 text-center text-gray-400 text-sm">
      Classical fields are not stored in the V3 schema.
    </div>
  );
}
