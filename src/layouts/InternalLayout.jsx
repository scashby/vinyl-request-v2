import React from 'react';
import 'styles/internal.css';
import Footer from 'components/Footer';
import "../styles/base.css";

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
