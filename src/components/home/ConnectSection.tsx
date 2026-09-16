import { SiSpotify } from 'react-icons/si';
import { Container } from 'components/ui/Container';
import { getSocialIcon } from 'src/lib/socialIcons';
import type { ConnectData } from 'src/lib/homeContent';

interface Playlist {
  id: number;
  platform: string;
  embed_html?: string;
  embed_url?: string;
  visible: boolean;
}

export function ConnectSection({
  data,
  spotifyPlaylist,
}: {
  data: ConnectData;
  spotifyPlaylist?: Playlist;
}) {
  return (
    <Container size="xl">
      <div className="text-center pb-16 md:pb-20">
        <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-[30px] text-[#2A2118] mb-2.5">
          {data.heading}
        </div>
        <div className="text-base text-[#6B5B45] mb-9">{data.subhead}</div>
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
                className="w-12 h-12 rounded-full bg-[#2A2118] text-[#FAF1E1] flex items-center justify-center hover:-translate-y-0.5 hover:-rotate-[4deg] transition-transform"
              >
                <Icon size={20} />
              </a>
            );
          })}
        </div>

        <div
          className="max-w-xl mx-auto bg-[#2A2118] rounded-xl px-7 py-6 flex items-center gap-4 text-left -rotate-[0.5deg]"
          style={{ boxShadow: '8px 8px 0 rgba(42,33,24,0.10)' }}
        >
          <div className="w-11 h-11 rounded-full bg-[#2F7A78] flex items-center justify-center flex-shrink-0">
            <SiSpotify size={18} color="#FAF1E1" />
          </div>
          <div className="min-w-0">
            {spotifyPlaylist ? (
              <div
                className="text-sm text-[#FAF1E1] [&_iframe]:rounded-lg [&_iframe]:w-full"
                dangerouslySetInnerHTML={{
                  __html: (spotifyPlaylist.embed_html || spotifyPlaylist.embed_url || '').replace(
                    /allowfullscreen="?"?/g,
                    ''
                  ),
                }}
              />
            ) : (
              <>
                <div className="text-sm font-bold text-[#FAF1E1]">{data.spotify_fallback_label}</div>
                <div className="text-xs text-[#D8C9AE]">{data.spotify_fallback_sublabel}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
