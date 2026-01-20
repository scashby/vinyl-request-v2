import React, { ReactNode } from 'react';
import Footer from 'components/Footer';

const InternalLayout = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <div className="w-full">
      <header className="relative h-[40vh] min-h-[300px] w-full bg-cover bg-center bg-no-repeat bg-[url('/images/event-header-still.jpg')]">
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center drop-shadow-md">
            {title}
          </h1>
        </div>
      </header>
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default InternalLayout;