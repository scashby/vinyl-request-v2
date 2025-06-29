'use client';

import { useEffect, useState, useRef } from "react";

export default function SocialEmbeds() {
  const [embeds, setEmbeds] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then(data => setEmbeds(data.filter(e => e.visible)));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";
    embeds.forEach((e) => {
      const wrapper = document.createElement("div");
      wrapper.className = "social-embed";
      wrapper.innerHTML = e.embed_html;

      const scripts = wrapper.querySelectorAll("script");
      scripts.forEach(oldScript => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach(attr =>
          newScript.setAttribute(attr.name, attr.value)
        );
        newScript.textContent = oldScript.textContent;
        oldScript.replaceWith(newScript);
      });

      containerRef.current.appendChild(wrapper);
    });

    // Delay to allow embed scripts to initialize
    setTimeout(() => {
      if (window.instgrm?.Embeds?.process) window.instgrm.Embeds.process();
      if (window.blueskyEmbed?.load) window.blueskyEmbed.load();
      if (window.ThreadsEmbed?.load) window.ThreadsEmbed.load();
    }, 100);
  }, [embeds]);

  return <div ref={containerRef} className="social-embeds" />;
}
