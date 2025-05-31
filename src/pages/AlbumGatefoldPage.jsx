import React from "react";
import PageLayout from "../layouts/PageLayout";
import AlbumGatefoldCard from "../components/AlbumGatefoldCard";

const testAlbum = {
  title: "Hotel California",
  artist: "Eagles",
  imageUrl: "https://i.discogs.com/PZz0RZth-jDXq_vEwv640MTGizMZe5KEc6KTzM6ZKzY/rs:fit/g:sm/q:90/h:600/w:596/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEzNTQ4/MTYtMTM4MzkwOTE3/MC0xNzEyLmpwZWc.jpeg",
  tracksA: ["Hotel California", "New Kid in Town", "Life in the Fast Lane", "Wasted Time"],
  tracksB: ["Wasted Time (Reprise)", "Victim of Love", "Pretty Maids All in a Row", "Try and Love Again", "The Last Resort"]
};

const AlbumGatefoldPage = () => {
  return (
    <PageLayout>
      <AlbumGatefoldCard album={testAlbum} />
    </PageLayout>
  );
};

export default AlbumGatefoldPage;