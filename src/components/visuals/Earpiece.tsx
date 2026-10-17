/**
 * Concept earpiece, drawn as SVG so every section shows the same device.
 *
 * Local coordinate space is 400 × 400. The piece is a LEFT earpiece seen from
 * the outer face (the side visible when worn). Mirror the group for the right.
 *
 * Anatomy (concept, not a validated geometry):
 *  - anodised titanium shell with graphite faceplate
 *  - nozzle + silicone ear tip (behind the shell, pointing into the canal)
 *  - soft silicone fin reaching toward the cymba conchae, carrying two small
 *    stimulation contacts
 *  - detachable cable barrel at the top rear
 */

export function EarpieceDefs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-shell`} x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor="#F2EFE8" />
        <stop offset="0.35" stopColor="#C9C4BA" />
        <stop offset="0.72" stopColor="#8E8A82" />
        <stop offset="1" stopColor="#5C5954" />
      </linearGradient>
      <linearGradient id={`${p}-side`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5E5B56" />
        <stop offset="1" stopColor="#1C1B1A" />
      </linearGradient>
      <radialGradient id={`${p}-face`} cx="0.36" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#4A4C51" />
        <stop offset="0.5" stopColor="#25262A" />
        <stop offset="1" stopColor="#111214" />
      </radialGradient>
      <linearGradient id={`${p}-sheen`} x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
        <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.02" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${p}-fin`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5A5C61" stopOpacity="0.96" />
        <stop offset="1" stopColor="#1E1F22" stopOpacity="0.98" />
      </linearGradient>
      <radialGradient id={`${p}-tip`} cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stopColor="#7A7C80" />
        <stop offset="0.6" stopColor="#3A3B3F" />
        <stop offset="1" stopColor="#1B1C1E" />
      </radialGradient>
      <linearGradient id={`${p}-contact`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FBFAF6" />
        <stop offset="1" stopColor="#9A968D" />
      </linearGradient>
      <linearGradient id={`${p}-barrel`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2A2A2C" />
        <stop offset="0.45" stopColor="#6B6A68" />
        <stop offset="1" stopColor="#1A1A1B" />
      </linearGradient>
      <clipPath id={`${p}-faceclip`}>
        <path d={FACE} />
      </clipPath>
      <filter id={`${p}-soft`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.6" />
      </filter>
    </defs>
  );
}

const ROT = -22;
const PIVOT = { x: 220, y: 200 };

/** Map a point from the unrotated drawing into the earpiece's local space. */
export function earpiecePoint(x: number, y: number) {
  const a = (ROT * Math.PI) / 180;
  const dx = x - PIVOT.x;
  const dy = y - PIVOT.y;
  return {
    x: PIVOT.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: PIVOT.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/** Where the cable leaves the barrel, in local (rotated) space. */
export const CABLE_ANCHOR = earpiecePoint(321, 116);

// Unrotated outlines. The whole group is rotated by ROT around PIVOT.
const SHELL =
  "M 100 206 C 100 160 142 140 202 138 C 272 136 342 150 344 200 C 346 252 282 270 206 268 C 140 266 100 252 100 206 Z";
const SIDE =
  "M 104 216 C 104 172 146 152 206 150 C 274 148 340 162 342 212 C 344 262 282 282 208 280 C 144 278 104 262 104 216 Z";
const FACE =
  "M 122 205 C 123 168 156 155 204 154 C 264 152 324 163 325 201 C 326 240 272 253 207 252 C 153 251 121 242 122 205 Z";
const FIN =
  "M 146 152 C 144 114 160 80 192 56 C 206 46 222 46 222 60 C 220 80 210 110 222 144 C 198 138 170 140 146 152 Z";

export function Earpiece({
  p,
  highlight = "none",
  pulse = false,
  label = "L",
}: {
  p: string;
  highlight?: "none" | "contacts" | "sensors";
  pulse?: boolean;
  label?: string;
}) {
  const hot = highlight === "contacts";
  return (
    <g transform={`rotate(${ROT} ${PIVOT.x} ${PIVOT.y})`}>
      {/* nozzle + ear tip, behind the shell, angled into the canal */}
      <g>
        <path d="M 128 236 L 96 270 L 116 286 L 150 252 Z" fill="#252527" />
        <path d="M 128 236 L 96 270 L 103 276 L 136 242 Z" fill="#6A6965" opacity="0.5" />
        <g transform="rotate(-42 86 290)">
          <path
            d="M 52 290 C 52 266 70 254 86 254 C 102 254 120 266 120 290 C 120 300 104 306 86 306 C 68 306 52 300 52 290 Z"
            fill={`url(#${p}-tip)`}
          />
          <ellipse cx="86" cy="296" rx="30" ry="8" fill="#000" opacity="0.35" />
          <ellipse cx="86" cy="296" rx="9" ry="3" fill="#000" opacity="0.8" />
          <path d="M 64 276 C 70 264 80 260 92 260" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
        {highlight === "sensors" && (
          <ellipse cx="86" cy="282" rx="38" ry="30" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="3 4" />
        )}
      </g>

      {/* soft silicone fin carrying two stimulation contacts */}
      <g>
        <path d={FIN} fill={`url(#${p}-fin)`} />
        <path d="M 160 120 C 166 92 180 70 200 56" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" fill="none" />
        <rect x="171" y="100" width="9" height="16" rx="4.5" transform="rotate(24 175 108)" fill={`url(#${p}-contact)`} />
        <rect x="196" y="68" width="9" height="16" rx="4.5" transform="rotate(36 200 76)" fill={`url(#${p}-contact)`} />
        {hot && (
          <g fill="none" stroke="var(--accent)" strokeWidth="1.6">
            <circle cx="175" cy="108" r="13" />
            <circle cx="200" cy="76" r="13" />
          </g>
        )}
        {pulse && (
          <g fill="none" stroke="var(--accent)" strokeWidth="1.2" className="contact-pulse">
            <circle cx="188" cy="92" r="30" />
            <circle cx="188" cy="92" r="30" style={{ animationDelay: "1.4s" }} />
          </g>
        )}
      </g>

      {/* detachable cable barrel */}
      <g transform="rotate(24 306 150)">
        <rect x="295" y="112" width="22" height="44" rx="7" fill={`url(#${p}-barrel)`} />
        <rect x="299" y="115" width="14" height="3" rx="1.5" fill="#FFFFFF" opacity="0.14" />
      </g>

      {/* shell */}
      <path d={SIDE} fill={`url(#${p}-side)`} />
      <path d={SHELL} fill={`url(#${p}-shell)`} />
      <path d="M 112 196 C 118 160 156 146 206 146 C 250 145 300 150 326 166" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* faceplate */}
      <path d={FACE} fill={`url(#${p}-face)`} />
      <g clipPath={`url(#${p}-faceclip)`} opacity="0.55">
        {Array.from({ length: 16 }).map((_, i) => (
          <ellipse key={i} cx="228" cy="204" rx={12 + i * 8} ry={6 + i * 4} fill="none" stroke="#FFFFFF" strokeOpacity={0.05 - i * 0.002} strokeWidth="1" />
        ))}
      </g>
      <path d={FACE} fill={`url(#${p}-sheen)`} />
      <path d={FACE} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="1.2" />
      <rect x="282" y="222" width="22" height="5" rx="2.5" fill="#050506" />
      <circle cx="292" cy="182" r="3" fill="var(--accent)" />
      {label && (
        <text x="150" y="214" fontFamily="var(--font-mono), ui-monospace, monospace" fontSize="10" letterSpacing="2" fill="#FFFFFF" fillOpacity="0.3">
          {label}
        </text>
      )}

    </g>
  );
}
