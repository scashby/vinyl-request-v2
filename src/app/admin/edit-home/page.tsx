// src/app/admin/edit-home/page.tsx - Admin interface for editing homepage content
//
// Edits the `homepage_sections` table (sql/create-homepage-sections.sql).
// Each card below is one section; Save only writes that section's row.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import AdminImageSelectorModal from "src/components/admin/AdminImageSelectorModal";
import {
  DEFAULT_SECTIONS,
  SECTION_LABELS,
  SECTION_TYPES,
  type BioData,
  type ConnectData,
  type DialoguesTeaserData,
  type EventsStripData,
  type GameDeckData,
  type HeroData,
  type HomepageSection,
  type ResidencyData,
  type SectionType,
  type SocialLink,
} from "src/lib/homeContent";
import { DEFAULT_THEME, THEMES, isThemeName, type ThemeName } from "src/lib/theme";

function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeName>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<ThemeName | null>(null);

  useEffect(() => {
    fetch("/api/site-theme")
      .then((res) => res.json())
      .then((data) => {
        if (isThemeName(data?.theme)) setActive(data.theme);
      })
      .catch((err) => console.error("Error loading active theme:", err))
      .finally(() => setLoading(false));
  }, []);

  const apply = async (name: ThemeName) => {
    setApplying(name);
    try {
      const res = await fetch("/api/site-theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: name }),
      });
      if (res.ok) setActive(name);
    } catch (err) {
      console.error("Error applying theme:", err);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Site Theme</h2>
      <p className="text-sm text-gray-600 mb-4">
        Switch the whole site&rsquo;s look — colors, fonts, and card style — between the three saved directions. Takes
        effect immediately, everywhere (nav, footer, homepage).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.values(THEMES).map((t) => {
          const isActive = !loading && active === t.name;
          return (
            <button
              key={t.name}
              onClick={() => apply(t.name)}
              disabled={applying !== null}
              className={`text-left rounded-lg border-2 p-4 transition-colors disabled:opacity-60 ${
                isActive ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex gap-1.5 mb-3">
                {[t.bg, t.accent1, t.accent2, t.accent3, t.ink].map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
              <div className="font-bold text-sm text-gray-900 mb-1">
                {t.label} {isActive && <span className="text-blue-600 font-normal">(active)</span>}
              </div>
              <div className="text-xs text-gray-600 leading-relaxed">{t.blurb}</div>
              {applying === t.name && <div className="text-xs text-blue-600 mt-2">Applying…</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {multiline ? (
        <textarea className={inputClass} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function PhotoField({
  label,
  url,
  onChoose,
  onClear,
}: {
  label: string;
  url: string;
  onChoose: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 rounded-lg border border-gray-300 bg-gray-50 overflow-hidden shrink-0">
          {url ? (
            <Image src={url} alt="" fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
              No photo
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onChoose}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Choose or upload photo
          </button>
          {url && (
            <button
              type="button"
              onClick={onClear}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  type,
  visible,
  onToggleVisible,
  onSave,
  saving,
  saved,
  children,
}: {
  type: SectionType;
  visible: boolean;
  onToggleVisible: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">{SECTION_LABELS[type]}</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={visible} onChange={(e) => onToggleVisible(e.target.checked)} className="w-4 h-4" />
          Visible on site
        </label>
      </div>
      <div className="space-y-4">{children}</div>
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved</span>}
      </div>
    </div>
  );
}

interface SectionState<T> {
  id: number | null;
  visible: boolean;
  data: T;
}

function useSectionState<T>(fallback: T): [SectionState<T>, (s: SectionState<T>) => void] {
  return useState<SectionState<T>>({ id: null, visible: true, data: fallback });
}

export default function EditHomePage() {
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [savingType, setSavingType] = useState<SectionType | null>(null);
  const [savedType, setSavedType] = useState<SectionType | null>(null);

  const [hero, setHero] = useSectionState<HeroData>(DEFAULT_SECTIONS.hero);
  const [residency, setResidency] = useSectionState<ResidencyData>(DEFAULT_SECTIONS.residency);
  const [eventsStrip, setEventsStrip] = useSectionState<EventsStripData>(DEFAULT_SECTIONS.events_strip);
  const [bio, setBio] = useSectionState<BioData>(DEFAULT_SECTIONS.bio);
  const [gameDeck, setGameDeck] = useSectionState<GameDeckData>(DEFAULT_SECTIONS.game_deck);
  const [dialoguesTeaser, setDialoguesTeaser] = useSectionState<DialoguesTeaserData>(DEFAULT_SECTIONS.dialogues_teaser);
  const [connect, setConnect] = useSectionState<ConnectData>(DEFAULT_SECTIONS.connect);
  const [photoModalTarget, setPhotoModalTarget] = useState<"hero" | "game_deck" | null>(null);

  useEffect(() => {
    fetch("/api/homepage-sections?page=home")
      .then(async (res) => {
        if (!res.ok) {
          setMigrationMissing(true);
          return [];
        }
        return res.json();
      })
      .then((rows: HomepageSection<Record<string, unknown>>[]) => {
        if (!Array.isArray(rows) || rows.length === 0) {
          setMigrationMissing(true);
          return;
        }
        const byType = new Map(rows.map((r) => [r.section_type, r]));
        const load = <T extends object>(type: SectionType, fallback: T) => {
          const row = byType.get(type);
          if (!row) return { id: null, visible: true, data: fallback };
          return { id: row.id, visible: row.visible, data: { ...fallback, ...(row.data as Partial<T>) } };
        };
        setHero(load("hero", DEFAULT_SECTIONS.hero));
        setResidency(load("residency", DEFAULT_SECTIONS.residency));
        setEventsStrip(load("events_strip", DEFAULT_SECTIONS.events_strip));
        setBio(load("bio", DEFAULT_SECTIONS.bio));
        setGameDeck(load("game_deck", DEFAULT_SECTIONS.game_deck));
        setDialoguesTeaser(load("dialogues_teaser", DEFAULT_SECTIONS.dialogues_teaser));
        setConnect(load("connect", DEFAULT_SECTIONS.connect));
      })
      .catch((err) => {
        console.error("Error loading homepage sections:", err);
        setMigrationMissing(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (type: SectionType, state: SectionState<unknown>) => {
    if (!state.id) return;
    setSavingType(type);
    setSavedType(null);
    try {
      const res = await fetch(`/api/homepage-sections/${state.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: state.data, visible: state.visible }),
      });
      if (res.ok) setSavedType(type);
    } catch (err) {
      console.error(`Error saving ${type}:`, err);
    } finally {
      setSavingType(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">Edit Home Page</h1>
      <p className="text-sm text-gray-600 mb-6">
        Section order is fixed for now (hero → residency → coming up → bio → game deck → dialogues → connect).
        Events come from{" "}
        <a href="/admin/manage-events" className="text-blue-600 hover:underline">
          Manage Events
        </a>
        , and Dialogues posts come from Substack. The Connect section&rsquo;s Spotify block always
        links out to the Spotify URL set below.
      </p>

      <ThemeSwitcher />

      {migrationMissing && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-4 mb-6 text-sm">
          The <code>homepage_sections</code> table doesn&rsquo;t exist yet (or has no rows), so this page is showing
          defaults it can&rsquo;t save. Run <code>sql/create-homepage-sections.sql</code> in the Supabase SQL editor,
          then reload this page.
        </div>
      )}

      <SectionCard
        type="hero"
        visible={hero.visible}
        onToggleVisible={(v) => setHero({ ...hero, visible: v })}
        onSave={() => save("hero", hero)}
        saving={savingType === "hero"}
        saved={savedType === "hero"}
      >
        <Field label="Eyebrow" value={hero.data.eyebrow} onChange={(v) => setHero({ ...hero, data: { ...hero.data, eyebrow: v } })} />
        <Field
          label="Headline (use {night} / {venue} to pull from Residency below)"
          value={hero.data.headline}
          onChange={(v) => setHero({ ...hero, data: { ...hero.data, headline: v } })}
        />
        <Field label="Subhead" value={hero.data.subhead} onChange={(v) => setHero({ ...hero, data: { ...hero.data, subhead: v } })} multiline />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary button label" value={hero.data.primary_cta_label} onChange={(v) => setHero({ ...hero, data: { ...hero.data, primary_cta_label: v } })} />
          <Field label="Primary button link" value={hero.data.primary_cta_href} onChange={(v) => setHero({ ...hero, data: { ...hero.data, primary_cta_href: v } })} />
          <Field label="Secondary button label" value={hero.data.secondary_cta_label} onChange={(v) => setHero({ ...hero, data: { ...hero.data, secondary_cta_label: v } })} />
          <Field label="Secondary button link" value={hero.data.secondary_cta_href} onChange={(v) => setHero({ ...hero, data: { ...hero.data, secondary_cta_href: v } })} />
        </div>
        <PhotoField
          label="Hero photo"
          url={hero.data.photo_url}
          onChoose={() => setPhotoModalTarget("hero")}
          onClear={() => setHero({ ...hero, data: { ...hero.data, photo_url: "" } })}
        />
        <Field
          label="Placeholder text (shown until a photo is added above)"
          value={hero.data.photo_placeholder_text}
          onChange={(v) => setHero({ ...hero, data: { ...hero.data, photo_placeholder_text: v } })}
        />
      </SectionCard>

      <SectionCard
        type="residency"
        visible={residency.visible}
        onToggleVisible={(v) => setResidency({ ...residency, visible: v })}
        onSave={() => save("residency", residency)}
        saving={savingType === "residency"}
        saved={savedType === "residency"}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Night" value={residency.data.night} onChange={(v) => setResidency({ ...residency, data: { ...residency.data, night: v } })} />
          <Field label="Venue" value={residency.data.venue} onChange={(v) => setResidency({ ...residency, data: { ...residency.data, venue: v } })} />
        </div>
        <Field label="Eyebrow label" value={residency.data.eyebrow} onChange={(v) => setResidency({ ...residency, data: { ...residency.data, eyebrow: v } })} />
        <Field label="Description" value={residency.data.description} onChange={(v) => setResidency({ ...residency, data: { ...residency.data, description: v } })} multiline />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Button label" value={residency.data.cta_label} onChange={(v) => setResidency({ ...residency, data: { ...residency.data, cta_label: v } })} />
          <Field label="Button link (e.g. a maps URL)" value={residency.data.cta_href} onChange={(v) => setResidency({ ...residency, data: { ...residency.data, cta_href: v } })} />
        </div>
      </SectionCard>

      <SectionCard
        type="events_strip"
        visible={eventsStrip.visible}
        onToggleVisible={(v) => setEventsStrip({ ...eventsStrip, visible: v })}
        onSave={() => save("events_strip", eventsStrip)}
        saving={savingType === "events_strip"}
        saved={savedType === "events_strip"}
      >
        <Field label="Heading" value={eventsStrip.data.heading} onChange={(v) => setEventsStrip({ ...eventsStrip, data: { ...eventsStrip.data, heading: v } })} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Link label" value={eventsStrip.data.cta_label} onChange={(v) => setEventsStrip({ ...eventsStrip, data: { ...eventsStrip.data, cta_label: v } })} />
          <Field label="Link href" value={eventsStrip.data.cta_href} onChange={(v) => setEventsStrip({ ...eventsStrip, data: { ...eventsStrip.data, cta_href: v } })} />
        </div>
        <Field
          label="Empty state text (shown when there are no upcoming events; use {night} / {venue})"
          value={eventsStrip.data.empty_state_text}
          onChange={(v) => setEventsStrip({ ...eventsStrip, data: { ...eventsStrip.data, empty_state_text: v } })}
          multiline
        />
      </SectionCard>

      <SectionCard
        type="bio"
        visible={bio.visible}
        onToggleVisible={(v) => setBio({ ...bio, visible: v })}
        onSave={() => save("bio", bio)}
        saving={savingType === "bio"}
        saved={savedType === "bio"}
      >
        <Field label="Eyebrow label" value={bio.data.eyebrow} onChange={(v) => setBio({ ...bio, data: { ...bio.data, eyebrow: v } })} />
        <Field label="Bio text (use {venue})" value={bio.data.body} onChange={(v) => setBio({ ...bio, data: { ...bio.data, body: v } })} multiline />
      </SectionCard>

      <SectionCard
        type="game_deck"
        visible={gameDeck.visible}
        onToggleVisible={(v) => setGameDeck({ ...gameDeck, visible: v })}
        onSave={() => save("game_deck", gameDeck)}
        saving={savingType === "game_deck"}
        saved={savedType === "game_deck"}
      >
        <Field label="Eyebrow label" value={gameDeck.data.eyebrow} onChange={(v) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, eyebrow: v } })} />
        <Field label="Headline" value={gameDeck.data.headline} onChange={(v) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, headline: v } })} />
        <Field label="Body" value={gameDeck.data.body} onChange={(v) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, body: v } })} multiline />
        <div>
          <label className={labelClass}>Game chips (one per line)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={gameDeck.data.chips.join("\n")}
            onChange={(e) =>
              setGameDeck({ ...gameDeck, data: { ...gameDeck.data, chips: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Button label" value={gameDeck.data.cta_label} onChange={(v) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, cta_label: v } })} />
          <Field label="Button link" value={gameDeck.data.cta_href} onChange={(v) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, cta_href: v } })} />
        </div>
        <PhotoField
          label="Photo"
          url={gameDeck.data.photo_url}
          onChoose={() => setPhotoModalTarget("game_deck")}
          onClear={() => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, photo_url: "" } })}
        />
        <Field
          label="Placeholder text (shown until a photo is added above)"
          value={gameDeck.data.photo_placeholder_text}
          onChange={(v) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, photo_placeholder_text: v } })}
        />
      </SectionCard>

      <SectionCard
        type="dialogues_teaser"
        visible={dialoguesTeaser.visible}
        onToggleVisible={(v) => setDialoguesTeaser({ ...dialoguesTeaser, visible: v })}
        onSave={() => save("dialogues_teaser", dialoguesTeaser)}
        saving={savingType === "dialogues_teaser"}
        saved={savedType === "dialogues_teaser"}
      >
        <Field label="Heading" value={dialoguesTeaser.data.heading} onChange={(v) => setDialoguesTeaser({ ...dialoguesTeaser, data: { ...dialoguesTeaser.data, heading: v } })} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Link label" value={dialoguesTeaser.data.cta_label} onChange={(v) => setDialoguesTeaser({ ...dialoguesTeaser, data: { ...dialoguesTeaser.data, cta_label: v } })} />
          <Field label="Link href" value={dialoguesTeaser.data.cta_href} onChange={(v) => setDialoguesTeaser({ ...dialoguesTeaser, data: { ...dialoguesTeaser.data, cta_href: v } })} />
        </div>
      </SectionCard>

      <SectionCard
        type="connect"
        visible={connect.visible}
        onToggleVisible={(v) => setConnect({ ...connect, visible: v })}
        onSave={() => save("connect", connect)}
        saving={savingType === "connect"}
        saved={savedType === "connect"}
      >
        <Field label="Heading" value={connect.data.heading} onChange={(v) => setConnect({ ...connect, data: { ...connect.data, heading: v } })} />
        <Field label="Subhead" value={connect.data.subhead} onChange={(v) => setConnect({ ...connect, data: { ...connect.data, subhead: v } })} />
        <div>
          <label className={labelClass}>Social links (also used in the site footer)</label>
          <div className="space-y-2">
            {connect.data.socials.map((social: SocialLink, i: number) => (
              <div key={i} className="flex gap-2">
                <input
                  className={`${inputClass} !w-32 flex-shrink-0`}
                  placeholder="Name"
                  value={social.name}
                  onChange={(e) => {
                    const next = [...connect.data.socials];
                    next[i] = { ...next[i], name: e.target.value };
                    setConnect({ ...connect, data: { ...connect.data, socials: next } });
                  }}
                />
                <input
                  className={`${inputClass} flex-1 min-w-0`}
                  placeholder="URL"
                  value={social.url}
                  onChange={(e) => {
                    const next = [...connect.data.socials];
                    next[i] = { ...next[i], url: e.target.value };
                    setConnect({ ...connect, data: { ...connect.data, socials: next } });
                  }}
                />
                <button
                  onClick={() => {
                    const next = connect.data.socials.filter((_: SocialLink, idx: number) => idx !== i);
                    setConnect({ ...connect, data: { ...connect.data, socials: next } });
                  }}
                  className="text-red-600 hover:text-red-800 text-sm px-2"
                  aria-label={`Remove ${social.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setConnect({ ...connect, data: { ...connect.data, socials: [...connect.data.socials, { name: "", url: "" }] } })}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            + Add social link
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Recognized names get a matching icon: Spotify, Instagram, Facebook, Threads, Bluesky, Substack, Discogs. Anything
            else gets a generic link icon.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Spotify label (links to the Spotify URL in Social links below)"
            value={connect.data.spotify_fallback_label}
            onChange={(v) => setConnect({ ...connect, data: { ...connect.data, spotify_fallback_label: v } })}
          />
          <Field
            label="Spotify fallback sublabel"
            value={connect.data.spotify_fallback_sublabel}
            onChange={(v) => setConnect({ ...connect, data: { ...connect.data, spotify_fallback_sublabel: v } })}
          />
        </div>
      </SectionCard>

      <p className="text-xs text-gray-400 mt-2">
        Sections shown: {SECTION_TYPES.length}. Reordering/adding/removing sections isn&rsquo;t available yet — coming
        in a later pass.
      </p>

      <AdminImageSelectorModal
        isOpen={photoModalTarget === "hero"}
        imageKind="homepageImage"
        title="Select hero photo"
        selectedUrl={hero.data.photo_url}
        onClose={() => setPhotoModalTarget(null)}
        onSelect={(publicUrl) => setHero({ ...hero, data: { ...hero.data, photo_url: publicUrl } })}
      />

      <AdminImageSelectorModal
        isOpen={photoModalTarget === "game_deck"}
        imageKind="homepageImage"
        title="Select Vinyl Game Deck photo"
        selectedUrl={gameDeck.data.photo_url}
        onClose={() => setPhotoModalTarget(null)}
        onSelect={(publicUrl) => setGameDeck({ ...gameDeck, data: { ...gameDeck.data, photo_url: publicUrl } })}
      />
    </div>
  );
}
