import { writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE = '/Users/stephenashby/Sites/vinyl-request-v2/src/app/admin';

function layout(title) {
  return `export const metadata = { title: '${title}' };\nexport default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }\n`;
}

function write(relPath, title) {
  const dir = `${BASE}/${relPath}`;
  if (!existsSync(dir)) { mkdirSync(dir, { recursive: true }); }
  const file = `${dir}/layout.tsx`;
  if (!existsSync(file)) {
    writeFileSync(file, layout(title));
    console.log('created', relPath + '/layout.tsx');
  } else {
    console.log('skipped (exists)', relPath + '/layout.tsx');
  }
}

// Top-level admin sections
write('admin-dashboard',    'Dashboard');
write('album-suggestions',  'Album Suggestions');
write('diagnostics',        'Diagnostics');
write('edit-about',         'Edit About');
write('edit-entry',         'Edit Entry');
write('edit-queue',         'Edit Queue');
write('enrich-collection',  'Enrich Collection');
write('event-types',        'Event Types');
write('featured-events',    'Featured Events');
write('image-library',      'Image Library');
write('manage-dj-sets',     'Manage DJ Sets');
write('manage-events',      'Manage Events');
write('media-grading',      'Media Grading');
write('playlists',          'Playlists');
// write('staff-picks',        'Staff Picks (Admin)');

// Admin games hub
write('games',              'Games Admin');

// Artist Alias
write('games/artist-alias',             'Artist Alias');
write('games/artist-alias/host',        'Artist Alias \u2013 Host');
write('games/artist-alias/assistant',   'Artist Alias \u2013 Assistant');
write('games/artist-alias/jumbotron',   'Artist Alias \u2013 Jumbotron');
write('games/artist-alias/history',     'Artist Alias \u2013 History');

// Back to Back Connection
write('games/back-to-back-connection',             'Back to Back Connection');
write('games/back-to-back-connection/host',        'Back to Back Connection \u2013 Host');
write('games/back-to-back-connection/assistant',   'Back to Back Connection \u2013 Assistant');
write('games/back-to-back-connection/jumbotron',   'Back to Back Connection \u2013 Jumbotron');
write('games/back-to-back-connection/history',     'Back to Back Connection \u2013 History');
write('games/back-to-back-connection/help',        'Back to Back Connection \u2013 Help');

// Bingo
write('games/bingo',             'Bingo');
write('games/bingo/host',        'Bingo \u2013 Host');
write('games/bingo/assistant',   'Bingo \u2013 Assistant');
write('games/bingo/jumbotron',   'Bingo \u2013 Jumbotron');
write('games/bingo/history',     'Bingo \u2013 History');
write('games/bingo/edit',        'Bingo \u2013 Edit');
write('games/bingo/prep',        'Bingo \u2013 Prep');

// Bracket Battle
write('games/bracket-battle',             'Bracket Battle');
write('games/bracket-battle/host',        'Bracket Battle \u2013 Host');
write('games/bracket-battle/assistant',   'Bracket Battle \u2013 Assistant');
write('games/bracket-battle/jumbotron',   'Bracket Battle \u2013 Jumbotron');
write('games/bracket-battle/history',     'Bracket Battle \u2013 History');

// Cover Art Clue Chase
write('games/cover-art-clue-chase',             'Cover Art Clue Chase');
write('games/cover-art-clue-chase/host',        'Cover Art Clue Chase \u2013 Host');
write('games/cover-art-clue-chase/assistant',   'Cover Art Clue Chase \u2013 Assistant');
write('games/cover-art-clue-chase/jumbotron',   'Cover Art Clue Chase \u2013 Jumbotron');
write('games/cover-art-clue-chase/history',     'Cover Art Clue Chase \u2013 History');
write('games/cover-art-clue-chase/help',        'Cover Art Clue Chase \u2013 Help');

// Crate Categories
write('games/crate-categories',             'Crate Categories');
write('games/crate-categories/host',        'Crate Categories \u2013 Host');
write('games/crate-categories/assistant',   'Crate Categories \u2013 Assistant');
write('games/crate-categories/jumbotron',   'Crate Categories \u2013 Jumbotron');
write('games/crate-categories/history',     'Crate Categories \u2013 History');

// Decade Dash
write('games/decade-dash',             'Decade Dash');
write('games/decade-dash/host',        'Decade Dash \u2013 Host');
write('games/decade-dash/assistant',   'Decade Dash \u2013 Assistant');
write('games/decade-dash/jumbotron',   'Decade Dash \u2013 Jumbotron');
write('games/decade-dash/history',     'Decade Dash \u2013 History');

// Genre Imposter
write('games/genre-imposter',             'Genre Imposter');
write('games/genre-imposter/host',        'Genre Imposter \u2013 Host');
write('games/genre-imposter/assistant',   'Genre Imposter \u2013 Assistant');
write('games/genre-imposter/jumbotron',   'Genre Imposter \u2013 Jumbotron');
write('games/genre-imposter/history',     'Genre Imposter \u2013 History');

// Lyric Gap Relay
write('games/lyric-gap-relay',             'Lyric Gap Relay');
write('games/lyric-gap-relay/host',        'Lyric Gap Relay \u2013 Host');
write('games/lyric-gap-relay/assistant',   'Lyric Gap Relay \u2013 Assistant');
write('games/lyric-gap-relay/jumbotron',   'Lyric Gap Relay \u2013 Jumbotron');
write('games/lyric-gap-relay/history',     'Lyric Gap Relay \u2013 History');
write('games/lyric-gap-relay/help',        'Lyric Gap Relay \u2013 Help');

// Music Trivia
write('games/music-trivia',             'Music Trivia');
write('games/music-trivia/host',        'Music Trivia \u2013 Host');
write('games/music-trivia/jumbotron',   'Music Trivia \u2013 Jumbotron');
write('games/music-trivia/history',     'Music Trivia \u2013 History');
write('games/music-trivia/prep',        'Music Trivia \u2013 Prep');
write('games/music-trivia/bank',        'Music Trivia \u2013 Bank');
write('games/music-trivia/decks',       'Music Trivia \u2013 Decks');

// Name That Tune
write('games/name-that-tune',             'Name That Tune');
write('games/name-that-tune/host',        'Name That Tune \u2013 Host');
write('games/name-that-tune/assistant',   'Name That Tune \u2013 Assistant');
write('games/name-that-tune/jumbotron',   'Name That Tune \u2013 Jumbotron');
write('games/name-that-tune/history',     'Name That Tune \u2013 History');

// Needle Drop Roulette
write('games/needle-drop-roulette',             'Needle Drop Roulette');
write('games/needle-drop-roulette/host',        'Needle Drop Roulette \u2013 Host');
write('games/needle-drop-roulette/assistant',   'Needle Drop Roulette \u2013 Assistant');
write('games/needle-drop-roulette/jumbotron',   'Needle Drop Roulette \u2013 Jumbotron');
write('games/needle-drop-roulette/history',     'Needle Drop Roulette \u2013 History');

// Original or Cover
write('games/original-or-cover',             'Original or Cover');
write('games/original-or-cover/host',        'Original or Cover \u2013 Host');
write('games/original-or-cover/assistant',   'Original or Cover \u2013 Assistant');
write('games/original-or-cover/jumbotron',   'Original or Cover \u2013 Jumbotron');
write('games/original-or-cover/history',     'Original or Cover \u2013 History');

// Sample Detective
write('games/sample-detective',             'Sample Detective');
write('games/sample-detective/host',        'Sample Detective \u2013 Host');
write('games/sample-detective/assistant',   'Sample Detective \u2013 Assistant');
write('games/sample-detective/jumbotron',   'Sample Detective \u2013 Jumbotron');
write('games/sample-detective/history',     'Sample Detective \u2013 History');
write('games/sample-detective/help',        'Sample Detective \u2013 Help');

// Wrong Lyric Challenge
write('games/wrong-lyric-challenge',             'Wrong Lyric Challenge');
write('games/wrong-lyric-challenge/host',        'Wrong Lyric Challenge \u2013 Host');
write('games/wrong-lyric-challenge/assistant',   'Wrong Lyric Challenge \u2013 Assistant');
write('games/wrong-lyric-challenge/jumbotron',   'Wrong Lyric Challenge \u2013 Jumbotron');
write('games/wrong-lyric-challenge/history',     'Wrong Lyric Challenge \u2013 History');
write('games/wrong-lyric-challenge/help',        'Wrong Lyric Challenge \u2013 Help');

console.log('Done.');
