// src/app/admin/edit-dialogues/page.tsx - Admin interface for editing Dialogues page content
//
// Same homepage_sections table as /admin/edit-home, scoped to page='dialogues'.
// See sql/create-dialogues-sections.sql. The blog posts' title/text come
// live from WordPress and aren't editable here, but each post's card image
// crop/pan/zoom IS editable below (src/lib/dialoguesPostFocus.ts) — that's
// display behavior this site controls, not blog content.

"use client";

import { useEffect, useState } from "react";
import DialoguesPostCropModal from "src/components/admin/DialoguesPostCropModal";
import { postFocusStyle, type PostFocus } from "src/lib/dialoguesPostFocus";

interface BlogPostSummary {
  title: string;
  link: string;
  featuredImageUrl?: string | null;
  postFocus?: PostFocus | null;
  content?: string;
  "content:encoded"?: string;
}

function extractFirstImg(post: BlogPostSummary): string | null {
  if (post.featuredImageUrl) return post.featuredImageUrl;
  const html = post["content:encoded"] || post.content || "";
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match ? match[1] : null;
}

interface DialoguesIntroData {
  heading: string;
  subhead: string;
}

interface DialoguesSidebarData {
  heading: string;
  description: string;
}

const DEFAULT_INTRO: DialoguesIntroData = {
  heading: "Dialogues",
  subhead: "Crate digs, liner notes, and whatever else is on the turntable.",
};

const DEFAULT_SIDEBAR: DialoguesSidebarData = {
  heading: "Follow Along",
  description: "New posts, photos, and the playlist — wherever you already hang out.",
};

const inputClass =
  "w-full bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

interface Row<T> {
  id: number | null;
  data: T;
}

export default function EditDialoguesPage() {
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [intro, setIntro] = useState<Row<DialoguesIntroData>>({ id: null, data: DEFAULT_INTRO });
  const [sidebar, setSidebar] = useState<Row<DialoguesSidebarData>>({ id: null, data: DEFAULT_SIDEBAR });
  const [savingIntro, setSavingIntro] = useState(false);
  const [savingSidebar, setSavingSidebar] = useState(false);
  const [savedIntro, setSavedIntro] = useState(false);
  const [savedSidebar, setSavedSidebar] = useState(false);
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [croppingPost, setCroppingPost] = useState<BlogPostSummary | null>(null);

  useEffect(() => {
    fetch("/api/homepage-sections?page=dialogues")
      .then(async (res) => {
        if (!res.ok) {
          setMigrationMissing(true);
          return [];
        }
        return res.json();
      })
      .then((rows: { id: number; section_type: string; data: Record<string, unknown> }[]) => {
        if (!Array.isArray(rows) || rows.length === 0) {
          setMigrationMissing(true);
          return;
        }
        const introRow = rows.find((r) => r.section_type === "dialogues_intro");
        if (introRow) setIntro({ id: introRow.id, data: { ...DEFAULT_INTRO, ...introRow.data } });
        const sidebarRow = rows.find((r) => r.section_type === "dialogues_sidebar");
        if (sidebarRow) setSidebar({ id: sidebarRow.id, data: { ...DEFAULT_SIDEBAR, ...sidebarRow.data } });
      })
      .catch((err) => {
        console.error("Error loading dialogues sections:", err);
        setMigrationMissing(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/wordpress")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.items)) return;
        setPosts(data.items.slice(0, 9) as BlogPostSummary[]);
      })
      .catch(() => setPostsError("Could not load posts."));
  }, []);

  const savePostFocus = async (post: BlogPostSummary, focus: PostFocus) => {
    try {
      await fetch("/api/admin/dialogues-post-focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: post.link, x: focus.x, y: focus.y, zoom: focus.zoom }),
      });
      setPosts((prev) => prev?.map((p) => (p.link === post.link ? { ...p, postFocus: focus } : p)) ?? prev);
    } catch (err) {
      console.error("Error saving post image crop:", err);
    }
  };

  const saveIntro = async () => {
    if (!intro.id) return;
    setSavingIntro(true);
    setSavedIntro(false);
    try {
      const res = await fetch(`/api/homepage-sections/${intro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: intro.data }),
      });
      if (res.ok) setSavedIntro(true);
    } catch (err) {
      console.error("Error saving dialogues intro:", err);
    } finally {
      setSavingIntro(false);
    }
  };

  const saveSidebar = async () => {
    if (!sidebar.id) return;
    setSavingSidebar(true);
    setSavedSidebar(false);
    try {
      const res = await fetch(`/api/homepage-sections/${sidebar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: sidebar.data }),
      });
      if (res.ok) setSavedSidebar(true);
    } catch (err) {
      console.error("Error saving dialogues sidebar:", err);
    } finally {
      setSavingSidebar(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">Edit Dialogues Page</h1>
      <p className="text-sm text-gray-600 mb-6">
        Edit the header and sidebar text shown on /dialogues. The posts themselves come live from the blog and
        aren&rsquo;t editable here.
      </p>

      {migrationMissing && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-4 mb-6 text-sm">
          The Dialogues page&rsquo;s content rows don&rsquo;t exist yet, so this page is showing defaults it
          can&rsquo;t save. Run <code>sql/create-dialogues-sections.sql</code> in the Supabase SQL editor, then
          reload this page.
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Header</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={intro.data.heading}
              onChange={(e) => setIntro({ ...intro, data: { ...intro.data, heading: e.target.value } })}
            />
          </div>
          <div>
            <label className={labelClass}>Subhead</label>
            <textarea
              className={inputClass}
              rows={2}
              value={intro.data.subhead}
              onChange={(e) => setIntro({ ...intro, data: { ...intro.data, subhead: e.target.value } })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={saveIntro}
            disabled={savingIntro}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {savingIntro ? "Saving…" : "Save"}
          </button>
          {savedIntro && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Sidebar</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={sidebar.data.heading}
              onChange={(e) => setSidebar({ ...sidebar, data: { ...sidebar.data, heading: e.target.value } })}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={inputClass}
              rows={2}
              value={sidebar.data.description}
              onChange={(e) => setSidebar({ ...sidebar, data: { ...sidebar.data, description: e.target.value } })}
            />
          </div>
          <p className="text-xs text-gray-500">
            The social icons shown below this text come from the Connect section on the Home Page editor.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={saveSidebar}
            disabled={savingSidebar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {savingSidebar ? "Saving…" : "Save"}
          </button>
          {savedSidebar && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Post Images</h2>
        <p className="text-sm text-gray-600 mb-4">
          Drag and zoom each post&rsquo;s card image to control exactly how it&rsquo;s framed on the Dialogues page
          and the homepage teaser — the post&rsquo;s title and text still come from the blog, but the crop is
          controlled here.
        </p>

        {postsError ? (
          <p className="text-sm text-red-600">{postsError}</p>
        ) : !posts ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {posts.map((post) => {
              const imgUrl = extractFirstImg(post);
              return (
                <div key={post.link} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly
                      <img
                        src={imgUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full"
                        style={postFocusStyle(post.postFocus)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 mb-2">{post.title}</p>
                    <button
                      type="button"
                      onClick={() => setCroppingPost(post)}
                      disabled={!imgUrl}
                      className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Edit crop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {croppingPost && extractFirstImg(croppingPost) && (
        <DialoguesPostCropModal
          imageUrl={extractFirstImg(croppingPost) as string}
          title={croppingPost.title}
          initialFocus={croppingPost.postFocus}
          onSave={(focus) => savePostFocus(croppingPost, focus)}
          onClose={() => setCroppingPost(null)}
        />
      )}
    </div>
  );
}
