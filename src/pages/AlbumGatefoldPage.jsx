import React from 'react';
import PageLayout from '../layouts/PageLayout';
import AlbumGatefoldCard from '../components/AlbumGatefoldCard';

const AlbumGatefoldPage = () => {
  const album = {
    title: "Hotel California",
    artist: "Eagles",
    coverUrl: "https://i.discogs.com/PZz0RZth-jDXq_vEwv640MTGizMZe5KEc6KTzM6ZKzY/rs:fit/g:sm/q:90/h:600/w:596/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEzNTQ4/MTYtMTM4MzkwOTE3/MC0xNzEyLmpwZWc.jpeg",
    sideA: ["Hotel California", "New Kid in Town", "Life in the Fast Lane"],
    sideB: ["Wasted Time", "Victim of Love", "The Last Resort"]
  };

  return (
    <PageLayout>
      <AlbumGatefoldCard album={album} />
    </PageLayout>
  );
};

export default AlbumGatefoldPage;
