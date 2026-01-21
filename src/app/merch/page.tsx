// src/app/merch/page.tsx

import React from 'react';

const stores = [
  {
    name: "Official Shop",
    description: "Apparel, accessories, and exclusive Dead Wax Dialogues gear.",
    url: "https://shop.deadwaxdialogues.com",
    icon: "👕"
  },
  {
    name: "Discogs Store",
    description: "Browse our curated selection of vintage vinyl and rare finds.",
    url: "https://www.discogs.com/seller/deadwaxdialogues",
    icon: "💿"
  },
  {
    name: "eBay Collection",
    description: "Special auctions and unique collectibles.",
    url: "https://www.ebay.com/usr/deadwaxdialogues",
    icon: "📦"
  }
];

export default function MerchPage() {
  return (
    <div className="bg-white min-h-screen">
      <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
          <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">Merch & Media</h1>
        </div>
      </header>

      <main className="container-responsive py-16">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Support the Dialogues</h2>
          <p className="text-lg text-gray-600">
            Find our latest vinyl drops and official merchandise across our various marketplaces.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
          {stores.map((store) => (
            <a
              key={store.name}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center hover:bg-white hover:border-[#00c4ff] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {store.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#00c4ff]">
                {store.name}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {store.description}
              </p>
              <span className="inline-block bg-zinc-900 text-white px-6 py-2 rounded-full text-sm font-bold group-hover:bg-[#00c4ff] group-hover:text-black transition-colors">
                Shop Now
              </span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}