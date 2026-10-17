import { EarpieceDefs } from "./Earpiece";

export type ExplodedPart = {
  n: number;
  name: string;
  body: string;
  status: "core" | "research" | "future";
};

export const explodedParts: ExplodedPart[] = [
  { n: 1, name: "Faceplate", body: "Anodised graphite over a titanium-tone shell. Compact and understated.", status: "core" },
  { n: 2, name: "Audio driver", body: "A dedicated acoustic system tuned first for music. Specifications to come.", status: "core" },
  { n: 3, name: "Acoustic shell", body: "Anatomical enclosure shaped for long-session comfort and passive isolation.", status: "core" },
  { n: 4, name: "Stimulation fin", body: "Soft fin carrying two small contacts toward the cymba conchae. Geometry under investigation.", status: "core" },
  { n: 5, name: "Optical sensor", body: "Compact PPG window on the inner face to explore pulse-related signals.", status: "research" },
  { n: 6, name: "Ear tip", body: "Replaceable silicone tips. Conductive tips are being explored for ear-EEG.", status: "research" },
];

/** Exploded, annotated concept view of a single earpiece. */
export function Exploded({ className = "" }: { className?: string }) {
  const p = "ex";
  const marker = (n: number, x: number, y: number) => (
    <g key={n}>
      <circle cx={x} cy={y} r="13" fill="var(--color-bone)" />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="11"
        fontWeight="500"
        fill="var(--color-ink)"
      >
        {n}
      </text>
    </g>
  );

  return (
    <svg
      viewBox="60 20 740 560"
      className={className}
      role="img"
      aria-label="Exploded concept view of one earpiece showing, from outside in: faceplate, audio driver, acoustic shell, a soft fin with two stimulation contacts, an optical sensor window and a silicone ear tip."
    >
      <EarpieceDefs p={p} />
      <defs>
        <linearGradient id="ex-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EDEAE3" />
          <stop offset="1" stopColor="#77746E" />
        </linearGradient>
        <radialGradient id="ex-cone" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#6A6B6F" />
          <stop offset="1" stopColor="#1A1B1D" />
        </radialGradient>
      </defs>

      {/* assembly axis */}
      <path d="M 720 70 L 100 560" stroke="currentColor" strokeOpacity="0.22" strokeDasharray="2 6" />

      {/* 6 ear tip */}
      <g transform="translate(150 500) rotate(-40)">
        <path d="M -40 0 C -40 -30 -18 -44 0 -44 C 18 -44 40 -30 40 0 C 40 12 20 18 0 18 C -20 18 -40 12 -40 0 Z" fill={`url(#${p}-tip)`} />
        <ellipse cx="0" cy="6" rx="34" ry="9" fill="#000" opacity="0.35" />
        <ellipse cx="0" cy="6" rx="10" ry="3.5" fill="#000" opacity="0.8" />
        <path d="M -26 -18 C -20 -32 -8 -36 6 -36" stroke="#fff" strokeOpacity="0.25" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* 5 optical window */}
      <g transform="translate(250 418) rotate(-22)">
        <rect x="-34" y="-14" width="68" height="28" rx="14" fill="#141416" stroke="url(#ex-ring)" strokeWidth="2" />
        <circle cx="-12" cy="0" r="5" fill="#2C2D31" />
        <circle cx="12" cy="0" r="5" fill="#2C2D31" />
        <circle cx="-12" cy="0" r="2" fill="var(--accent)" opacity="0.8" />
      </g>

      {/* 3 acoustic shell */}
      <g transform="translate(375 322) rotate(-22) scale(0.82)">
        <path d="M -116 10 C -116 -38 -74 -60 -14 -62 C 56 -64 126 -50 128 0 C 130 52 66 70 -10 68 C -76 66 -116 52 -116 10 Z" fill={`url(#${p}-shell)`} />
        <path d="M -94 8 C -93 -28 -60 -44 -12 -45 C 48 -47 108 -36 109 2 C 110 40 56 52 -9 51 C -63 50 -95 42 -94 8 Z" fill="#1A1A1B" />
        <path d="M -90 14 C -88 -18 -58 -32 -14 -33" stroke="#fff" strokeOpacity="0.08" strokeWidth="2" fill="none" />
        <rect x="104" y="-74" width="20" height="36" rx="6" transform="rotate(24 114 -56)" fill={`url(#${p}-barrel)`} />
      </g>

      {/* 4 stimulation fin */}
      <g transform="translate(205 160) rotate(-22)">
        <path d="M -40 70 C -42 32 -26 -2 6 -26 C 20 -36 36 -36 36 -22 C 34 -2 24 28 36 62 C 12 56 -16 58 -40 70 Z" fill={`url(#${p}-fin)`} />
        <rect x="-15" y="18" width="9" height="16" rx="4.5" transform="rotate(24 -10 26)" fill={`url(#${p}-contact)`} />
        <rect x="10" y="-14" width="9" height="16" rx="4.5" transform="rotate(36 14 -6)" fill={`url(#${p}-contact)`} />
        <circle cx="-10" cy="26" r="13" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
        <circle cx="14" cy="-6" r="13" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
      </g>
      <path d="M 252 200 L 300 262" stroke="currentColor" strokeOpacity="0.22" strokeDasharray="2 6" />

      {/* 2 driver */}
      <g transform="translate(530 206) rotate(-22) scale(0.86)">
        <ellipse cx="0" cy="6" rx="70" ry="40" fill="#0E0E10" />
        <ellipse cx="0" cy="0" rx="70" ry="40" fill="url(#ex-ring)" />
        <ellipse cx="0" cy="0" rx="58" ry="32" fill="url(#ex-cone)" />
        {[46, 34, 22].map((r) => (
          <ellipse key={r} cx="0" cy="0" rx={r} ry={r * 0.55} fill="none" stroke="#fff" strokeOpacity="0.08" />
        ))}
        <ellipse cx="0" cy="0" rx="12" ry="7" fill="#8E8A82" />
      </g>

      {/* 1 faceplate */}
      <g transform="translate(668 102) rotate(-22) scale(0.7)">
        <path d="M -116 10 C -116 -38 -74 -60 -14 -62 C 56 -64 126 -50 128 0 C 130 52 66 70 -10 68 C -76 66 -116 52 -116 10 Z" fill="url(#ex-ring)" />
        <path d="M -98 8 C -97 -30 -62 -46 -12 -47 C 50 -49 110 -38 111 2 C 112 42 58 54 -9 53 C -65 52 -99 44 -98 8 Z" fill={`url(#${p}-face)`} />
        <path d="M -98 8 C -97 -30 -62 -46 -12 -47 C 50 -49 110 -38 111 2 C 112 42 58 54 -9 53 C -65 52 -99 44 -98 8 Z" fill={`url(#${p}-sheen)`} />
        <circle cx="66" cy="-18" r="4" fill="var(--accent)" />
        <rect x="56" y="20" width="26" height="6" rx="3" fill="#050506" />
      </g>

      {/* markers */}
      {marker(1, 770, 50)}
      {marker(2, 616, 250)}
      {marker(3, 450, 400)}
      {marker(4, 160, 98)}
      {marker(5, 196, 448)}
      {marker(6, 92, 512)}
    </svg>
  );
}
