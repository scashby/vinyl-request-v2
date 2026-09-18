import Link from 'next/link';
import { Container } from 'components/ui/Container';
import { fillTokens, type HeroData } from 'src/lib/homeContent';
import { imageFocusStyle } from 'src/lib/imageCrop';

export function HeroSection({
  data,
  tokens,
}: {
  data: HeroData;
  tokens: { night: string; venue: string };
}) {
  return (
    <Container size="xl">
      <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16 py-16 md:py-24">
        <div className="flex-1 min-w-0">
          <div
            className="inline-block rounded-[var(--dwd-badge-radius)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] mb-6 -rotate-1 [border:var(--dwd-badge-border)]"
            style={{ background: 'var(--dwd-badge-bg)', color: 'var(--dwd-badge-color)' }}
          >
            {data.eyebrow}
          </div>
          <h1 className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl sm:text-5xl md:text-6xl leading-[1.08] mb-6 text-[var(--dwd-ink)]">
            {fillTokens(data.headline, tokens)}
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-[var(--dwd-ink-soft)] max-w-xl mb-9">
            {data.subhead}
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link
              href={data.primary_cta_href}
              className="px-7 py-3.5 bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] rounded-full font-bold text-sm hover:bg-[var(--dwd-accent-1-hover)] transition-colors"
            >
              {data.primary_cta_label}
            </Link>
            <Link
              href={data.secondary_cta_href}
              className="px-7 py-3.5 bg-transparent text-[var(--dwd-ink)] rounded-full font-bold text-sm border-2 border-[var(--dwd-ink)] hover:opacity-65 transition-opacity"
            >
              {data.secondary_cta_label}
            </Link>
          </div>
        </div>
        <div className="flex-1 min-w-0 w-full max-w-md md:max-w-none relative pt-3">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full bg-[var(--dwd-accent-2)] border-2 border-[var(--dwd-ink)] z-10" />
          {data.photo_url ? (
            <div className="relative w-full aspect-[4/5] overflow-hidden [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)] [transform:rotate(var(--dwd-tilt-1))]">
              {/* eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly */}
              <img
                src={data.photo_url}
                alt="Steve at the decks"
                className="absolute inset-0 h-full w-full object-cover"
                style={imageFocusStyle(data.photo_crop)}
              />
            </div>
          ) : (
            <div
              className="w-full aspect-[4/5] flex items-center justify-center overflow-hidden [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)] [transform:rotate(var(--dwd-tilt-1))]"
              style={{
                background:
                  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--dwd-accent-3) 55%, white), color-mix(in srgb, var(--dwd-accent-3) 55%, white) 18px, var(--dwd-accent-3) 18px, var(--dwd-accent-3) 36px)',
              }}
            >
              <div className="absolute inset-[18px] rounded-xl bg-[var(--dwd-bg)]/90 flex items-center justify-center text-center p-6">
                <span className="text-sm font-bold uppercase tracking-wider text-[var(--dwd-accent-1)]">
                  {fillTokens(data.photo_placeholder_text, tokens)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
