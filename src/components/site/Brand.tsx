import Link from "next/link";

/** The beacon mark: a light, two beams, a tower. Geometric, works at 16px. */
export function BeaconMark({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <g className={animated ? "beam-anim" : undefined} fill="#d9a45b">
        <polygon points="14,9.2 2.5,3.6 2.5,7.6" opacity="0.75" />
        <polygon points="14,9.2 25.5,3.6 25.5,7.6" opacity="0.75" />
      </g>
      <circle cx="14" cy="9.2" r="3.3" fill="#315efb" />
      <polygon points="11.7,14 16.3,14 18,25.5 10,25.5" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="brand" style={light ? { color: "#fff" } : undefined} aria-label="Beacon home">
      <BeaconMark size={26} />
      <span>beacon</span>
    </Link>
  );
}

/** Contour lines, like a topographic map, drawn behind the hero. Deterministic, no images. */
export function Topography({ cx = 980, cy = 120, rings = 16 }: { cx?: number; cy?: number; rings?: number }) {
  const paths: string[] = [];
  for (let k = 0; k < rings; k++) {
    const pts: string[] = [];
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const r = 60 + k * 34 + 14 * Math.sin(3 * t + k * 0.35) + 9 * Math.sin(5 * t - k * 0.22) + 5 * Math.cos(7 * t + k * 0.5);
      pts.push(`${(cx + r * Math.cos(t) * 1.35).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`);
    }
    paths.push(`M${pts.join("L")}Z`);
  }
  return (
    <svg className="hero-topo" viewBox="0 0 1400 760" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <radialGradient id="topo-fade" cx="70%" cy="16%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="topo-mask">
          <rect width="1400" height="760" fill="url(#topo-fade)" />
        </mask>
      </defs>
      <g mask="url(#topo-mask)" fill="none" stroke="#dedad2" strokeWidth="1">
        {paths.map((d, i) => (
          <path key={i} d={d} opacity={i % 4 === 0 ? 0.9 : 0.55} />
        ))}
      </g>
      <g stroke="#d9a45b" strokeWidth="1" opacity="0.5">
        <line x1={cx} y1={cy} x2={cx - 520} y2={cy + 520} strokeDasharray="2 6" />
        <line x1={cx} y1={cy} x2={cx - 260} y2={cy + 600} strokeDasharray="2 6" />
      </g>
      <circle cx={cx} cy={cy} r="4" fill="#315efb" />
      <circle cx={cx} cy={cy} r="12" fill="none" stroke="#315efb" strokeOpacity="0.3" />
    </svg>
  );
}
