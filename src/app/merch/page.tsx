// src/app/merch/page.tsx
//
// Store list is admin-editable (reuses the homepage_sections table with
// page='merch' — see sql/create-merch-sections.sql — same pattern as the
// homepage's content model), editable at /admin/edit-merch.

"use client";

import { useEffect, useState } from "react";
import { Container } from "components/ui/Container";
import { useActiveTheme } from "src/lib/useActiveTheme";

interface Store {
  name: string;
  description: string;
  url: string;
}

interface MerchIntroData {
  heading: string;
  subhead: string;
}

interface MerchStoresData {
  stores: Store[];
}

const DEFAULT_INTRO: MerchIntroData = {
  heading: "Support The Dialogues",
  subhead: "Find our latest vinyl drops and official merchandise across our various marketplaces.",
};

const DEFAULT_STORES: MerchStoresData = {
  stores: [
    {
      name: "Official Shop",
      description: "Apparel, accessories, and exclusive Dead Wax Dialogues gear.",
      url: "https://shop.deadwaxdialogues.com",
    },
    {
      name: "Discogs Store",
      description: "Browse our curated selection of vintage vinyl and rare finds.",
      url: "https://www.discogs.com/seller/deadwaxdialogues",
    },
    {
      name: "eBay Collection",
      description: "Special auctions and unique collectibles.",
      url: "https://www.ebay.com/usr/deadwaxdialogues",
    },
  ],
};

export default function MerchPage() {
  const [intro, setIntro] = useState<MerchIntroData>(DEFAULT_INTRO);
  const [storesData, setStoresData] = useState<MerchStoresData>(DEFAULT_STORES);
  const { cssVars } = useActiveTheme();

  useEffect(() => {
    fetch("/api/homepage-sections?page=merch")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { section_type: string; data: Record<string, unknown> }[]) => {
        const introRow = rows.find((r) => r.section_type === "merch_intro");
        if (introRow) setIntro({ ...DEFAULT_INTRO, ...introRow.data });
        const storesRow = rows.find((r) => r.section_type === "merch_stores");
        if (storesRow) setStoresData({ ...DEFAULT_STORES, ...storesRow.data });
      })
      .catch((err) => console.error("Error loading merch content:", err));
  }, []);

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-10 md:pt-20 text-center">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-5xl mb-4">
            {intro.heading}
          </div>
          <p className="text-lg text-[var(--dwd-ink-soft)] max-w-2xl mx-auto">{intro.subhead}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
          {storesData.stores.map((store, i) => (
            <a
              key={store.name}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-8 text-center hover:-translate-y-1 transition-transform duration-150 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
              style={{ transform: `rotate(var(--dwd-tilt-${(i % 4) + 1}))` }}
            >
              <div className="text-xl font-bold mb-2 group-hover:text-[var(--dwd-accent-1)] transition-colors">
                {store.name}
              </div>
              <p className="text-[var(--dwd-ink-soft)] text-sm leading-relaxed mb-6">{store.description}</p>
              <span className="inline-block bg-[var(--dwd-ink)] text-[var(--dwd-bg)] px-6 py-2 rounded-full text-sm font-bold group-hover:bg-[var(--dwd-accent-1)] transition-colors">
                Shop Now
              </span>
            </a>
          ))}
        </div>
      </Container>
    </div>
  );
}
// AUDIT: restyled for v2 brand (theme-aware, shared card language); store list now admin-editable at /admin/edit-merch instead of hardcoded.
