import { Container } from 'components/ui/Container';
import type { ResidencyData } from 'src/lib/homeContent';

export function ResidencySection({ data }: { data: ResidencyData }) {
  return (
    <Container size="xl">
      <div
        className="relative bg-[#4FB8E8] rounded-xl px-8 py-10 md:px-16 md:py-14 flex items-center justify-between gap-8 flex-wrap -rotate-[0.6deg] mb-16 md:mb-20"
        style={{ boxShadow: '10px 10px 0 rgba(42,33,24,0.14)' }}
      >
        <div className="absolute -top-3.5 left-14 w-6 h-6 rounded-full bg-[#E8A93C] border-2 border-[#2A2118]" />
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#2A2118]/60 mb-3">
            {data.eyebrow}
          </div>
          <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-4xl text-[#2A2118] leading-tight">
            Every {data.night} &mdash; {data.venue}
          </div>
          <div className="text-sm text-[#2A2118]/70 mt-3 max-w-md">{data.description}</div>
        </div>
        <a
          href={data.cta_href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-7 py-3.5 bg-[#2A2118] text-[#FAF1E1] rounded-full font-bold text-sm whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          {data.cta_label}
        </a>
      </div>
    </Container>
  );
}
