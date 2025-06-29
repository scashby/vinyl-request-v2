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
    if (typeof window !== 'undefined' && window.instgrm) {
      try {
        window.instgrm.Embeds.process();
      } catch (err) {
        console.error("Instagram embed process failed", err);
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
