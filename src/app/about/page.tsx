// About page ("/about") — Database-driven content
//
// Data source unchanged (/api/about-content, /api/most-wanted,
// SocialEmbeds) — still admin-editable at /admin/edit-about. This pass
// only restyles the page to match the v2 brand (theme-aware, card
// language shared with the homepage) — Most Wanted and the wishlist
// links already lived here, which is why nav no longer needs a separate
// "Browse Collection" entry.

'use client'

import { useEffect, useState } from "react"
import SocialEmbeds from "../../components/SocialEmbeds"
import { Container } from "components/ui/Container"
import { useActiveTheme } from "src/lib/useActiveTheme"

interface MostWantedItem {
  id: number;
  title: string;
  url: string;
}

interface Service {
  title: string;
  description: string;
  price: string;
}

interface Testimonial {
  text: string;
  author: string;
}

interface AboutContent {
  main_description?: string;
  booking_description?: string;
  contact_name?: string;
  contact_company?: string;
  contact_email?: string;
  contact_phone?: string;
  calendly_url?: string;
  services?: Service[];
  testimonials?: Testimonial[];
  booking_notes?: string;
  amazon_wishlist_url?: string;
  discogs_wantlist_url?: string;
  linktree_url?: string;
}

const cardStyle = {
  border: 'var(--dwd-card-border)',
  borderRadius: 'var(--dwd-card-radius)',
} as const;

function PageShell({ children }: { children: React.ReactNode }) {
  const { cssVars } = useActiveTheme();
  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-10 md:pt-20">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-5xl mb-3">
            About
          </div>
          <p className="text-lg text-[var(--dwd-ink-soft)] max-w-xl">
            Bookings, favorites, and how to find the good stuff.
          </p>
        </div>
      </Container>
      {children}
    </div>
  );
}

