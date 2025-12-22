// src/components/BoxIcon.tsx
'use client';

interface BoxIconProps {
  color: string;
  size?: number;
}

export function BoxIcon({ color, size = 32 }: BoxIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 225 225"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main crate outline - only stroke, no fill */}
      <path 
        stroke={color} 
        strokeWidth="3"
        fill="none"
        d="M36.15,97.61c-.89-3.74.86-6.59,4.08-6.66l51.07-9.07.21-19.99,8.58-.4c.03-1.1.39-5.39,1.76-5.46l7.49-.39c-.08-1.57.95-6.27,2.45-6.13l62.28,5.8.28,29.62c4.08.58,7.03,1.2,9.9,3.23l-1.97,87.98-67.12,17.76-77.8-17.11-1.24-79.17Z"
      />
      
      {/* Records at top */}
      <path stroke={color} strokeWidth="2.5" fill="none" d="M164.99,64.14l.07,25.97c1.02.1,3.63-.72,3.62-1.79l-.13-27.81-54.17-5.22c3.32,3.73,7.69,2.37,11.63,2.89l11.02,1.04,11,1.04c8.51.8,16.95-.25,16.96,3.88Z"/>
      
      {/* Handle */}
      <ellipse cx="118" cy="95" rx="13" ry="16" stroke={color} strokeWidth="3" fill="none"/>
      
      {/* Vertical divider */}
      <line x1="112.5" y1="110" x2="112.5" y2="175" stroke={color} strokeWidth="3"/>
      
      {/* Left X slats */}
      <line x1="70" y1="110" x2="100" y2="165" stroke={color} strokeWidth="3"/>
      <line x1="100" y1="110" x2="70" y2="165" stroke={color} strokeWidth="3"/>
      
      {/* Right X slats */}
      <line x1="125" y1="110" x2="155" y2="165" stroke={color} strokeWidth="3"/>
      <line x1="155" y1="110" x2="125" y2="165" stroke={color} strokeWidth="3"/>
      
      {/* Corner posts */}
      <line x1="45" y1="100" x2="45" y2="180" stroke={color} strokeWidth="4"/>
      <line x1="180" y1="100" x2="180" y2="180" stroke={color} strokeWidth="4"/>
      
      {/* Bottom board */}
      <line x1="45" y1="165" x2="180" y2="165" stroke={color} strokeWidth="3"/>
    </svg>
  );
}