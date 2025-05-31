import React from "react";
import PageLayout from "../layouts/PageLayout";
import AlbumGatefoldCard from "../components/AlbumGatefoldCard";

const demoAlbum = {
  title: "Hotel California",
  artist: "Eagles",
  imageUrl: "https://i.discogs.com/PZz0RZth-jDXq_vEwv640MTGizMZe5KEc6KTzM6ZKzY/rs:fit/g:sm/q:90/h:600/w:596/czM6Ly9kaXNjb2dzLWRhdGFiYXNlLWltYWdlcy9SLTEzNTQ4MTYtMTM4MzkwOTE3MC0xNzEyLmpwZWc.jpeg",
  sides: [
    {
      label: "A",
      tracks: ["Hotel California", "New Kid in Town", "Life in the Fast Lane", "Wasted Time"],
    },
    {
      label: "B",
      tracks: ["Wasted Time (Reprise)", "Victim of Love", "Pretty Maids All in a Row", "Try and Love Again", "The Last Resort"],
    },
  ],
};

const AlbumGatefoldPage = () => {
  return (
    <PageLayout>
      <AlbumGatefoldCard album={demoAlbum} />
    </PageLayout>
  );
};

export default AlbumGatefoldPage;
