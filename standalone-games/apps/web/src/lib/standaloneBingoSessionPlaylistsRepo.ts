export interface StandaloneBingoSessionPlaylistRecord {
  id: string;
  sessionId: string;
  roundNumber: number;
  playlistLetter: string;
  playlistName: string;
  callOrder: Array<{
    call_index: number;
    track_title: string;
    artist_name: string;
  }>;
  createdAt: string;
}

export interface CreateStandaloneBingoSessionPlaylistInput {
  roundNumber: number;
  playlistLetter: string;
  playlistName: string;
  callOrder: Array<{
    call_index: number;
    track_title: string;
    artist_name: string;
  }>;
}

export interface StandaloneBingoSessionPlaylistsRepository {
  listBySession(sessionId: string): Promise<StandaloneBingoSessionPlaylistRecord[]>;
  createMany(sessionId: string, playlists: CreateStandaloneBingoSessionPlaylistInput[]): Promise<void>;
  replaceByLetter(sessionId: string, playlistLetter: string, playlists: CreateStandaloneBingoSessionPlaylistInput[]): Promise<void>;
  deleteByLetter(sessionId: string, playlistLetter: string): Promise<void>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryStandaloneBingoSessionPlaylistsRepository implements StandaloneBingoSessionPlaylistsRepository {
  private readonly rows: StandaloneBingoSessionPlaylistRecord[] = [];

  async listBySession(sessionId: string): Promise<StandaloneBingoSessionPlaylistRecord[]> {
    return this.rows
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => (a.playlistLetter === b.playlistLetter ? a.roundNumber - b.roundNumber : a.playlistLetter.localeCompare(b.playlistLetter)));
  }

  async createMany(sessionId: string, playlists: CreateStandaloneBingoSessionPlaylistInput[]): Promise<void> {
    const createdAt = new Date().toISOString();
    playlists.forEach((playlist) => {
      this.rows.push({
        id: makeId(),
        sessionId,
        roundNumber: playlist.roundNumber,
        playlistLetter: playlist.playlistLetter,
        playlistName: playlist.playlistName,
        callOrder: playlist.callOrder,
        createdAt,
      });
    });
  }

  async replaceByLetter(sessionId: string, playlistLetter: string, playlists: CreateStandaloneBingoSessionPlaylistInput[]): Promise<void> {
    await this.deleteByLetter(sessionId, playlistLetter);
    await this.createMany(sessionId, playlists);
  }

  async deleteByLetter(sessionId: string, playlistLetter: string): Promise<void> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      const row = this.rows[index];
      if (row?.sessionId === sessionId && row.playlistLetter === playlistLetter) {
        this.rows.splice(index, 1);
      }
    }
  }
}
