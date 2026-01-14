import React from 'react';
import Footer from 'components/Footer';

const InternalLayout = ({ title, children }) => {
  return (
    <div className="w-full">
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>
      <main className="event-body">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default InternalLayout;
