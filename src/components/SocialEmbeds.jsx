'use client';

import { useEffect, useState, useRef } from "react";

export default function SocialEmbeds() {
  const [embeds, setEmbeds] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then(data => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = "";

        data
          .filter(e => e.visible)
          .forEach(e => {
            const div = document.createElement("div");
            div.className = "social-embed";
            div.innerHTML = e.embed_html;
            containerRef.current.appendChild(div);
          });
      });
  }, []);

  return <div ref={containerRef} className="social-embeds" />;
}
