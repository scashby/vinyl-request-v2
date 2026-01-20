'use client';

import { useEffect, useState, useRef } from "react";

interface SocialEmbedData {
  id: number;
  platform: string;
  embed_html: string;
  visible: boolean;
}

export default function SocialEmbeds() {
  const [embeds, setEmbeds] = useState<SocialEmbedData[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    fetch("/api/social-embeds")
      .then(res => res.json())
      .then((data: SocialEmbedData[]) => {
        setEmbeds(data || []);
      })
      .catch(err => console.error("Failed to load social embeds:", err));
  }, []);

  return (
    <div className="social-embeds space-y-4">
      {embeds.filter(e => e.visible).map((embed) => (
        <SafeEmbed key={embed.id} html={embed.embed_html} platform={embed.platform} />
      ))}
    </div>
  );
}

function SafeEmbed({ html, platform }: { html: string, platform: string }) {
  // Fix 1: Remove conflicting 'allowfullscreen' attributes that cause browser warnings
  const cleanHtml = html
    .replace(/allowfullscreen="?"/g, '') 
    .replace(/allowfullscreen/g, '');

  // If it's a simple iframe (Threads, Spotify, Apple), render directly
  if (html.includes('<iframe') || platform.toLowerCase().includes('threads')) {
     return <div className="social-embed" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  }

  // Use the safe renderer for script-based embeds (Facebook, LinkedIn)
  return (
    <div className="social-embed">
      <SafeHtml html={cleanHtml} />
    </div>
  );
}

function SafeHtml({ html }: { html: string }) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    ref.innerHTML = html;

    const scripts = ref.querySelectorAll("script");
    scripts.forEach(oldScript => {
      // Fix 2: Safety check for document.write
      // In a SPA, document.write clears the page. We must prevent execution if present.
      if (oldScript.textContent?.includes('document.write')) {
        console.error("Skipped a script that uses document.write to prevent app crash.");
        return; 
      }

      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(attr =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.textContent = oldScript.textContent;
      
      try {
        oldScript.replaceWith(newScript);
      } catch (err) {
        console.error("Error activating script:", err);
      }
    });
  }, [html, ref]);

  return <div ref={setRef} />;
}