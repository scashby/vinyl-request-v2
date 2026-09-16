"use client";

import {
  SiDiscogs,
  SiFacebook,
  SiInstagram,
  SiThreads,
  SiBluesky,
  SiSubstack,
  SiSpotify,
} from "react-icons/si";
import { FiMail } from "react-icons/fi";
import { usePathname } from "next/navigation";

// Shared with the homepage's Connect section — keep this the single source
// of truth for where our social links point.
export const socials = [
  {
    name: "Spotify",
    url: "https://open.spotify.com/user/deadwaxdialogues",
    Icon: SiSpotify,
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/deadwaxdialogues/",
    Icon: SiInstagram,
  },
  {
    name: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61576451743378",
    Icon: SiFacebook,
  },
  {
    name: "Threads",
    url: "https://www.threads.net/@deadwaxdialogues",
    Icon: SiThreads,
  },
  {
    name: "Bluesky",
    url: "https://bsky.app/profile/deadwaxdialogues.bsky.social",
    Icon: SiBluesky,
  },
  {
    name: "Substack",
    url: "https://deadwaxdialogues.substack.com",
    Icon: SiSubstack,
  },
  {
    name: "Discogs",
    url: "https://www.discogs.com/user/socialblunders/collection",
    Icon: SiDiscogs,
  },
  {
    name: "Email",
    url: "mailto:steve@deadwaxdialogues.com",
    Icon: FiMail,
  },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/edit-collection")) {
    return null;
  }

  return (
    <footer className="bg-[#FAF1E1] text-[#2A2118] w-full border-t border-[#2A2118]/10">
      <div className="container-responsive py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm tracking-wide text-[#2A2118]/70 order-2 sm:order-1">
          &copy; {new Date().getFullYear()} Dead Wax Dialogues
        </span>
        <div className="flex gap-2.5 order-1 sm:order-2">
          {socials.map(({ name, url, Icon }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className="w-9 h-9 rounded-full bg-[#2A2118]/5 flex items-center justify-center text-[#2A2118]/70 transition-colors duration-200 hover:bg-[#2A2118] hover:text-[#FAF1E1]"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
// AUDIT: restyled for v2 brand palette; now renders site-wide (was previously orphaned) and self-hides on admin/edit-collection routes.
