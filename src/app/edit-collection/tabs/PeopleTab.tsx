'use client';

import { useState } from 'react';
import type { Album } from 'types/album';

interface PeopleTabProps {
  album: Album;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (field: keyof Album, value: any) => void;
}

// Helper to render a list of people with simple add/remove
function PersonList({ 
  title, 
  people, 
  onAdd, 
  onRemove 
}: { 
  title: string; 
  people: string[] | null; 
  onAdd: (name: string) => void;
  onRemove: (index: number) => void;
}) {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="mb-5">
      <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">{title}</label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[32px] p-2 bg-gray-50 border border-gray-200 rounded">
        {people && people.length > 0 ? (
          people.map((person, idx) => (
            <span key={idx} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm flex items-center gap-1.5">
              {person}
              <button 
                onClick={() => onRemove(idx)}
                className="bg-transparent border-none text-gray-400 hover:text-red-500 cursor-pointer p-0 leading-none"
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="text-gray-400 text-sm italic">No {title.toLowerCase()} added</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${title}...`}
          className="flex-1 px-2.5 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 border-none cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function PeopleTab({ album, onChange }: PeopleTabProps) {
  
  const handleAddPerson = (field: keyof Album, name: string) => {
    const currentList = (album[field] as string[]) || [];
    onChange(field, [...currentList, name]);
  };

  const handleRemovePerson = (field: keyof Album, index: number) => {
    const currentList = (album[field] as string[]) || [];
    onChange(field, currentList.filter((_, i) => i !== index));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 w-full">
      <div className="col-span-1">
        <PersonList
          title="Musicians"
          people={album.musicians}
          onAdd={(name) => handleAddPerson('musicians', name)}
          onRemove={(idx) => handleRemovePerson('musicians', idx)}
        />
      </div>
      <div className="col-span-1">
        <PersonList
          title="Songwriters"
          people={album.songwriters}
          onAdd={(name) => handleAddPerson('songwriters', name)}
          onRemove={(idx) => handleRemovePerson('songwriters', idx)}
        />
      </div>
      <div className="col-span-1">
        <PersonList
          title="Producers"
          people={album.producers}
          onAdd={(name) => handleAddPerson('producers', name)}
          onRemove={(idx) => handleRemovePerson('producers', idx)}
        />
      </div>
      <div className="col-span-1">
        <PersonList
          title="Engineers"
          people={album.engineers}
          onAdd={(name) => handleAddPerson('engineers', name)}
          onRemove={(idx) => handleRemovePerson('engineers', idx)}
        />
      </div>
    </div>
  );
}