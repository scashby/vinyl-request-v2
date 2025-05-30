import React from "react";

export default function LandingLayout({ children }) {
  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      {children}
    </div>
  );
}
