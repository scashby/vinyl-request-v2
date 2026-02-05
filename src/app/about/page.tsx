// About page ("/about") — Database-driven content

'use client'

import React, { useEffect, useState } from "react"
import SocialEmbeds from "components/SocialEmbeds"

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
      <div className="bg-white min-h-screen">
        <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
            <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">About</h1>
          </div>
        </header>
        <main className="container-responsive py-12">
          <div className="text-center p-12 text-lg text-gray-600">
            Loading...
          </div>
        </main>
      </div>
    );
  }

  if (!aboutContent) {
    return (
      <div className="bg-white min-h-screen">
        <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
            <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">About</h1>
          </div>
        </header>
        <main className="container-responsive py-12">
          <div className="text-center p-12 text-lg text-gray-600">
            Content not available. Please contact the administrator.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
          <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">About</h1>
        </div>
      </header>
      
      <main className="container-responsive py-12">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Main Content Column */}
          <div className="flex-1 lg:flex-[2] min-w-0">
            <div className="pr-0 lg:pr-4">
              <h2 className="text-3xl font-bold text-purple-900 mb-6">About Dead Wax Dialogues</h2>
              <div className="prose max-w-none text-gray-800 mb-8 space-y-4">
                {aboutContent.main_description && aboutContent.main_description.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-lg leading-relaxed">{paragraph}</p>
                ))}
              </div>

              {/* Booking Information Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8 my-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                  Book Dead Wax Dialogues
                </h3>
                
                <p className="text-lg text-gray-600 text-center mb-8 leading-relaxed max-w-3xl mx-auto">
                  {aboutContent.booking_description}
                </p>

                {/* Book Online Button */}
                <div className="text-center mb-10">
                  <a 
                    href={aboutContent.calendly_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white py-3 px-8 rounded-lg text-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    📅 Schedule a Consultation
                  </a>
                </div>

                {/* Services Grid */}
                {aboutContent.services && aboutContent.services.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    {aboutContent.services.map((service, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-xl font-bold text-gray-800 mb-2">
                          {service.title}
                        </h4>
                        <p className="text-gray-600 mb-4 leading-relaxed">
                          {service.description}
                        </p>
                        <div className="text-lg font-bold text-blue-600">
                          {service.price}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Testimonials */}
                {aboutContent.testimonials && aboutContent.testimonials.length > 0 && (
                  <div className="mb-10">
                    <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">
                      What People Say
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {aboutContent.testimonials.map((testimonial, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 border-l-4 border-l-blue-600">
                          <p className="italic text-gray-600 mb-3 leading-relaxed">
                            &ldquo;{testimonial.text}&rdquo;
                          </p>
                          <div className="text-sm font-bold text-blue-600">
                            — {testimonial.author}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <h4 className="text-xl font-bold text-gray-800 mb-4">
                    Contact Information
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <strong className="block text-gray-900">{aboutContent.contact_name}</strong>
                      <span className="text-gray-500">{aboutContent.contact_company}</span>
                    </div>
                    <div>
                      <a href={`mailto:${aboutContent.contact_email}`} className="text-blue-600 hover:underline">
                        {aboutContent.contact_email}
                      </a>
                    </div>
                    <div>
                      <a href={`tel:${aboutContent.contact_phone}`} className="text-blue-600 hover:underline">
                        {aboutContent.contact_phone}
                      </a>
                    </div>
                  </div>

                  {aboutContent.booking_notes && (
                    <div className="text-sm text-gray-500 italic">
                      {aboutContent.booking_notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex-1 min-w-[280px] w-full lg:w-auto pt-2">
            <div className="mb-8">
              <div className="font-bold text-lg text-orange-600 mb-3 border-b border-gray-200 pb-2">Top 10 Most Wanted</div>
              <ol className="list-decimal pl-5 space-y-2 text-gray-800">
                {mostWanted.map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            
            <div className="mb-8">
              <div className="font-bold text-lg text-orange-600 mb-3 border-b border-gray-200 pb-2">Wish List</div>
              <div className="flex flex-col gap-2">
                <a href={aboutContent.amazon_wishlist_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                  <span>🛒</span> Full Amazon Wish List
                </a>
                <a href={aboutContent.discogs_wantlist_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                  <span>💿</span> Full Discogs Wantlist
                </a>
              </div>
            </div>

            {/* Social Feed */}
            <div className="mb-8">
              <div className="font-bold text-lg text-orange-600 mb-3 border-b border-gray-200 pb-2">Recent Social Posts</div>
              <div className="space-y-6">
                <SocialEmbeds />
                <div className="mt-6">
                  <a
                    href={aboutContent.linktree_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-black hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Visit Our Linktree
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
// AUDIT: inspected, no changes.
