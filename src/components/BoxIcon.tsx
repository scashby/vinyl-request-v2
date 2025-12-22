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
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main crate body - filled */}
      <rect
        x="4"
        y="6"
        width="24"
        height="22"
        rx="1"
        fill={color}
        opacity="0.9"
      />
      
      {/* Horizontal slats - darker lines */}
      <line x1="4" y1="11" x2="28" y2="11" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      <line x1="4" y1="16" x2="28" y2="16" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      <line x1="4" y1="21" x2="28" y2="21" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      
      {/* Vertical corner posts */}
      <rect x="6" y="6" width="2.5" height="22" fill="rgba(0,0,0,0.15)" />
      <rect x="23.5" y="6" width="2.5" height="22" fill="rgba(0,0,0,0.15)" />
      
      {/* Top and bottom rim highlights */}
      <line x1="4" y1="6" x2="28" y2="6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1="4" y1="28" x2="28" y2="28" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
      
      {/* Side edges for depth */}
      <line x1="4" y1="6" x2="4" y2="28" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
      <line x1="28" y1="6" x2="28" y2="28" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
      
      {/* Center vertical support */}
      <rect x="15" y="6" width="2" height="22" fill="rgba(0,0,0,0.1)" />
    </svg>
  );
}