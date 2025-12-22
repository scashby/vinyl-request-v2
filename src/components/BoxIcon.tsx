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
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Records at top - curved edges */}
      <path
        d="M18 10 Q18 8 20 8 L24 8 Q26 8 26 10"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22 7 Q22 5 24 5 L28 5 Q30 5 30 7"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M26 4 Q26 2 28 2 L32 2 Q34 2 34 4"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M30 3 Q30 1 32 1 L38 1 Q40 1 40 3"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Main crate box - front face */}
      <rect
        x="12"
        y="14"
        width="32"
        height="36"
        stroke={color}
        strokeWidth="3"
        fill="none"
        rx="2"
      />
      
      {/* Right side for depth */}
      <path
        d="M44 14 L52 18 L52 54 L44 50 Z"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinejoin="miter"
      />
      
      {/* Top face for depth */}
      <path
        d="M12 14 L20 10 L52 18 L44 14 Z"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinejoin="miter"
      />
      
      {/* Vertical posts */}
      <line x1="15" y1="14" x2="15" y2="50" stroke={color} strokeWidth="3" />
      <line x1="41" y1="14" x2="41" y2="50" stroke={color} strokeWidth="3" />
      
      {/* Center vertical divider */}
      <line x1="28" y1="26" x2="28" y2="50" stroke={color} strokeWidth="3" />
      
      {/* Handle cutout */}
      <path
        d="M24 22 Q28 18 32 22"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Left diagonal X slats */}
      <line x1="17" y1="26" x2="26" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="26" x2="17" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Right diagonal X slats */}
      <line x1="30" y1="26" x2="39" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="39" y1="26" x2="30" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Bottom horizontal board */}
      <line x1="12" y1="48" x2="44" y2="48" stroke={color} strokeWidth="3" />
    </svg>
  );
}