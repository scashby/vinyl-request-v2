import React from "react";

type CardVariant = "default" | "dark" | "bordered" | "interactive";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  noPadding?: boolean;
}

export function Card({ className = "", variant = "default", noPadding = false, children, ...props }: CardProps) {
  
  // Base styles
  const baseStyles = "rounded-xl overflow-hidden transition-all duration-200";
  
  // Padding logic (sometimes you want the image to touch the edges)
  const paddingStyles = noPadding ? "" : "p-6";

  const variants = {
    // Standard white card with shadow (Events, Staff Picks)
    default: "bg-white text-gray-900 shadow-md border border-gray-100",
    
    // The "Legacy Dark" card (from global.css) - Explicitly forces white text
    dark: "bg-[#1b1e25] text-gray-100 shadow-lg border-l-4 border-gray-600",
    
    // Admin selection cards (No shadow, just border)
    bordered: "bg-white text-gray-900 border-2 border-gray-200",
    
    // Cards that act like buttons (Hover effects)
    interactive: "bg-white text-gray-900 border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-400 hover:-translate-y-1 cursor-pointer",
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${paddingStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}