import { SiSpotify } from 'react-icons/si';
import { Container } from 'components/ui/Container';
import { getSocialIcon } from 'src/lib/socialIcons';
import type { ConnectData } from 'src/lib/homeContent';

export function ConnectSection({ data }: { data: ConnectData }) {
  const spotifyUrl = data.socials.find((s) => s.name === 'Spotify')?.url;
  return (
    <Container size="xl">
      <div className="text-center pb-16 md:pb-20">
        <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl md:text-[30px] text-[var(--dwd-ink)] mb-2.5">
          {data.heading}
        </div>
        <div className="text-base text-[var(--dwd-ink-faint)] mb-9">{data.subhead}</div>
        <div className="flex justify-center gap-4 flex-wrap mb-11">
          {data.socials.map(({ name, url }) => {
            const Icon = getSocialIcon(name);
            return (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="w-12 h-12 rounded-full bg-[var(--dwd-ink)] text-[var(--dwd-bg)] flex items-center justify-center hover:-translate-y-0.5 hover:-rotate-[4deg] transition-transform"
              >
                <Icon size={20} />
              </a>
            );
          })}
        </div>

        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-xl mx-auto rounded-xl px-7 py-6 flex items-center gap-4 text-left -rotate-[0.5deg] bg-[var(--dwd-ink)] hover:-translate-y-0.5 transition-transform"
          style={{ boxShadow: '8px 8px 0 rgba(0,0,0,0.10)' }}
        >
          <div className="w-11 h-11 rounded-full bg-[var(--dwd-accent-2)] flex items-center justify-center flex-shrink-0">
            <SiSpotify size={18} color="var(--dwd-bg)" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--dwd-bg)]">{data.spotify_fallback_label}</div>
            <div className="text-xs text-[var(--dwd-bg)] opacity-70">{data.spotify_fallback_sublabel}</div>
          </div>
        </a>
      </div>
    </Container>
  );
}
