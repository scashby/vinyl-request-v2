// ✅ AlbumDetailPage.jsx
// Converted from album-detail.html — JSX conversion and Supabase integration needed

export default function AlbumDetailPage() {
  return (
    <>
      {/* BEGIN HTML */}
      <div dangerouslySetInnerHTML={ { __html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>British Steel - Judas Priest</title>
  <link rel="stylesheet" href="album-detail.css">
</head>
<body>
  <div class="album-detail">
    <div class="background-blur"></div>
    <div class="album-header">
      <img class="album-art" src="images/british-steel.jpg" alt="British Steel" />
      <div class="album-info">
        <h1 class="title">British Steel</h1>
        <p class="artist">Judas Priest • 1980</p>
        <span class="badge vinyl">Vinyl</span>
        <p class="meta">9 TRACKS</p>
      </div>
    </div>
    <div class="tracklist">
      <div class="tracklist-header">
        <span>#</span>
        <span>Title</span>
        <span>Artist</span>
        <span>Time</span>
      </div>
      <div class="track"><span>A1</span><span>Rapid Fire</span><span>Judas Priest</span><span>4:08</span></div>
      <div class="track"><span>A2</span><span>Metal Gods</span><span>Judas Priest</span><span>4:00</span></div>
      <div class="track"><span>A3</span><span>Breaking the Law</span><span>Judas Priest</span><span>2:35</span></div>
      <div class="track"><span>A4</span><span>Grinder</span><span>Judas Priest</span><span>3:58</span></div>
      <div class="track"><span>B1</span><span>United</span><span>Judas Priest</span><span>3:36</span></div>
      <div class="track"><span>B2</span><span>You Don’t Have to Be Old to Be Wise</span><span>Judas Priest</span><span>5:04</span></div>
      <div class="track"><span>B3</span><span>Living After Midnight</span><span>Judas Priest</span><span>3:30</span></div>
      <div class="track"><span>B4</span><span>The Rage</span><span>Judas Priest</span><span>4:44</span></div>
      <div class="track"><span>B5</span><span>Steeler</span><span>Judas Priest</span><span>4:30</span></div>
    </div>
  </div>
</body>
</html>
` } } />
      {/* END HTML */}
    </>
  );
}
