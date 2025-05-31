// ✅ BrowseAlbumsPage.jsx
// Converted from browse-preview.html — JSX conversion and hook integration needed

export default function BrowseAlbumsPage() {
  return (
    <>
      {/* BEGIN HTML */}
      <div dangerouslySetInnerHTML={ { __html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Browse Collection Preview</title>
  <link rel="stylesheet" href="album-browse.css">
</head>
<body>
  <div class="browse-page">
    <h1>Browse Collection</h1>
    <div class="album-grid">
      <a class="album-card" href="#">
        <span class="badge vinyl">Vinyl</span>
        <img src="images/british-steel.jpg" alt="British Steel" />
        <div class="info">
          <p class="title">British Steel</p>
          <p class="artist">Judas Priest • 1980</p>
        </div>
      </a>
      <a class="album-card" href="#">
        <span class="badge cassette">Cassette</span>
        <img src="images/love-at-first-sting.jpg" alt="Love at First Sting" />
        <div class="info">
          <p class="title">Love at First Sting</p>
          <p class="artist">Scorpions • 1984</p>
        </div>
      </a>
    </div>
  </div>
</body>
</html>
` } } />
      {/* END HTML */}
    </>
  );
}
