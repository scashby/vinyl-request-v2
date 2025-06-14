// About page ("/about") — Info, social links, and wish list for Dead Wax Dialogues

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
        <div className="dialogues-body-row">
          <div className="dialogues-main-col">
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
          <aside className="dialogues-sidebar">
            <div className="dialogues-sidebar-title">Wish List</div>
            <div className="dialogues-sidebar-list">
              {/* Amazon + Discogs links already present */}
            </div>
            <div className="about-social-feed">[Social Feed Placeholder]</div>
          </aside>
          </div>
      </main>
    </div>
  );
}
