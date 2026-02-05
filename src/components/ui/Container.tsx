import React from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export function Container({ className = "", size = "xl", children, ...props }: ContainerProps) {
  // Max-width breakpoints
  const sizes = {
    sm: "max-w-screen-sm", // 640px (Article reading width)
    md: "max-w-screen-md", // 768px
    lg: "max-w-screen-lg", // 1024px
    xl: "max-w-[1200px]",  // Standard Site Width
    full: "max-w-full",
  };

  return (
    <div 
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
}
// AUDIT: inspected, no changes.
