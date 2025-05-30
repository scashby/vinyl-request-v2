import React from "react";
import Footer from "../components/Footer";

export default function PageLayout({ children }) {
  return (
    <>
      <div className="page-header">
        <img src="/hero-header.jpg" alt="Stylus and groove" className="page-header-image" />
      </div>
      <main className="page-body">{children}</main>
      <Footer />
    </>
  );
}
