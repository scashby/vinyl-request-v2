import Link from 'next/link';
import { Container } from 'components/ui/Container';
import type { GameDeckData } from 'src/lib/homeContent';

export function GameDeckSection({ data }: { data: GameDeckData }) {
  return (
    <Container size="xl">
      <div
        className="relative bg-[#6E7F5C] rounded-2xl px-8 py-10 md:px-16 md:py-14 flex items-center gap-10 flex-wrap rotate-[0.5deg] mb-16 md:mb-20"
        style={{ boxShadow: '10px 10px 0 rgba(42,33,24,0.10)' }}
      >
        <div className="absolute -top-3.5 right-16 w-6 h-6 rounded-full bg-[#C1502E] border-2 border-[#2A2118]" />
        <div className="flex-1 min-w-[280px]">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#FAF1E1]/85 mb-3.5">
            {data.eyebrow}
          </div>
          <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-[30px] text-[#FAF1E1] mb-3.5">
            {data.headline}
          </div>
          <p className="text-base leading-relaxed text-[#FAF1E1]/90 max-w-md mb-5">{data.body}</p>
          <div className="flex gap-2.5 flex-wrap mb-6">
            {data.chips.map((name) => (
              <span key={name} className="bg-[#FAF1E1] text-[#2A2118] px-4 py-2 rounded-full text-[13px] font-bold">
                {name}
              </span>
            ))}
          </div>
          <Link
            href={data.cta_href}
            className="inline-block px-6 py-3.5 bg-[#C1502E] text-[#FAF1E1] rounded-full font-bold text-sm hover:bg-[#9C3F22] transition-colors"
          >
            {data.cta_label}
          </Link>
        </div>
        <div className="w-full sm:w-[280px] h-[180px] sm:h-[200px] flex-shrink-0 rounded-xl bg-[#FAF1E1] border-[3px] border-[#2A2118] flex items-center justify-center text-center p-4 -rotate-[1.8deg]">
          <span className="text-[13px] font-bold uppercase tracking-wider text-[#8F3A1F]">
            {data.photo_placeholder_text}
          </span>
        </div>
      </div>
    </Container>
  );
}
