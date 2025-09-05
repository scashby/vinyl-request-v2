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
  const typeMap: Record<string, string> = {
    vinyl: "vinyl",
    cassettes: "cassette",
    cd: "cd",
    "45s": "fortyfive",
    "8-track": "eighttrack",
  };

  const typeClass =
    typeMap[album.mediaType?.toLowerCase() || ""] || "vinyl";

  // Build the album link, passing eventId as a query param if present
  const href =
    album.eventId
      ? `/browse/album-detail/${album.id}?eventId=${album.eventId}`
      : `/browse/album-detail/${album.id}`;

  return (
    <div className="album-card">
      <Link href={href}>
        <div style={{ position: 'relative' }}>
          <span className={`badge ${typeClass}`}>{album.mediaType}</span>
          {/* Just Added Badge */}
          {album.justAdded && (
            <span 
              className="badge"
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                backgroundColor: '#059669',
                color: 'white',
                fontSize: '0.6rem',
                padding: '3px 6px',
                borderRadius: '4px',
                fontWeight: '700',
                letterSpacing: '0.5px',
                zIndex: 10
              }}
            >
              ✨ NEW
            </span>
          )}
          <Image
            src={album.image}
            alt={album.title}
            width={180}
            height={180}
            style={{ borderRadius: 12, objectFit: "cover" }}
            unoptimized
          />
        </div>
      </Link>

      <div className="info">
        <p className="album-title text-blue-600 font-semibold">{album.title}</p>
        <p className="album-artist">{album.artist} • {album.year}</p>
      </div>
    </div>
  );
}