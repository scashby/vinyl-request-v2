import Link from 'next/link';
import { Container } from 'components/ui/Container';
import { fillTokens, type GameDeckData, type ResidencyTokens } from 'src/lib/homeContent';
import { photoFocusStyle } from 'src/lib/homePhotoFocus';

export function GameDeckSection({ data, tokens }: { data: GameDeckData; tokens: ResidencyTokens }) {
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
            {fillTokens(data.eyebrow, tokens)}
          </div>
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl md:text-[30px] text-[var(--dwd-bg)] mb-3.5">
            {fillTokens(data.headline, tokens)}
          </div>
          <p className="text-base leading-relaxed text-[var(--dwd-bg)] opacity-90 max-w-md mb-5">{fillTokens(data.body, tokens)}</p>
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
          <div className="relative w-full sm:w-[280px] h-[180px] sm:h-[200px] flex-shrink-0 overflow-hidden bg-[var(--dwd-bg)] -rotate-[1.8deg] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly */}
            <img
              src={data.photo_url}
              alt="Vinyl Game Deck in action"
              className="absolute inset-0 h-full w-full"
              style={photoFocusStyle(data.photo_focus)}
            />
          </div>
        ) : (
          <div className="w-full sm:w-[280px] h-[180px] sm:h-[200px] flex-shrink-0 flex items-center justify-center text-center p-4 -rotate-[1.8deg] bg-[var(--dwd-bg)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--dwd-accent-1)]">
              {fillTokens(data.photo_placeholder_text, tokens)}
            </span>
          </div>
        )}
      </div>
    </Container>
  );
}
