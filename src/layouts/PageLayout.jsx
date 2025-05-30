import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function PageLayout({ children }) {
  return (
    <>
      <Header />
      <div className="page-header">
        <img src="/hero-header.jpg" alt="Stylus and groove" className="page-header-image" />
      </div>
      <main className="page-body">{children}</main>
      <Footer />
    </>
  );
}