export default function AboutPage() {
  const [mostWanted, setMostWanted] = useState<MostWantedItem[]>([]);
  const [aboutContent, setAboutContent] = useState<AboutContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch most wanted list
      try {
        const mostWantedResponse = await fetch("/api/most-wanted");
        const mostWantedData = await mostWantedResponse.json();
        setMostWanted(mostWantedData);
      } catch (error) {
        console.error("Error fetching most wanted:", error);
      }

      // Fetch about content from database
      try {
        const aboutResponse = await fetch("/api/about-content");
        if (aboutResponse.ok) {
          const aboutData = await aboutResponse.json();
          setAboutContent(aboutData);
        }
      } catch (error) {
        console.error("Error fetching about content:", error);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <Container size="xl">
          <div className="text-center py-16 text-lg text-[var(--dwd-ink-faint)]">Loading&hellip;</div>
        </Container>
      </PageShell>
    );
  }

  if (!aboutContent) {
    return (
      <PageShell>
        <Container size="xl">
          <div className="text-center py-16 text-lg text-[var(--dwd-ink-faint)]">
            Content not available. Please contact the administrator.
          </div>
        </Container>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Container size="xl">
        <div className="flex flex-col lg:flex-row gap-12 items-start pb-20">
          {/* Main Content Column */}
          <div className="flex-1 lg:flex-[2] min-w-0">
            <div className="prose max-w-none mb-8 space-y-4">
              {aboutContent.main_description && aboutContent.main_description.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-lg leading-relaxed text-[var(--dwd-ink)]">{paragraph}</p>
              ))}
            </div>

            {/* Booking Information Section */}
            <div
              className="bg-[var(--dwd-bg-card)] p-6 md:p-8 my-8"
              style={{ ...cardStyle, boxShadow: 'var(--dwd-card-shadow)' }}
            >
              <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl mb-4 text-center">
                Book Dead Wax Dialogues
              </div>

              <p className="text-lg text-[var(--dwd-ink-soft)] text-center mb-8 leading-relaxed max-w-3xl mx-auto">
                {aboutContent.booking_description}
              </p>

              {/* Book Online Button */}
              <div className="text-center mb-10">
                <a
                  href={aboutContent.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[var(--dwd-accent-1)] hover:bg-[var(--dwd-accent-1-hover)] text-[var(--dwd-bg)] py-3 px-8 rounded-full text-lg font-bold transition-colors"
                >
                  Schedule a Consultation
                </a>
              </div>

              {/* Services Grid */}
              {aboutContent.services && aboutContent.services.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  {aboutContent.services.map((service, index) => (
                    <div
                      key={index}
                      className="bg-[var(--dwd-bg)] p-6"
                      style={cardStyle}
                    >
                      <div className="text-xl font-bold mb-2">{service.title}</div>
                      <p className="text-[var(--dwd-ink-soft)] mb-4 leading-relaxed">{service.description}</p>
                      <div className="text-lg font-bold text-[var(--dwd-accent-1)]">{service.price}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Testimonials */}
              {aboutContent.testimonials && aboutContent.testimonials.length > 0 && (
                <div className="mb-10">
                  <div className="text-xl font-bold mb-6 text-center">What People Say</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aboutContent.testimonials.map((testimonial, index) => (
                      <div
                        key={index}
                        className="bg-[var(--dwd-bg)] p-6 border-l-4"
                        style={{ ...cardStyle, borderLeftColor: 'var(--dwd-accent-1)' }}
                      >
                        <p className="italic text-[var(--dwd-ink-soft)] mb-3 leading-relaxed">
                          &ldquo;{testimonial.text}&rdquo;
                        </p>
                        <div className="text-sm font-bold text-[var(--dwd-accent-1)]">— {testimonial.author}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="bg-[var(--dwd-bg)] p-6 text-center" style={cardStyle}>
                <div className="text-xl font-bold mb-4">Contact Information</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <strong className="block">{aboutContent.contact_name}</strong>
                    <span className="text-[var(--dwd-ink-faint)]">{aboutContent.contact_company}</span>
                  </div>
                  <div>
                    <a href={`mailto:${aboutContent.contact_email}`} className="text-[var(--dwd-accent-1)] hover:underline">
                      {aboutContent.contact_email}
                    </a>
                  </div>
                  <div>
                    <a href={`tel:${aboutContent.contact_phone}`} className="text-[var(--dwd-accent-1)] hover:underline">
                      {aboutContent.contact_phone}
                    </a>
                  </div>
                </div>

                {aboutContent.booking_notes && (
                  <div className="text-sm text-[var(--dwd-ink-faint)] italic">{aboutContent.booking_notes}</div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex-1 min-w-[280px] w-full lg:w-auto pt-2">
            <div className="mb-8">
              <div className="font-bold text-lg text-[var(--dwd-accent-2)] mb-3 border-b border-[var(--dwd-ink)]/10 pb-2">
                Top 10 Most Wanted
              </div>
              <ol className="list-decimal pl-5 space-y-2">
                {mostWanted.filter((item) => item.title && item.url).map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--dwd-accent-1)] hover:underline font-medium">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mb-8">
              <div className="font-bold text-lg text-[var(--dwd-accent-2)] mb-3 border-b border-[var(--dwd-ink)]/10 pb-2">
                Wish List
              </div>
              <div className="flex flex-col gap-2">
                <a href={aboutContent.amazon_wishlist_url} target="_blank" rel="noopener noreferrer" className="text-[var(--dwd-accent-1)] hover:underline">
                  Full Amazon Wish List
                </a>
                <a href={aboutContent.discogs_wantlist_url} target="_blank" rel="noopener noreferrer" className="text-[var(--dwd-accent-1)] hover:underline">
                  Full Discogs Wantlist
                </a>
              </div>
            </div>

            {/* Social Feed */}
            <div className="mb-8">
              <div className="font-bold text-lg text-[var(--dwd-accent-2)] mb-3 border-b border-[var(--dwd-ink)]/10 pb-2">
                Recent Social Posts
              </div>
              <div className="space-y-6">
                <SocialEmbeds />
                <div className="mt-6">
                  <a
                    href={aboutContent.linktree_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-[var(--dwd-ink)] hover:opacity-90 text-[var(--dwd-bg)] font-bold py-3 px-4 rounded-full transition-opacity"
                  >
                    Visit Our Linktree
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </PageShell>
  )
}
// AUDIT: restyled for v2 brand (theme-aware, shared card language); data source unchanged.
