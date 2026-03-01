"use client";

import InlineFieldHelp from "src/components/InlineFieldHelp";

type PlaylistRow = {
  id: number;
  name: string;
  track_count: number;
};

type GamePlaylistSelectProps = {
  playlists: PlaylistRow[];
  playlistId: number | null;
  setPlaylistId: (playlistId: number | null) => void;
  label?: string;
};

export default function GamePlaylistSelect(props: GamePlaylistSelectProps) {
  const { playlists, playlistId, setPlaylistId, label = "Playlist Bank" } = props;

  return (
    <label className="text-sm">
      {label} <InlineFieldHelp label={label} />
      <select
        className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
        value={playlistId ?? ""}
        onChange={(event) => {
          setPlaylistId(Number(event.target.value) || null);
        }}
      >
        <option value="">Select playlist bank</option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.name} ({playlist.track_count})
          </option>
        ))}
      </select>
    </label>
  );
}
