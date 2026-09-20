// src/components/DialoguesPostImage.tsx
//
// Renders a Dialogues post photo with a saved pan/zoom applied, using the
// same postImageGeometry() the crop editor draws with — so what the editor
// showed inside its display area is literally what ships here. Drops into
// any `relative ... overflow-hidden` box and fills it.
"use client";

import { useEffect, useRef, useState } from "react";
import { postImageStyle } from "src/lib/dialoguesPostFocus";

type Size = { width: number; height: number };

type Props = {
  src: string;
  alt: string;
  focus: unknown;
};

export default function DialoguesPostImage({ src, alt, focus }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- explicit pixel geometry, which next/image's own sizing would override */}
      <img
        src={src}
        alt={alt}
        onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        style={postImageStyle(focus, box, natural)}
      />
    </div>
  );
}
