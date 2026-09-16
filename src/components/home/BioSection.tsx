import { Container } from 'components/ui/Container';
import { fillTokens, type BioData } from 'src/lib/homeContent';

export function BioSection({
  data,
  tokens,
}: {
  data: BioData;
  tokens: { night: string; venue: string };
}) {
  return (
    <Container size="xl">
      <div className="flex flex-col sm:flex-row gap-8 items-start mb-16 md:mb-20">
        <div className="w-full sm:w-[220px] flex-shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-[var(--dwd-accent-2)]">
          {data.eyebrow}
        </div>
        <p className="flex-1 text-xl md:text-[22px] leading-relaxed max-w-3xl text-[var(--dwd-ink)]">
          {fillTokens(data.body, tokens)}
        </p>
      </div>
    </Container>
  );
}
