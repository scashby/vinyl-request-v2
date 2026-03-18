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
  showPlaylistEditorLink?: boolean;
};

export default function GamePlaylistSelect(props: GamePlaylistSelectProps) {
  const {
    playlists,
    playlistId,
    setPlaylistId,
    label = "Playlist Bank",
    showPlaylistEditorLink = true,
  } = props;

  const playlistStudioHref = '/edit-collection?playlistStudio=1&playlistView=manual&viewMode=playlist&trackSource=playlists&folderMode=playlists';

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
      {showPlaylistEditorLink && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <a
            href={playlistStudioHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-stone-600 px-2 py-1 font-semibold text-stone-200 hover:border-amber-400 hover:text-amber-200"
          >
            Open Playlist Editor
          </a>
          <span className="text-stone-400">opens in a new tab</span>
        </div>
      )}
    </label>
  );
}
