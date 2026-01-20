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
    // Prevent double-firing in Strict Mode
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
  // If it is a simple iframe (like Threads), render directly
  if (html.includes('<iframe') || platform.toLowerCase().includes('threads')) {
     return <div className="social-embed" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Use the safe renderer for scripts
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

    // --- CRITICAL FIX: NUKE document.write ---
    // This prevents legacy scripts (like LinkedIn/Facebook) from crashing Next.js
    // by trying to write to a closed document stream.
    
    // We cast to 'any' to bypass TypeScript's read-only check without using @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).write = () => { console.warn('Blocked dangerous document.write call from embed'); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).writeln = () => { console.warn('Blocked dangerous document.writeln call from embed'); };

    // 1. Set content
    ref.innerHTML = html;

    // 2. Execute scripts safely
    const scripts = ref.querySelectorAll("script");
    scripts.forEach(oldScript => {
      const newScript = document.createElement("script");
      
      // Copy attributes
      Array.from(oldScript.attributes).forEach(attr =>
        newScript.setAttribute(attr.name, attr.value)
      );
      
      // Copy content
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