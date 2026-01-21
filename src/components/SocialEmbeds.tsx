// src/components/SocialEmbeds.tsx
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
  // Fix: Clean HTML to remove Allow attribute errors
  const cleanHtml = html
    .replace(/allowfullscreen="?"/g, '')
    .replace(/allowfullscreen/g, '');

  if (html.includes('<iframe') || platform.toLowerCase().includes('threads')) {
     return <div className="social-embed" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  }

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

    // FIX: Neutralize document.write to prevent app crash from legacy scripts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).write = () => {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).writeln = () => {};

    ref.innerHTML = html;

    const scripts = ref.querySelectorAll("script");
    scripts.forEach(oldScript => {
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
      } catch {
        // Suppress activation errors
      }
    });
  }, [html, ref]);

  return <div ref={setRef} />;
}