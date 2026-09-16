import Link from 'next/link';
import { Container } from 'components/ui/Container';
import { fillTokens, type HeroData } from 'src/lib/homeContent';

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
          <div className="inline-block border-2 border-dashed border-[#C1502E] rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#C1502E] mb-6 -rotate-1">
            {data.eyebrow}
          </div>
          <h1 className="font-[family-name:var(--font-alfa-slab)] text-4xl sm:text-5xl md:text-6xl leading-[1.08] mb-6 text-[#2A2118]">
            {fillTokens(data.headline, tokens)}
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-[#4A3D2C] max-w-xl mb-9">
            {data.subhead}
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link
              href={data.primary_cta_href}
              className="px-7 py-3.5 bg-[#C1502E] text-[#FAF1E1] rounded-full font-bold text-sm hover:bg-[#9C3F22] transition-colors"
            >
              {data.primary_cta_label}
            </Link>
            <Link
              href={data.secondary_cta_href}
              className="px-7 py-3.5 bg-transparent text-[#2A2118] rounded-full font-bold text-sm border-2 border-[#2A2118] hover:opacity-65 transition-opacity"
            >
              {data.secondary_cta_label}
            </Link>
          </div>
        </div>
        <div className="flex-1 min-w-0 w-full max-w-md md:max-w-none relative pt-3">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full bg-[#2F7A78] border-2 border-[#2A2118] z-10" />
          <div
            className="w-full aspect-[4/5] rounded-2xl border-[3px] border-[#2A2118] flex items-center justify-center overflow-hidden rotate-[1.2deg]"
            style={{
              background:
                'repeating-linear-gradient(135deg, #EFC98A, #EFC98A 18px, #E8A93C 18px, #E8A93C 36px)',
              boxShadow: '10px 10px 0 rgba(42,33,24,0.12)',
            }}
          >
            <div className="absolute inset-[18px] rounded-xl bg-[#FAF1E1]/90 flex items-center justify-center text-center p-6">
              <span className="text-sm font-bold uppercase tracking-wider text-[#8F3A1F]">
                {fillTokens(data.photo_placeholder_text, tokens)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
