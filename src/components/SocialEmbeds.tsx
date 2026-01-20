'use client';

import { useEffect, useRef } from "react";

interface SocialEmbedData {
  id: number;
  platform: string;
  embed_html: string;
  visible: boolean;
}

export default function SocialEmbeds() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/social-embeds")
      .then(res => res.json())
      .then((data: SocialEmbedData[]) => {
        if (!isMounted || !containerRef.current) return;

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
                
                // Copy attributes
                Array.from(oldScript.attributes).forEach(attr =>
                  newScript.setAttribute(attr.name, attr.value)
                );
                
                // Copy content
                newScript.textContent = oldScript.textContent;

                // FIX: Check for dangerous document.write usage which crashes Next.js
                if (newScript.textContent?.includes('document.write')) {
                  console.warn('Blocked script containing document.write in SocialEmbeds');
                  return;
                }

                // Safely replace the script
                try {
                   oldScript.replaceWith(newScript);
                } catch (err) {
                   console.error("Error activating embed script:", err);
                }
              });
            }

            containerRef.current?.appendChild(wrapper);
          });
      })
      .catch(err => console.error("Failed to load social embeds:", err));

      return () => {
        isMounted = false;
      };
  }, []);

  return <div ref={containerRef} className="social-embeds space-y-4" />;
}