import { CABLE_ANCHOR, Earpiece, EarpieceDefs } from "./Earpiece";

/**
 * Line drawing of a left ear with the concept earpiece seated in the concha.
 * The fin rests in the cymba conchae, the region of the outer ear that
 * receives sensory fibres from the auricular branch of the vagus nerve.
 */
export function EarView({ className = "", showLabels = true }: { className?: string; showLabels?: boolean }) {
  const p = "ear";
  const cable = { x: 160 + CABLE_ANCHOR.x * 0.42, y: 215 + CABLE_ANCHOR.y * 0.42 };
  return (
    <svg
      viewBox="40 40 500 490"
      className={className}
      role="img"
      aria-label="Line drawing of an outer ear with the earpiece seated in the bowl of the ear. A soft fin reaches up into the cymba conchae, a small hollow above the ear canal, where two contacts would rest."
    >
      <EarpieceDefs p={p} />
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* helix */}
        <path d="M 178 236 C 150 160 190 80 270 76 C 350 72 400 140 392 230 C 386 300 352 340 346 392 C 340 440 330 492 276 500 C 236 506 214 482 220 452 C 224 432 232 420 226 404" />
        <path d="M 196 222 C 186 160 222 104 276 102 C 340 100 372 160 366 228 C 360 290 330 320 322 360" opacity="0.4" />
        {/* antihelix and crura */}
        <path d="M 300 400 C 330 360 344 300 330 252 C 328 246 325 240 322 236" opacity="0.8" />
        <path d="M 322 236 C 324 200 330 160 346 130" opacity="0.55" />
        <path d="M 322 236 C 300 222 260 216 210 222" opacity="0.8" />
        {/* crus of helix */}
        <path d="M 180 262 C 208 272 240 280 268 282" opacity="0.8" />
        {/* concha edge */}
        <path d="M 304 256 C 322 294 318 350 292 386" opacity="0.35" />
        {/* tragus, antitragus */}
        <path d="M 198 328 C 178 336 176 376 194 390 C 200 394 208 392 212 386" />
        <path d="M 262 420 C 284 414 300 404 306 392" opacity="0.8" />
      </g>

      {/* cymba conchae */}
      <path
        d="M 206 230 C 240 220 290 222 316 240 C 300 262 270 276 240 274 C 220 272 206 256 206 230 Z"
        fill="var(--accent)"
        fillOpacity="0.14"
        stroke="var(--accent)"
        strokeOpacity="0.7"
        strokeDasharray="2 4"
        strokeWidth="1.2"
      />

      {/* Cable falls below the earpiece, matching the product concept images. */}
      <path d={`M ${cable.x} ${cable.y} C ${cable.x + 10} ${cable.y + 25}, 294 402, 292 440 S 288 494, 296 520`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.9" />

      {/* earpiece */}
      <g transform="translate(160 215) scale(0.42)">
        <Earpiece p={p} highlight="contacts" pulse label="" />
      </g>

      {showLabels && (
        <g fontFamily="var(--font-mono), ui-monospace, monospace" fontSize="10.5" letterSpacing="1.4" fill="currentColor">
          <path d="M 300 246 L 450 246" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          <circle cx="300" cy="246" r="2" fill="var(--accent)" />
          <text x="440" y="234" textAnchor="start">CYMBA</text>
          <text x="440" y="264" textAnchor="start">CONCHAE</text>
          <path d="M 200 352 L 80 352" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          <text x="60" y="342">EAR CANAL</text>
        </g>
      )}
    </svg>
  );
}
