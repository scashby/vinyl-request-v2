'use client';

import { useEffect, useState, useRef } from "react";

interface SocialEmbedData {
  id: number;
  platform: string;
  embed_html: string;
  visible: boolean;
}

export default function SocialEmbeds() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then((data: SocialEmbedData[]) => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = "";

        data
          .filter(e => e.visible)
          .forEach((embed) => {
            const wrapper = document.createElement("div");
            wrapper.className = "social-embed";

            // Detect Threads
            const isThreads = embed.embed_html.includes("threads.net") || embed.embed_html.includes("threads.com");

            if (isThreads) {
              const iframe = document.createElement("iframe");
              iframe.srcdoc = embed.embed_html;
              iframe.width = "100%";
              iframe.height = "600";
              iframe.style.border = "none";
              iframe.loading = "lazy";
              wrapper.appendChild(iframe);
            } else {
              wrapper.innerHTML = embed.embed_html;

              // Re-run any <script> tags for non-Threads embeds
              const scripts = wrapper.querySelectorAll("script");
              scripts.forEach(oldScript => {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr =>
                  newScript.setAttribute(attr.name, attr.value)
                );
                newScript.textContent = oldScript.textContent;
                oldScript.replaceWith(newScript);
              });
            }

            containerRef.current?.appendChild(wrapper);
          });
      });
  }, []);

  return <div ref={containerRef} className="social-embeds" />;
}