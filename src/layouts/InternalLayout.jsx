import React from 'react';
import 'styles/internal.css';
import Footer from 'components/Footer';
import "../styles/base.css";

const InternalLayout = ({ title, children }) => {
  return (
    <>
      <header className="event-hero no-spacing">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>
      <main className="event-body no-spacing">
        {children}
      </main>
      <Footer />
    </>
  );
};

export default InternalLayout;
