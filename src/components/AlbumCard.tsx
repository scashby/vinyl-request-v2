// FILE: src/components/AlbumCard.tsx
// AlbumCard component with Just Added badge support

"use client";

import Link from "next/link";
import Image from "next/image";

type Album = {
  id: string | number;
  eventId?: string | number;
  mediaType?: string;
  image: string;
  title: string;
  artist: string;
  year: string | number;
  justAdded?: boolean; // NEW: Add this prop
};

export default function AlbumCard({ album }: { album: Album }) {
  const colorMap: Record<string, string> = {
    vinyl: "bg-purple-600/75",
    cassettes: "bg-green-600/75",
    cd: "bg-teal-600/75",
    "45s": "bg-red-600/75",
    "8-track": "bg-orange-600/75",
  };

  const badgeColor =
    colorMap[album.mediaType?.toLowerCase() || ""] || "bg-gray-600/75";

  // Build the album link, passing eventId as a query param if present
  const href =
    album.eventId
      ? `/browse/album-detail/${album.id}?eventId=${album.eventId}`
      : `/browse/album-detail/${album.id}`;

  return (
    <div className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-transform duration-200 hover:scale-[1.02]">
      <Link href={href}>
        <div className="relative">
          <span className={`absolute top-1.5 left-1.5 text-[0.65rem] px-1.5 py-0.5 rounded font-semibold tracking-wide text-white ${badgeColor}`}>
            {album.mediaType}
          </span>
          {/* Just Added Badge */}
          {album.justAdded && (
            <span className="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[0.6rem] px-1.5 py-0.5 rounded font-bold tracking-wide z-10 shadow-sm">
              ✨ NEW
            </span>
          )}
          <Image
            src={album.image}
            alt={album.title}
            width={180}
            height={180}
            className="w-full aspect-square object-cover"
            unoptimized
          />
        </div>
      </Link>

      <div className="p-2">
        <p className="font-bold text-blue-600 line-clamp-1" title={album.title}>{album.title}</p>
        <p className="text-xs text-gray-900 uppercase leading-tight line-clamp-1">{album.artist} • {album.year}</p>
      </div>
    </div>
  );
}