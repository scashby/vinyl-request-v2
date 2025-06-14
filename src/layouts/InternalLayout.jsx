import React from 'react';
import 'styles/internal.css';
import Footer from 'components/Footer'; 

const InternalLayout = ({ title, children }) => {
  return (
    <>
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>
      <main className="event-body">
        {children}
      </main>
      <Footer />
    </>
  );
};

export default InternalLayout;
