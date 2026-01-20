import React, { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-screen overflow-hidden">
      {children}
    </div>
  );
}