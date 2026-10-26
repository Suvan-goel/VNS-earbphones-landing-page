import { CABLE_ANCHOR, Earpiece, EarpieceDefs } from "./Earpiece";

/**
 * Hero composition: the pair resting at slightly different angles, cables
 * meeting at a split, and the inline control module that houses the
 * stimulation and sensing electronics.
 */
export function HeroPair({ className = "", p = "hero" }: { className?: string; p?: string }) {

  // Left earpiece: upper left, as placed.
  const L = { x: 120, y: 40, s: 1.32, r: -4 };
  // Right earpiece: mirrored, lower right, turned a little further.
  const R = { x: 1120, y: 150, s: 1.22, r: 10 };

  const place = (o: typeof L, mirror: boolean) => {
    const sx = mirror ? -o.s : o.s;
    const rad = (o.r * Math.PI) / 180;
    // local -> scaled -> rotated around local origin -> translated
    const lx = CABLE_ANCHOR.x * sx;
    const ly = CABLE_ANCHOR.y * o.s;
    return {
      x: o.x + lx * Math.cos(rad) - ly * Math.sin(rad),
      y: o.y + lx * Math.sin(rad) + ly * Math.cos(rad),
    };
  };
  const la = place(L, false);
  const ra = place(R, true);
  const split = { x: 640, y: 540 };

  const leftCable = `M ${la.x} ${la.y} C ${la.x + 8} ${la.y + 62}, ${split.x - 24} ${split.y - 70}, ${split.x - 2} ${split.y}`;
  const rightCable = `M ${ra.x} ${ra.y} C ${ra.x - 8} ${ra.y + 52}, ${split.x + 24} ${split.y - 40}, ${split.x + 2} ${split.y}`;

  return (
    <svg
      viewBox="250 20 740 770"
      className={className}
      role="img"
      aria-label="A pair of premium wired in-ear earphones in titanium and graphite. Each earpiece has a slim soft fin carrying two small contacts, and the cable runs to a compact inline control module."
    >
      <EarpieceDefs p={p} />
      <defs>
        <linearGradient id={`${p}-module`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3F3D3A" />
          <stop offset="0.28" stopColor="#DCD8D0" />
          <stop offset="0.55" stopColor="#A9A59D" />
          <stop offset="1" stopColor="#353431" />
        </linearGradient>
        <radialGradient id={`${p}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* contact shadows */}
      <ellipse cx="420" cy="430" rx="170" ry="26" fill={`url(#${p}-shadow)`} />
      <ellipse cx="820" cy="555" rx="160" ry="24" fill={`url(#${p}-shadow)`} />
      <ellipse cx="640" cy="766" rx="80" ry="10" fill={`url(#${p}-shadow)`} />

      {/* cables */}
      <g fill="none" strokeLinecap="round" className="cable-draw">
        <path d={leftCable} stroke="#2A2927" strokeWidth="5" />
        <path d={rightCable} stroke="#2A2927" strokeWidth="5" />
        <path d={`M ${split.x} ${split.y + 10} L ${split.x} 586`} stroke="#2A2927" strokeWidth="6" />
        <path d={`M ${split.x} 730 L ${split.x} 780`} stroke="#2A2927" strokeWidth="6" />
      </g>
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="1.2" strokeLinecap="round" className="cable-draw">
        <path d={leftCable} transform="translate(-1.5 -1)" />
        <path d={rightCable} transform="translate(-1.5 -1)" />
      </g>

      {/* split slider */}
      <rect x={split.x - 10} y={split.y - 6} width="20" height="26" rx="6" fill={`url(#${p}-module)`} />

      {/* inline control module */}
      <g>
        <rect x={split.x - 26} y="580" width="52" height="156" rx="26" fill={`url(#${p}-module)`} />
        <rect x={split.x - 26} y="580" width="52" height="156" rx="26" fill="none" stroke="#000" strokeOpacity="0.35" />
        <rect x={split.x - 14} y="596" width="28" height="46" rx="14" fill="#141416" />
        <rect x={split.x - 11} y="599" width="22" height="40" rx="11" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" />
        <circle cx={split.x} cy="662" r="2.6" fill="var(--accent)" />
        <path
          d={`M ${split.x - 8} 682 L ${split.x + 8} 682 M ${split.x - 8} 690 L ${split.x + 8} 690 M ${split.x - 8} 698 L ${split.x + 8} 698`}
          stroke="#000"
          strokeOpacity="0.28"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <rect x={split.x - 20} y="588" width="6" height="140" rx="3" fill="#FFFFFF" opacity="0.24" />
      </g>

      {/* earpieces */}
      <g transform={`translate(${L.x} ${L.y}) rotate(${L.r}) scale(${L.s})`}>
        <Earpiece p={p} label="L" />
      </g>
      <g transform={`translate(${R.x} ${R.y}) rotate(${R.r}) scale(${-R.s} ${R.s})`}>
        <Earpiece p={p} label="" />
      </g>
    </svg>
  );
}
