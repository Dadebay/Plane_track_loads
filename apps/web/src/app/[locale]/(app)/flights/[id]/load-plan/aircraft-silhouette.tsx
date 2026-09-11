/**
 * Decorative A330-200P2F side elevation for the loading workspace.
 *
 * Position controls are rendered as real HTML buttons over the cargo bay;
 * this SVG only supplies orientation and aircraft context. The drawing is
 * original, theme-aware and intentionally schematic rather than a source of
 * certified dimensions.
 */

/** Inset of the usable main-deck band, as fractions of the rendered box. */
export const CARGO_BAY = {
  left: "14.5%",
  right: "18.5%",
  height: "34%",
};

const RIGID_SECTION_LABEL = "RIGID SECTION";

export function AircraftSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 230"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="aircraft-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9bfd6" />
          <stop offset="0.48" stopColor="#7697ba" />
          <stop offset="1" stopColor="#496d94" />
        </linearGradient>
        <linearGradient id="aircraft-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#89a9ca" stopOpacity="0.95" />
          <stop offset="1" stopColor="#476b93" stopOpacity="0.72" />
        </linearGradient>
        <filter id="aircraft-shadow" x="-10%" y="-20%" width="120%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000" floodOpacity="0.16" />
        </filter>
        <pattern id="rigid-dots" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" fill="#274d73" opacity="0.55" />
        </pattern>
      </defs>

      <path
        d="M500 91 L575 17 L754 17 L700 96 Z"
        fill="url(#aircraft-wing)"
        stroke="#42668d"
        strokeWidth="2"
      />
      <path
        d="M506 145 L586 218 L759 218 L698 137 Z"
        fill="url(#aircraft-wing)"
        stroke="#42668d"
        strokeWidth="2"
      />

      <path
        d="M1011 95 L1082 38 L1160 38 L1122 103 Z"
        fill="url(#aircraft-wing)"
        stroke="#42668d"
        strokeWidth="2"
      />
      <path
        d="M1014 142 L1084 190 L1163 190 L1124 134 Z"
        fill="url(#aircraft-wing)"
        stroke="#42668d"
        strokeWidth="2"
      />
      <path
        d="M30 116
           C48 75 103 61 168 58
           C365 51 702 53 879 67
           C956 73 1014 91 1077 104
           L1160 111
           C1175 113 1175 123 1160 126
           L1077 132
           C1014 145 956 163 879 169
           C702 183 365 185 168 178
           C103 175 48 157 30 116 Z"
        fill="url(#aircraft-body)"
        stroke="#35597f"
        strokeWidth="3"
        filter="url(#aircraft-shadow)"
      />

      <path d="M154 118 C390 112 755 112 920 120" fill="none" stroke="#d5e1ed" strokeOpacity="0.45" strokeWidth="1.5" />
      <path d="M169 151 C390 160 728 158 879 148" fill="none" stroke="#274d73" strokeOpacity="0.5" strokeWidth="1.5" />

      <path d="M534 61 H688 V173 H534 Z" fill="url(#rigid-dots)" opacity="0.75" />
      <path d="M534 67 V169 M688 71 V165" stroke="#274d73" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="611" y="45" textAnchor="middle" fontSize="11" fontWeight="700" fill="#35597f">
        {RIGID_SECTION_LABEL}
      </text>
    </svg>
  );
}
