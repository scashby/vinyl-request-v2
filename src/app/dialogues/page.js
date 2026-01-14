// Dialogues page ("/dialogues")
// Lists all WordPress articles (with tag/category badges), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

function extractFirstImg(post) {
  const html = post["content:encoded"] || post.content || "";
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  if (match) return match[1];
  return null;
}

function Tags({ categories }) {
  if (!categories || !categories.length) return null;
  
  const getColorClass = (cat) => {
    const c = cat.toLowerCase();
    if (c === 'featured') return 'text-purple-600';
    if (c === 'playlist') return 'text-red-600';
    if (c === 'blog') return 'text-green-600';
    if (c === 'news') return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {categories.map((cat, i) => (
        <span key={i} className={`font-bold text-xs uppercase tracking-wider ${getColorClass(cat)}`}>
          {cat.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

export default function DialoguesPage() {
  const [featured, setFeatured] = useState(null);
  const [articles, setArticles] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    fetch("/api/playlists")
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);
  
  useEffect(() => {
    fetch("/api/wordpress")
      .then(res => res.json())
      .then(data => {
        if (!data.items || !Array.isArray(data.items)) return;

        const items = data.items.map(p => ({
          ...p,
          link: p.guid || p.link
        }));

        const featuredItem = items.find(item =>
          item.categories?.map(c => c.toLowerCase()).includes("featured")
        );
        setFeatured(featuredItem);

        const rest = items.filter(item => item !== featuredItem);
        setArticles(rest);
      });
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
          <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">Dialogues</h1>
        </div>
      </header>
      
      <main className="container-responsive py-12">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* Main Content */}
          <div className="flex-1 min-w-0 w-full">
            {featured && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden mb-10 flex flex-col md:flex-row">
                <div className="md:w-1/2 relative h-64 md:h-auto">
                  <Image
                    src={extractFirstImg(featured) || "/images/fallback.jpg"}
                    alt={featured.title}
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
                <div className="p-8 md:w-1/2 flex flex-col justify-center">
                  <div className="mb-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-purple-600">FEATURED</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 leading-tight">
                    <a href={featured.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                      {featured.title}
                    </a>
                  </h2>
                  <div className="text-sm text-gray-500 mb-4">
                    {featured.pubDate
                      ? new Date(featured.pubDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric"
                        })
                      : ""}
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-6 line-clamp-3">
                    {featured.contentSnippet || ""}
                  </p>
                  <a
                    href={featured.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Read more →
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((post) => (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col" key={post.guid || post.link}>
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col h-full"
                  >
                    <div className="relative h-48 w-full">
                      <Image
                        src={extractFirstImg(post) || "/images/fallback.jpg"}
                        alt={post.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <Tags categories={post.categories} />
                      <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug line-clamp-2">
                        {post.title}
                      </h3>
                      <div className="text-xs text-gray-500 mb-3">
                        {post.pubDate ? new Date(post.pubDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric"
                        }) : ""}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                        {post.contentSnippet || ""}
                      </p>
                      <span className="text-blue-600 text-sm font-semibold mt-auto">
                        Read more →
                      </span>
                    </div>
                  </a>
                </div>
              ))}
            </div>

            {articles.length > 9 && (
              <div className="mt-12 text-center">
                <a
                  href="https://blog.deadwaxdialogues.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline text-lg"
                >
                  View more on Substack →
                </a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-[320px] flex-shrink-0 space-y-8 bg-purple-50/50 p-6 rounded-2xl border border-purple-100">
            <div>
              <h3 className="text-lg font-bold text-purple-800 mb-4 border-b border-purple-200 pb-2">
                Playlists
              </h3>
              <div className="space-y-6">
                {playlists.map((p) => (
                  <div key={p.platform}>
                    <div className="text-sm font-bold text-purple-900 mb-2 uppercase tracking-wide">
                      {p.platform}
                    </div>
                    <div className="rounded-lg overflow-hidden shadow-sm bg-white" dangerouslySetInnerHTML={{ __html: p.embed_url }} />
                  </div>
                ))}
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
