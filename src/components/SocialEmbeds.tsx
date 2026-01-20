// src/components/SocialEmbeds.tsx
'use client';

import { useEffect, useState } from "react";

interface SocialEmbedData {
  id: number;
  platform: string;
  embed_html: string;
  visible: boolean;
}

export default function SocialEmbeds() {
  const [embeds, setEmbeds] = useState<SocialEmbedData[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then((data: SocialEmbedData[]) => {
        if (isMounted) setEmbeds(data);
      })
      .catch(err => console.error("Failed to load social embeds:", err));
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="social-embeds space-y-4">
      {embeds.filter(e => e.visible).map((embed) => (
        <SafeEmbed key={embed.id} html={embed.embed_html} platform={embed.platform} />
      ))}
    </div>
  );
}

// Sub-component to safely handle script injection and iframe isolation
function SafeEmbed({ html, platform }: { html: string, platform: string }) {
  // If it's a Threads or simple iframe embed, render it directly
  if (html.includes('<iframe') || platform.toLowerCase() === 'threads') {
     return <div className="social-embed" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // For Facebook and others that use document.write or sensitive scripts, 
  // we render them in a shadow/iframe context or safe div
  return (
    <div className="social-embed">
      <SafeHtml html={html} />
    </div>
  );
}

function SafeHtml({ html }: { html: string }) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    // 1. Reset content
    ref.innerHTML = html;

    // 2. Scan for scripts
    const scripts = ref.querySelectorAll("script");
    scripts.forEach(oldScript => {
      // Check for dangerous document.write usage
      if (oldScript.textContent?.includes('document.write')) {
        console.warn('Blocked script containing document.write to prevent crash.');
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