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
  // FIX: Regex to remove attributes that cause browser warnings (Fixes "Allow attribute" error)
  const cleanHtml = html
    .replace(/allowfullscreen="?"/g, '') 
    .replace(/allowfullscreen/g, '');    

  // Simple iframes (Threads, Spotify, etc) render directly
  if (html.includes('<iframe') || platform.toLowerCase().includes('threads')) {
     return <div className="social-embed" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  }

  // Complex scripts (LinkedIn, Facebook) go through the safe renderer
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

    // FIX: Neutralize document.write to prevent app crash
    // We strictly override it only within this scope context to prevent the 'in.js' crash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).write = () => { /* Prevent execution */ };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).writeln = () => { /* Prevent execution */ };

    ref.innerHTML = html;

    const scripts = ref.querySelectorAll("script");
    scripts.forEach(oldScript => {
      // Double safety check
      if (oldScript.textContent?.includes('document.write')) {
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