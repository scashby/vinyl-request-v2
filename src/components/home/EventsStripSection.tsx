import Link from 'next/link';
import { Container } from 'components/ui/Container';
import { formatEventText } from 'src/utils/textFormatter';
import { fillTokens, type EventsStripData, type ResidencyTokens } from 'src/lib/homeContent';

interface EventLite {
  id: number;
  title: string;
  date: string;
  location?: string;
  allowed_tags?: string[] | string | null;
}

const CARD_TILT_VARS = ['--dwd-tilt-1', '--dwd-tilt-2', '--dwd-tilt-3', '--dwd-tilt-4'];
const EVENT_TYPE_TAG_PREFIX = 'event_type:';

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .replace(/[{}]/g, '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getDisplayTitle = (event: EventLite): string => {
  const tags = normalizeStringArray(event.allowed_tags);
  const eventType = tags.find((t) => t.startsWith(EVENT_TYPE_TAG_PREFIX))?.replace(EVENT_TYPE_TAG_PREFIX, '');
  if (eventType === 'private-dj') return 'Private Event';
  return event.title;
};

const compactDate = (dateString?: string) => {
  if (!dateString || dateString === '' || dateString === '9999-12-31') return 'TBA';
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'TBA';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

export function EventsStripSection({
  data,
  tokens,
  loading,
  events,
}: {
  data: EventsStripData;
  tokens: ResidencyTokens;
  loading: boolean;
  events: EventLite[];
}) {
  return (
    <Container size="xl">
      <div className="mb-16 md:mb-20">
        <div className="flex items-baseline justify-between mb-7">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl md:text-3xl text-[var(--dwd-ink)]">
            {fillTokens(data.heading, tokens)}
          </div>
          <Link href={data.cta_href} className="text-sm font-bold text-[var(--dwd-accent-1)] hover:text-[var(--dwd-accent-1-hover)]">
            {data.cta_label}
          </Link>
        </div>

        {loading ? (
          <div className="text-[var(--dwd-ink-faint)]">Loading upcoming nights&hellip;</div>
        ) : events.length === 0 ? (
          <div className="text-[var(--dwd-ink-faint)]">{fillTokens(data.empty_state_text, tokens)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {events.map((event, i) => (
              <Link
                key={event.id}
                href={`/events/event-detail/${event.id}`}
                className="group bg-[var(--dwd-bg-card)] p-6 transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
                style={{ transform: `rotate(var(${CARD_TILT_VARS[i % CARD_TILT_VARS.length]}))` }}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--dwd-accent-1)] mb-2.5">
                  {compactDate(event.date)}
                </div>
                <div
                  className="text-[17px] font-bold mb-1.5 leading-snug"
                  dangerouslySetInnerHTML={{ __html: formatEventText(getDisplayTitle(event)) }}
                />
                <div className="text-sm text-[var(--dwd-ink-faint)]">{event.location || tokens.venue}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
