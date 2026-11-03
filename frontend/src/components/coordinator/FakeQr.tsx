/*
  Draws a QR-looking pattern from a token so the screen matches the wireframe.
  It is NOT a scannable QR code. When the backend issues real signed tokens, swap this for a
  QR library (e.g. `qrcode`) that encodes the token.
*/

const SIZE = 25;
const FINDER = 7;

/** Small deterministic PRNG so the same token always draws the same pattern. */
function seeded(token: string) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function inFinder(x: number, y: number) {
  const corners = [
    [0, 0],
    [SIZE - FINDER, 0],
    [0, SIZE - FINDER],
  ];
  return corners.some(([cx, cy]) => x >= cx - 1 && x <= cx + FINDER && y >= cy - 1 && y <= cy + FINDER);
}

export function FakeQr({ token, className }: { token: string; className?: string }) {
  const rand = seeded(token);
  const cells: [number, number][] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inFinder(x, y) && rand() > 0.52) cells.push([x, y]);
    }
  }
  const finders = [
    [0, 0],
    [SIZE - FINDER, 0],
    [0, SIZE - FINDER],
  ];

  return (
    <svg viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`} className={className} role="img" aria-label="Event QR code (placeholder)">
      <rect x={-2} y={-2} width={SIZE + 4} height={SIZE + 4} fill="#ffffff" />
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={FINDER} height={FINDER} fill="#111827" />
          <rect x={x + 1} y={y + 1} width={FINDER - 2} height={FINDER - 2} fill="#ffffff" />
          <rect x={x + 2} y={y + 2} width={FINDER - 4} height={FINDER - 4} fill="#111827" />
        </g>
      ))}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="#111827" />
      ))}
    </svg>
  );
}
