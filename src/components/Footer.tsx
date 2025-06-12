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
    <footer
      style={{
        background: "#f3f3f3",
        color: "#222",
        fontSize: "15px",
        width: "100%",
        borderTop: "1px solid #e2e2e2",
        minHeight: "36px",
        position: "relative",
      }}
    >
      {/* Absolutely positioned right-side icon row */}
      <div
        style={{
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          gap: "10px",
          zIndex: 2,
        }}
      >
        {socials.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            style={{ opacity: 0.68, transition: "opacity 0.2s" }}
          >
            {s.icon}
          </a>
        ))}
      </div>
      {/* Centered copyright */}
      <div
        style={{
          maxWidth: "1140px",
          margin: "0 auto",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            width: "100%",
            textAlign: "center",
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: "#222",
          }}
        >
          &copy; {new Date().getFullYear()} Dead Wax Dialogues
        </span>
      </div>
    </footer>
  );
}
