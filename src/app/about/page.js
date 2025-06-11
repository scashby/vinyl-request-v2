// About page ("/about") — Info, social links, and wish list for Dead Wax Dialogues

import {
  SiDiscogs,
  SiFacebook,
  SiInstagram,
  SiThreads,
  SiBluesky,
  SiSubstack,
} from "react-icons/si";
import { FiMail } from "react-icons/fi";
import Footer from "../../components/Footer";

const socials = [
  {
    name: "Discogs",
    url: "https://www.discogs.com/user/socialblunders/collection",
    icon: <SiDiscogs size={22} color="#444" />,
  },
  {
    name: "Email",
    url: "mailto:steve@deadwaxdialogues.com",
    icon: <FiMail size={22} color="#444" />,
  },
  {
    name: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61576451743378",
    icon: <SiFacebook size={22} color="#444" />,
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/deadwaxdialogues/",
    icon: <SiInstagram size={22} color="#444" />,
  },
  {
    name: "Threads",
    url: "https://www.threads.net/@deadwaxdialogues",
    icon: <SiThreads size={22} color="#444" />,
  },
  {
    name: "Bluesky",
    url: "https://bsky.app/profile/deadwaxdialogues.bsky.social",
    icon: <SiBluesky size={22} color="#444" />,
  },
  {
    name: "Substack",
    url: "https://deadwaxdialogues.substack.com",
    icon: <SiSubstack size={22} color="#444" />,
  },
];

const wishlist = [
  { name: "The National – Sad Songs for Dirty Lovers (LP)", url: "https://www.discogs.com/sell/release/1573764?ev=rb" },
  { name: "Radiohead – Kid A (First UK Pressing)", url: "https://www.discogs.com/sell/release/40846?ev=rb" },
  { name: "Fleet Foxes – Helplessness Blues (LP)", url: "https://www.discogs.com/sell/release/2881825?ev=rb" },
  { name: "Beastie Boys – Paul's Boutique (180g)", url: "https://www.discogs.com/sell/release/85108?ev=rb" },
  { name: "PJ Harvey – Let England Shake (LP)", url: "https://www.discogs.com/sell/release/2798310?ev=rb" },
  { name: "Talk Talk – Spirit of Eden (LP)", url: "https://www.discogs.com/sell/release/1023219?ev=rb" },
  { name: "Beck – Sea Change (MoFi)", url: "https://www.discogs.com/sell/release/2719547?ev=rb" },
  { name: "Sufjan Stevens – Illinois (LP)", url: "https://www.discogs.com/sell/release/489293?ev=rb" },
  { name: "Wilco – Yankee Hotel Foxtrot (Deluxe)", url: "https://www.discogs.com/sell/release/20423278?ev=rb" },
  { name: "Fiona Apple – Extraordinary Machine (LP)", url: "https://www.discogs.com/sell/release/1178935?ev=rb" },
];

export default function Page() {
  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>About</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="about-body-container">
          <h2 className="about-title">About Dead Wax Dialogues</h2>
          <p className="about-intro">
            Hi, I’m Stephen. If you ever wanted to know why anyone still loves vinyl, cassettes, or tangling with Discogs, you’re in the right place.
          </p>
          <div className="about-qa">
            <div className="about-qa__q"><strong>Q:</strong> Why vinyl?</div>
            <div className="about-qa__a"><strong>A:</strong> Because you can hold it, hear it, and see the music. It’s not just sound, it’s an experience.</div>
            <div className="about-qa__q"><strong>Q:</strong> What’s your favorite side to drop?</div>
            <div className="about-qa__a"><strong>A:</strong> Side A, always. But Side B after midnight.</div>
            <div className="about-qa__q"><strong>Q:</strong> Most wanted record right now?</div>
            <div className="about-qa__a"><strong>A:</strong> See the wish list below. (Feel free to send one my way.)</div>
            <div className="about-qa__q"><strong>Q:</strong> Where can I find you online?</div>
            <div className="about-qa__a"><strong>A:</strong> Try the linktree below—or at the next vinyl night.</div>
          </div>
          <div className="about-socials">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="about-socials__link"
              >
                {s.icon}
              </a>
            ))}
          </div>
          <div className="about-wishlist">
            <h3>Top 10 Most Wanted</h3>
            <ol>
              {wishlist.map((w, i) => (
                <li key={i}>
                  <a href={w.url} target="_blank" rel="noopener noreferrer">
                    {w.name}
                  </a>
                </li>
              ))}
            </ol>
            <div className="about-wishlist__links">
              <a href="https://www.amazon.com/hz/wishlist/ls/" target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
              <a href="https://www.discogs.com/user/socialblunders/wants" target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
