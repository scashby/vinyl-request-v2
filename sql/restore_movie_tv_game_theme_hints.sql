BEGIN;

CREATE TEMP TABLE restore_target_playlist AS
SELECT id
FROM collection_playlists
WHERE name = 'Movie and TV Game'
ORDER BY id DESC
LIMIT 1;

CREATE TEMP TABLE restore_desired_tracks (
  ord integer PRIMARY KEY,
  track_title text NOT NULL,
  track_artist text NOT NULL,
  theme_hint text NOT NULL,
  n_title text NOT NULL,
  n_artist text NOT NULL
) ON COMMIT DROP;

INSERT INTO restore_desired_tracks (ord, track_title, track_artist, theme_hint, n_title, n_artist)
SELECT
  ord,
  track_title,
  track_artist,
  theme_hint,
  regexp_replace(lower(track_title), '[^a-z0-9]+', '', 'g'),
  regexp_replace(lower(track_artist), '[^a-z0-9]+', '', 'g')
FROM (
  VALUES
    (1,  'Sister Christian', 'Night Ranger', 'It takes a lot of BDE to scam a drug dealer with baking soda, but that''s the type of thing Boogie Nights excels at.'),
    (2,  'In The Air Tonight', 'Phil Collins', 'This song made it clear in the debut episode that Miami Vice was going to be a different show.'),
    (3,  'Theme From The T.V. Show "Cheers" (Where Everybody Knows Your Name)', 'Gary Portnoy', 'You might find Norm and Cliff belly up at the title bar.'),
    (4,  'Don''t You (Forget About Me)', 'Simple Minds', 'each one of us is a brain...and an athlete... and a basket case...a princess....and a criminal.'),
    (5,  'Arthur''s Theme (Best That You Can Do)', 'Christopher Cross', 'Dudley Moore gets caught between the moon and New York City.'),
    (6,  'Immigrant Song', 'Led Zeppelin', 'It''s a wonder it took three Thor movies to use the song that mentions "Hammer of the Gods"'),
    (7,  'Oh Pretty Woman', 'Roy Orbison', 'Probably a fairly obvious song to include on this Julia Roberts/Richard Gere flick.'),
    (8,  'Louie Louie', 'The Kingsmen', 'Dorfman, I''ve given this a lot of thought. From now on... your name is Flounder.'),
    (9,  'Tequila', 'The Champs', 'Pee Wee Herman introduces a biker bar to the greatest karaoke song ever.'),
    (10, 'Twist And Shout', 'The Beatles', 'What other song would you choose to sing in a random Windy City parade float? Save Ferris!'),
    (11, 'Gonna Fly Now (Theme From "Rocky")', 'Bill Conti', 'Before he got the eye of the tiger, Rocky was able to perform other feats of wonder.'),
    (12, 'Stand By Me', 'Ben E. King', 'You guys wanna go see a dead body?'),
    (13, 'Walking On Sunshine', 'Katrina And The Waves', 'Ok buddy, I was just trying to cheer us up. Go ahead and put on some sad bastard music, see if I care.'),
    (14, 'Unchained Melody', 'The Righteous Brothers', 'I wonder how many people took up pottery after this song was used in a famous scene in Ghost.'),
    (15, 'Don''t Stop Believin''', 'Journey', 'I wouldn''t suggest playing this on a diner jukebox in New Jersey.'),
    (16, 'Moonlighting (Theme)', 'Al Jarreau', 'Bruce Willis investigates cases with Cybill Sheppard, fourth wall breaks, and a few dance numbers.'),
    (17, 'I Will Survive', 'Gloria Gaynor', 'Nothing like a post barroom brawl line dance/sing along while waiting to be bailed out by your coach. Pain heals. Chicks dig scars. Glory is forever.'),
    (18, 'Mrs. Robinson', 'Simon & Garfunkel', 'When you think of the Graduate, you think of this song, even though Sound of Silence is more iconic in the film.'),
    (19, 'Just Dropped In (To See What Condition My Condition Was In)', 'Kenny Rogers & The First Edition', 'Featured in a surreal bowling dream in the Big Lebowski. Yeah. Yeah. Oh yeah.'),
    (20, 'Nobody Does It Better', 'Carly Simon', 'In 1977, this years Jaws was a Bond villian, in Roger Moore''s second bond film "The Spy Who Loved Me."'),
    (21, 'Sweet Caroline (Good Times Never Seemed So Good)', 'Neil Diamond', 'Not just for 7th inning stretches, this one was featured in Beautiful Girls, among other shows and films.'),
    (22, 'Theme From Shaft', 'Isaac Hayes', 'Shut your mouth - But i''m talkin about...'),
    (23, 'Stayin'' Alive', 'Bee Gees', 'You can use this movie''s theme song to help pace your CPR compressions.'),
    (24, 'Build Me Up Buttercup', 'The Foundations', 'There''s something about Mary and the rest of the cast singing along to this song during the end credits.'),
    (25, 'Chariots Of Fire - Titles', 'Vangelis', 'If you have a movie or tv show that has running in slow motion, they''re probably using this song.'),
    (26, 'Layla', 'Derek & The Dominos', 'If you''re a Goodfella, you might not want to hear this song''s outro.'),
    (27, 'Love Is All Around', 'The Troggs', 'Love, Actually, plays us an updated christmas version guaranteed to have a naked version if it reaches number 1.'),
    (28, 'My Life', 'Billy Joel', 'Tom Hanks and Peter Scholari are Bosom Buddies in their ABC sitcom.'),
    (29, 'Eye Of The Tiger', 'Survivor', 'Even Rocky training to beat Clubber Lang couldn''t get Queen''s "Another One Bites the Dust", so this one will do.'),
    (30, 'Wild Thing', 'The Troggs', 'Charlie Sheen can''t see or control his fastball. Major League used the band X''s cover, but in your head it''s this original.'),
    (31, 'Dueling Banjos', 'Eric Weissberg', 'Deliverance shows us that maybe a canoeing trip in backwoods Georgia may not be a great idea.'),
    (32, 'Theme From Magnum P.I.', 'Mike Post', 'What do Hawaiian shirts, red Lamborghinis, helicopters, and one of the most famous mustaches from the 80s have in common?'),
    (33, 'Endless Love (Vocal)', 'Diana Ross', 'Adam Sandler and Julie Bowen have a solo couples skate in Happy Gilmore. Oh, and it''s also the theme song for a movie I guess.'),
    (34, 'Star Wars Theme/Cantina Band', 'Meco Monardo', 'Do you really need a hint for this? If you were alive anytime after 1977 you know the film this is from,'),
    (35, 'Theme From "The Greatest American Hero" (Believe It Or Not)', 'Joey Scarbury', 'Believe it or not, sometimes a group of aliens give you a superhero suit without an instruction manual.'),
    (36, 'Free Bird', 'Lynyrd Skynyrd', 'This song sets the pace for an all out brawl in a church for Kingsmen: Secret Service.'),
    (37, 'Maniac (Vocal)', 'Michael Sembello', 'Steel mill worker by day, dancer by night. And she''s dancing like she never danced before.'),
    (38, 'East Bound And Down', 'Jerry Reed', 'While we prefer Handline here, if you need to transport 700 cases of Coors from Texarkana to Atlanta, no one better for the job than Snowman and the Bandit.'),
    (39, 'Kokomo', 'The Beach Boys', 'Mike Love shows why we need Brian Wilson on this song written for the movie Cocktail. Appropriate, since you need to be drunk to listen to the whole song.'),
    (40, 'Old Time Rock & Roll', 'Bob Seger And The Silver Bullet Band', 'It''s Risky Business to dance around in your tighty whiteys, unless you''re Tom Cruise.'),
    (41, 'Shout - Part 1', 'The Isley Brothers', 'While the fictional Otis Day and the Knights perform this in Animal House, this is the soundtrack song.'),
    (42, 'Welcome Back Kotter', 'John Sebastian', 'Theme for the tv show that gave us John Travolta and a note from Epstein''s mother.'),
    (43, 'Walk On The Wild Side', 'Lou Reed', 'Iggy Pop''s "Lust for Life" isn''t the only big name hit on the Trainspotting soundtrack.'),
    (44, 'Take My Breath Away (Love Theme From Top Gun)', 'Berlin', 'They trade walking in LA for the need for speed in Top Gun''s love theme.'),
    (45, 'Call Me', 'Blondie', 'Whether you''re an American Gigolo or a new Supergirl, you can give me a ring with this new wave classic.'),
    (46, 'I''m Alright (Theme From "Caddyshack")', 'Kenny Loggins', 'It''s a Cinderella story... the king of soundtrack songs gives us a theme song so catchy even gophers dance to it.'),
    (47, 'O-o-h Child', 'Five Stairsteps', 'Preferred song for intergalactic dance offs and distracting bad guys.'),
    (48, 'Pinball Wizard', 'The Who', 'That deaf, dumb and blind kid Tommy sure can play a mean pinball.'),
    (49, 'We Don''t Need Another Hero (Thunderdome)', 'Tina Turner', 'Auntie Entity tells us what we don''t need in Mad Max Beyond Thunderdome'),
    (50, 'Grease', 'Frankie Valli', 'This theme song is the word that you heard. It''s got a groove. It''s got a meaning. It''s the time, the place, the way that we''re feeling.'),
    (51, 'Magic', 'Olivia Newton-John', 'Rollerskating was a big thing in the 70s I guess, if Xanadu is any indication.'),
    (52, 'Stuck In The Middle With You', 'Stealers Wheel', 'Reservoir Dogs shows why Michael Madsen might not be your best dance partner.'),
    (53, 'Banana Boat (Day-O)', 'Harry Belafonte', 'Don''t say the name of this movie three times, or you might find yourself caught in some irresistible ghostly choreography'),
    (54, 'Afternoon Delight', 'Starland Vocal Band', 'Ron Burgundy explains what love is using this song, and it''s not lamp.'),
    (55, 'Crazy For You', 'Madonna', 'Matthew Modine and Linda Fiorentino dance to this song in Vision Quest'),
    (56, 'Love Stinks', 'The J. Geils Band', 'Adam Sandler makes a memorable cover of this song in the Wedding Singer.'),
    (57, 'La Bamba', 'Los Lobos', 'Richie Valens'' biggest hit is covered for the theme for this biopic starring Lou Diamond Phillips'),
    (58, 'Going Back To Cali', 'LL Cool J', 'There is a Less Than Zero chance this singer will be returning to the golden state. I don''t think so.'),
    (59, 'Happy Days', 'Pratt & McClain, Brotherlove', 'Richie Cunningham. Ralph the Mouth. Potsie. The Fonz. Do you need more of a hint?'),
    (60, 'I Got You Babe', 'Sonny & Cher', 'It''s groundhog day. Again.'),
    (61, 'All For Love (LP Version)', 'Bryan Adams', 'Three 80s power balladeers turn out the theme song for Three Muskateers.'),
    (62, 'Soul Man', 'The Blues Brothers', 'They''re on a mission from God with this cover from this Ackroyd/Belushi staple.'),
    (63, 'Up Where We Belong', 'Joe Cocker, Jennifer Warnes', 'Richard Gere may be an officer and a gentlemen, but he ain''t got nowhere else to go.'),
    (64, 'I Want Your Sex', 'George Michael', 'Clearly if you''re Eddie Murphy getting charged $7 for a coke with no ice in a strip club, then you have this on the jukebox. From Beverly Hills Cop 2'),
    (65, 'Everybody''s Talkin''', 'Harry Nilsson', 'Used as the theme for Midnite Cowboy. Dustin Hoffman is walking here!!!'),
    (66, 'My Sharona', 'The Knack', 'Best song for an impromptu dance party in the middle of Food Mart, as seen in Reality Bites.'),
    (67, 'Holding Out For A Hero', 'Bonnie Tyler', 'Kevin Bacon plays chicken with some farm tractors in this scene from Footloose.'),
    (68, 'Kung Fu Fighting', 'Carl Douglas', 'A favorite of not-so-serious martial arts films, including a cover by Cee-lo Green and Jack Black in Kung Fu Panda'),
    (69, 'Angel Of The Morning', 'Juice Newton', 'Deadpool gives us one of the greatest opening credits ever.'),
    (70, 'Superfly', 'Curtis Mayfield', 'End credits theme for one of the most famous blaxploitation films ever made.'),
    (71, 'I''m A Believer', 'The Monkees', 'Obviously from the TV show, this may be better known by fans of Eddie Murphy and Smashmouth.'),
    (72, 'Power Of Love', 'Huey Lewis & The News', 'Marty McFly plays this song just too darn loud in Back to the Future.'),
    (73, 'The Pink Panther Theme', 'Henry Mancini And His Orchestra', 'Peter Sellers snoops around as Inspector Clouseau in this film franchise.'),
    (74, 'God Only Knows', 'The Beach Boys', 'Name another song that is just as comfortable in Boogie Nights as it is in Love, Actually...'),
    (75, 'Flowers On The Wall', 'The Statler Brothers', 'Tarantino is the king of pulling jukebox gems, and Pulp Fiction is no exception. Be careful though, if you hear this song the gimp may not be far away.')
) AS src(ord, track_title, track_artist, theme_hint);

