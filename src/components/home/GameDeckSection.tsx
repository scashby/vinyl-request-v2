import Link from 'next/link';
import { Container } from 'components/ui/Container';
import type { GameDeckData } from 'src/lib/homeContent';
import { cropRectImageStyle } from 'src/lib/imageCrop';

export function GameDeckSection({ data }: { data: GameDeckData }) {
  const isExternal = /^https?:\/\//.test(data.cta_href);
  return (
    <Container size="xl">
      <div
        className="relative px-8 py-10 md:px-16 md:py-14 flex items-center gap-10 flex-wrap rotate-[0.5deg] mb-16 md:mb-20 [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
        style={{ background: 'var(--dwd-game-deck-bg)' }}
      >
        <div className="absolute -top-3.5 right-16 w-6 h-6 rounded-full bg-[var(--dwd-accent-1)] border-2 border-[var(--dwd-ink)]" />
        <div className="flex-1 min-w-[280px]">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dwd-bg)] opacity-85 mb-3.5">
            {data.eyebrow}
          </div>
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl md:text-[30px] text-[var(--dwd-bg)] mb-3.5">
            {data.headline}
          </div>
          <p className="text-base leading-relaxed text-[var(--dwd-bg)] opacity-90 max-w-md mb-5">{data.body}</p>
          <div className="flex gap-2.5 flex-wrap mb-6">
            {data.chips.map((name) => (
              <span
                key={name}
                className="bg-[var(--dwd-bg)] text-[var(--dwd-ink)] px-4 py-2 rounded-full text-[13px] font-bold"
              >
                {name}
              </span>
            ))}
          </div>
          {isExternal ? (
            <a
              href={data.cta_href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3.5 bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] rounded-full font-bold text-sm hover:bg-[var(--dwd-accent-1-hover)] transition-colors"
            >
              {data.cta_label}
            </a>
          ) : (
            <Link
              href={data.cta_href}
              className="inline-block px-6 py-3.5 bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] rounded-full font-bold text-sm hover:bg-[var(--dwd-accent-1-hover)] transition-colors"
            >
              {data.cta_label}
            </Link>
          )}
        </div>
        {data.photo_url ? (
          <div className="relative w-full sm:w-[220px] aspect-[3/4] flex-shrink-0 overflow-hidden -rotate-[1.8deg] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary crop rectangle needs raw left/top/width/height, which next/image's fill+object-fit can't express */}
            <img src={data.photo_url} alt="Vinyl Game Deck in action" style={cropRectImageStyle(data.photo_crop)} />
          </div>
        ) : (
          <div className="w-full sm:w-[220px] aspect-[3/4] flex-shrink-0 flex items-center justify-center text-center p-4 -rotate-[1.8deg] bg-[var(--dwd-bg)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--dwd-accent-1)]">
              {data.photo_placeholder_text}
            </span>
          </div>
        )}
      </div>
    </Container>
  );
}
