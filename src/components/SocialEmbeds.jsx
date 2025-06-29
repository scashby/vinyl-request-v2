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
    if (embeds.length === 0) return;

    const ensureScript = (id, src, callback) => {
      if (!document.getElementById(id)) {
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;
        script.onload = callback;
        document.body.appendChild(script);
      } else {
        callback();
      }
    };

    ensureScript("instagram-embed", "https://www.instagram.com/embed.js", () => {
      if (window.instgrm?.Embeds?.process) window.instgrm.Embeds.process();
    });

    ensureScript("bluesky-embed", "https://embed.bsky.app/static/embed.js", () => {
      if (window.blueskyEmbed?.load) window.blueskyEmbed.load();
    });
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
