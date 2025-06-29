'use client';

import { useEffect, useState } from "react";

export default function SocialEmbeds() {
  const [embeds, setEmbeds] = useState([]);

  useEffect(() => {
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then(data => setEmbeds(data.filter(e => e.visible)));
  }, []);

  useEffect(() => {
    // This forces Instagram/Threads embeds to render
    if (typeof window !== 'undefined' && window.instgrm?.Embeds?.process) {
      try {
        window.instgrm.Embeds.process();
      } catch (err) {
        console.error("Instagram embed failed:", err);
      }
    }
  }, [embeds]);

  return (
    <div className="social-embeds">
      {embeds.map((e) => (
        <div
          key={e.id}
          className="social-embed"
          dangerouslySetInnerHTML={{ __html: e.embed_html }}
        />
      ))}
    </div>
  );
}
