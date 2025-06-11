// AlbumCard.tsx — Next.js compatible album grid/list card

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
        <span className={`badge ${typeClass}`}>{album.mediaType}</span>
        <Image
          src={album.image}
          alt={album.title}
          width={180}
          height={180}
          style={{ borderRadius: 12, objectFit: "cover" }}
          unoptimized
        />
      </Link>

      <div className="info">
        <p className="album-title text-blue-600 font-semibold">{album.title}</p>
        <p className="album-artist">{album.artist} • {album.year}</p>
      </div>
    </div>
  );
}
