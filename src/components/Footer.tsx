"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSocialIcon } from "src/lib/socialIcons";
import { DEFAULT_SECTIONS, type ConnectData, type HomepageSection } from "src/lib/homeContent";
import { DEFAULT_THEME, THEMES, isThemeName, toCssVars, type ThemeName } from "src/lib/theme";

// Email is a fixed footer utility link, not part of the editable "socials"
// list (which is shared with the homepage Connect section via
// /admin/edit-home) — it's always appended last.
const EMAIL_LINK = { name: "Email", url: "mailto:steve@deadwaxdialogues.com" };

export default function Footer() {
  const pathname = usePathname();
  const [connectData, setConnectData] = useState<ConnectData>(DEFAULT_SECTIONS.connect);
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    fetch("/api/homepage-sections?page=home")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: HomepageSection<Partial<ConnectData>>[]) => {
        const connectRow = rows.find((r) => r.section_type === "connect");
        if (connectRow) setConnectData({ ...DEFAULT_SECTIONS.connect, ...connectRow.data });
      })
      .catch((err) => console.error("Error loading footer social links:", err));
  }, []);

  useEffect(() => {
    fetch("/api/site-theme")
      .then((res) => res.json())
      .then((data) => {
        if (isThemeName(data?.theme)) setThemeName(data.theme);
      })
      .catch((err) => console.error("Error loading active theme:", err));
  }, []);

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/edit-collection")) {
    return null;
  }

  const links = [...connectData.socials, EMAIL_LINK];
  const theme = THEMES[themeName];

  return (
    <footer
      className="bg-[var(--dwd-nav-bg)] text-[var(--dwd-ink)] w-full border-t border-[var(--dwd-ink)]/10"
      style={toCssVars(theme) as React.CSSProperties}
    >
      <div className="container-responsive py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm tracking-wide text-[var(--dwd-ink)]/70 order-2 sm:order-1">
          &copy; {new Date().getFullYear()} Dead Wax Dialogues
        </span>
        <div className="flex gap-2.5 order-1 sm:order-2">
          {links.map(({ name, url }) => {
            const Icon = getSocialIcon(name);
            return (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="w-9 h-9 rounded-full bg-[var(--dwd-ink)]/5 flex items-center justify-center text-[var(--dwd-ink)]/70 transition-colors duration-200 hover:bg-[var(--dwd-ink)] hover:text-[var(--dwd-bg)]"
              >
                <Icon size={16} />
              </a>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
// AUDIT: restyled for v2 brand palette; renders site-wide, self-hides on admin/edit-collection routes, pulls social links from the shared homepage content model, and is now theme-aware via src/lib/theme.ts.
