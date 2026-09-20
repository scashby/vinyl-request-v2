import { Container } from 'components/ui/Container';
import { fillTokens, type ResidencyData, type ResidencyTokens } from 'src/lib/homeContent';

export function ResidencySection({ data, tokens }: { data: ResidencyData; tokens: ResidencyTokens }) {
  return (
    <Container size="xl">
      <div
        className="relative px-8 py-10 md:px-16 md:py-14 flex items-center justify-between gap-8 flex-wrap -rotate-[0.6deg] mb-16 md:mb-20 [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
        style={{ background: 'var(--dwd-residency-bg)' }}
      >
        <div className="absolute -top-3.5 left-14 w-6 h-6 rounded-full bg-[var(--dwd-accent-3)] border-2 border-[var(--dwd-ink)]" />
        <div>
          <div
            className="text-xs font-bold uppercase tracking-[0.16em] mb-3 opacity-60"
            style={{ color: 'var(--dwd-residency-ink)' }}
          >
            {fillTokens(data.eyebrow, tokens)}
          </div>
          <div
            className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl md:text-4xl leading-tight"
            style={{ color: 'var(--dwd-residency-ink)' }}
          >
            {fillTokens(data.headline, tokens)}
          </div>
          <div className="text-sm mt-3 max-w-md opacity-70" style={{ color: 'var(--dwd-residency-ink)' }}>
            {fillTokens(data.description, tokens)}
          </div>
        </div>
        <a
          href={data.cta_href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-7 py-3.5 rounded-full font-bold text-sm whitespace-nowrap hover:opacity-90 transition-opacity"
          style={{ background: 'var(--dwd-residency-cta-bg)', color: 'var(--dwd-residency-cta-color)' }}
        >
          {data.cta_label}
        </a>
      </div>
    </Container>
  );
}
