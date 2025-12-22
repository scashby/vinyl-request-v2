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
      {/* Box body */}
      <rect
        x="4"
        y="10"
        width="24"
        height="18"
        rx="1"
        fill={color}
        stroke={color}
        strokeWidth="1.5"
        opacity="0.9"
      />
      
      {/* Box lid/top */}
      <path
        d="M4 10 L16 4 L28 10 Z"
        fill={color}
        stroke={color}
        strokeWidth="1.5"
        opacity="1"
      />
      
      {/* Center line on lid */}
      <line
        x1="16"
        y1="4"
        x2="16"
        y2="10"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1.5"
      />
      
      {/* Front edge highlight */}
      <line
        x1="4"
        y1="10"
        x2="28"
        y2="10"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
      />
      
      {/* Vertical edges for depth */}
      <line
        x1="4"
        y1="10"
        x2="4"
        y2="28"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1.5"
      />
      <line
        x1="28"
        y1="10"
        x2="28"
        y2="28"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1.5"
      />
    </svg>
  );
}