CREATE TEMP TABLE restore_current_playlist_tracks AS
WITH playlist_items AS (
  SELECT
    i.id AS playlist_item_id,
    i.track_key,
    i.sort_order,
    split_part(i.track_key, ':', 1)::int AS inventory_id,
    CASE
      WHEN array_length(string_to_array(i.track_key, ':'), 1) = 2 THEN NULL
      WHEN split_part(i.track_key, ':', 2) ~ '^[0-9]+$' THEN split_part(i.track_key, ':', 2)::int
      ELSE NULL
    END AS release_track_id,
    CASE
      WHEN array_length(string_to_array(i.track_key, ':'), 1) = 2 THEN split_part(i.track_key, ':', 2)
      WHEN split_part(i.track_key, ':', 2) = 'fallback' THEN split_part(i.track_key, ':', 4)
      WHEN split_part(i.track_key, ':', 2) LIKE 'p:%' THEN substr(split_part(i.track_key, ':', 2), 3)
      WHEN split_part(i.track_key, ':', 2) ~ '^[0-9]+$' THEN NULL
      ELSE NULLIF(split_part(i.track_key, ':', 2), '')
    END AS fallback_position,
    CASE
      WHEN array_length(string_to_array(i.track_key, ':'), 1) >= 3 AND split_part(i.track_key, ':', 3) ~ '^[0-9]+$'
        THEN split_part(i.track_key, ':', 3)::int
      ELSE NULL
    END AS recording_id
  FROM collection_playlist_items i
  JOIN restore_target_playlist p ON p.id = i.playlist_id
),
resolved AS (
  SELECT
    pi.playlist_item_id,
    pi.track_key,
    pi.sort_order,
    COALESCE(NULLIF(rt_exact.title_override, ''), NULLIF(rt_pos.title_override, ''), NULLIF(rec.title, ''), 'Track ' || (pi.sort_order + 1)::text) AS track_title,
    COALESCE(
      NULLIF(regexp_replace(COALESCE(rec.track_artist, ''), '\\s+\\(\\d+\\)\\s*$', ''), ''),
      NULLIF(regexp_replace(COALESCE(rec.credits ->> 'track_artist', ''), '\\s+\\(\\d+\\)\\s*$', ''), ''),
      NULLIF(regexp_replace(COALESCE(art.name, ''), '\\s+\\(\\d+\\)\\s*$', ''), ''),
      'Unknown Artist'
    ) AS track_artist
  FROM playlist_items pi
  LEFT JOIN inventory inv ON inv.id = pi.inventory_id
  LEFT JOIN releases rel ON rel.id = inv.release_id
  LEFT JOIN masters m ON m.id = rel.master_id
  LEFT JOIN artists art ON art.id = m.main_artist_id
  LEFT JOIN release_tracks rt_exact ON rt_exact.id = pi.release_track_id
  LEFT JOIN release_tracks rt_pos
    ON rt_pos.release_id = inv.release_id
   AND pi.release_track_id IS NULL
   AND pi.fallback_position IS NOT NULL
   AND regexp_replace(upper(COALESCE(rt_pos.position, '')), '[^A-Z0-9]+', '', 'g') IN (
     regexp_replace(upper(pi.fallback_position), '[^A-Z0-9]+', '', 'g'),
     regexp_replace(upper(regexp_replace(pi.fallback_position, '^[A-Z]+', '')), '[^A-Z0-9]+', '', 'g')
   )
  LEFT JOIN recordings rec ON rec.id = COALESCE(rt_exact.recording_id, rt_pos.recording_id, pi.recording_id)
)
SELECT
  playlist_item_id,
  track_key,
  sort_order,
  track_title,
  track_artist,
  regexp_replace(lower(track_title), '[^a-z0-9]+', '', 'g') AS n_title,
  regexp_replace(
    replace(replace(lower(track_artist), '''', ''), '"', ''),
    '[^a-z0-9]+',
    '',
    'g'
  ) AS n_artist
FROM resolved;

CREATE TEMP TABLE restore_matches AS
WITH strict_candidates AS (
  SELECT
    d.ord,
    d.theme_hint,
    c.track_key,
    c.sort_order,
    ROW_NUMBER() OVER (PARTITION BY d.ord ORDER BY c.sort_order, c.playlist_item_id) AS rn,
    COUNT(*) OVER (PARTITION BY d.ord) AS cnt
  FROM restore_desired_tracks d
  JOIN restore_current_playlist_tracks c
    ON c.n_title = d.n_title
   AND c.n_artist = d.n_artist
),
strict_unique AS (
  SELECT ord, theme_hint, track_key, sort_order
  FROM strict_candidates
  WHERE cnt = 1 AND rn = 1
),
remaining_desired AS (
  SELECT d.*
  FROM restore_desired_tracks d
  LEFT JOIN strict_unique s ON s.ord = d.ord
  WHERE s.ord IS NULL
),
remaining_candidates AS (
  SELECT c.*
  FROM restore_current_playlist_tracks c
  LEFT JOIN strict_unique s ON s.track_key = c.track_key
  WHERE s.track_key IS NULL
),
title_only_candidates AS (
  SELECT
    d.ord,
    d.theme_hint,
    c.track_key,
    c.sort_order,
    ROW_NUMBER() OVER (PARTITION BY d.ord ORDER BY c.sort_order, c.playlist_item_id) AS rn,
    COUNT(*) OVER (PARTITION BY d.ord) AS desired_cnt,
    COUNT(*) OVER (PARTITION BY c.track_key) AS key_cnt
  FROM remaining_desired d
  JOIN remaining_candidates c ON c.n_title = d.n_title
),
title_only_unique AS (
  SELECT ord, theme_hint, track_key, sort_order
  FROM title_only_candidates
  WHERE desired_cnt = 1 AND key_cnt = 1 AND rn = 1
)
SELECT * FROM strict_unique
UNION ALL
SELECT * FROM title_only_unique;

DO $$
DECLARE
  wanted_count integer;
  matched_count integer;
  duplicate_keys integer;
BEGIN
  SELECT COUNT(*) INTO wanted_count FROM restore_desired_tracks;
  SELECT COUNT(*) INTO matched_count FROM restore_matches;
  SELECT COUNT(*) INTO duplicate_keys
  FROM (
    SELECT track_key
    FROM restore_matches
    GROUP BY track_key
    HAVING COUNT(*) > 1
  ) dup;

  IF NOT EXISTS (SELECT 1 FROM restore_target_playlist) THEN
    RAISE EXCEPTION 'Playlist "Movie and TV Game" was not found.';
  END IF;

  IF duplicate_keys > 0 THEN
    RAISE EXCEPTION 'Replacement aborted: duplicate track matches detected (% duplicate keys).', duplicate_keys;
  END IF;

  IF matched_count <> wanted_count THEN
    RAISE EXCEPTION 'Replacement aborted: matched % of % desired tracks. No changes were applied.', matched_count, wanted_count;
  END IF;
END $$;

DELETE FROM collection_playlist_items i
USING restore_target_playlist p
WHERE i.playlist_id = p.id;

INSERT INTO collection_playlist_items (
  playlist_id,
  track_key,
  sort_order,
  link_group,
  theme_hint
)
SELECT
  p.id,
  m.track_key,
  d.ord - 1,
  NULL,
  d.theme_hint
FROM restore_target_playlist p
JOIN restore_matches m ON TRUE
JOIN restore_desired_tracks d ON d.ord = m.ord
ORDER BY d.ord;

SELECT
  (SELECT COUNT(*) FROM restore_desired_tracks) AS desired_rows,
  (SELECT COUNT(*) FROM restore_matches) AS matched_rows,
  (SELECT COUNT(*) FROM collection_playlist_items i JOIN restore_target_playlist p ON p.id = i.playlist_id) AS playlist_rows_after_replace;

COMMIT;

-- If this aborts again, run this after the temp-table section and before the DO block:
-- SELECT d.ord, d.track_title, d.track_artist
-- FROM restore_desired_tracks d
-- LEFT JOIN restore_matches m ON m.ord = d.ord
-- WHERE m.ord IS NULL
-- ORDER BY d.ord;
