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
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Records sticking out of the top */}
      <path
        d="M12 8 L14 6 L18 6 L20 8 Z"
        fill={color}
        opacity="0.6"
      />
      <path
        d="M16 6 L18 4 L22 4 L24 6 Z"
        fill={color}
        opacity="0.7"
      />
      <path
        d="M20 4 L22 2 L26 2 L28 4 Z"
        fill={color}
        opacity="0.8"
      />
      <path
        d="M24 2 L26 1 L30 1 L32 2 Z"
        fill={color}
        opacity="0.9"
      />
      
      {/* Crate front face - 3D perspective */}
      <path
        d="M8 12 L8 38 L32 38 L32 12 Z"
        fill={color}
        opacity="0.9"
      />
      
      {/* Right side face for depth */}
      <path
        d="M32 12 L40 16 L40 42 L32 38 Z"
        fill={color}
        opacity="0.7"
      />
      
      {/* Top face */}
      <path
        d="M8 12 L32 12 L40 16 L16 16 Z"
        fill={color}
        opacity="1"
      />
      
      {/* Frame - vertical corner posts */}
      <rect x="8" y="12" width="3" height="26" fill="rgba(0,0,0,0.3)" />
      <rect x="29" y="12" width="3" height="26" fill="rgba(0,0,0,0.3)" />
      
      {/* Frame - horizontal bottom */}
      <rect x="8" y="35" width="24" height="3" fill="rgba(0,0,0,0.25)" />
      
      {/* Handle cutout in center */}
      <ellipse
        cx="20"
        cy="20"
        rx="4"
        ry="5"
        fill="rgba(0,0,0,0.4)"
      />
      
      {/* Diagonal slats - left side */}
      <line x1="11" y1="16" x2="16" y2="32" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="11" y2="32" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" />
      
      {/* Diagonal slats - right side */}
      <line x1="24" y1="16" x2="29" y2="32" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" />
      <line x1="29" y1="16" x2="24" y2="32" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" />
      
      {/* Center vertical support */}
      <rect x="19" y="24" width="2" height="14" fill="rgba(0,0,0,0.25)" />
      
      {/* Bottom horizontal slat */}
      <rect x="11" y="32" width="18" height="2" fill="rgba(0,0,0,0.2)" />
    </svg>
  );
}