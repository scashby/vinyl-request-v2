import {
  SiDiscogs,
  SiFacebook,
  SiInstagram,
  SiThreads,
  SiBluesky,
  SiSubstack,
} from "react-icons/si";
import { FiMail } from "react-icons/fi";

const socials = [
  {
    name: "Discogs",
    url: "https://www.discogs.com/user/socialblunders/collection",
    icon: <SiDiscogs size="18" color="#222" />,
  },
  {
    name: "Email",
    url: "mailto:steve@deadwaxdialogues.com",
    icon: <FiMail size="18" color="#222" />,
  },
  {
    name: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61576451743378",
    icon: <SiFacebook size="18" color="#222" />,
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/deadwaxdialogues/",
    icon: <SiInstagram size="18" color="#222" />,
  },
  {
    name: "Threads",
    url: "https://www.threads.net/@deadwaxdialogues",
    icon: <SiThreads size="18" color="#222" />,
  },
  {
    name: "Bluesky",
    url: "https://bsky.app/profile/deadwaxdialogues.bsky.social",
    icon: <SiBluesky size="18" color="#222" />,
  },
  {
    name: "Substack",
    url: "https://deadwaxdialogues.substack.com",
    icon: <SiSubstack size="18" color="#222" />,
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#f3f3f3] text-[#222] text-[15px] w-full border-t border-[#e2e2e2] min-h-[36px] relative">
      {/* Absolutely positioned right-side icon row */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2.5 z-[2]">
        {socials.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="opacity-[0.68] transition-opacity duration-200 hover:opacity-100"
          >
            {s.icon}
          </a>
        ))}
      </div>
      {/* Centered copyright */}
      <div className="max-w-[1140px] mx-auto h-[36px] flex items-center justify-center relative z-[1]">
        <span className="w-full text-center font-normal tracking-wide text-[#222]">
          &copy; {new Date().getFullYear()} Dead Wax Dialogues
        </span>
      </div>
    </footer>
  );
}
// AUDIT: inspected, no changes.
