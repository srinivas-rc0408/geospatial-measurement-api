/**
 * Topographic contour lines behind the hero: one hill outline drawn at several scales, drifting a
 * few pixels over a minute (CSS only, no JavaScript per frame). Static under reduced motion.
 */
const LEVELS = [1, 1.45, 1.95, 2.5, 3.1, 3.8]
const HILLS = [
  { x: 330, y: 300, rotate: -12 },
  { x: 930, y: 560, rotate: 24 },
]

export function ContourBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 size-full mask-hero text-text-tertiary opacity-30"
    >
      <defs>
        <path
          id="contour"
          d="M0-100C55-100 110-62 104-6 98 48 64 96 6 98-52 100-104 66-102 4-100-52-58-100 0-100Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </defs>
      <g className="animate-drift">
        {HILLS.map((hill) =>
          LEVELS.map((scale) => (
            <use
              key={`${hill.x}-${scale}`}
              href="#contour"
              transform={`translate(${hill.x} ${hill.y}) rotate(${hill.rotate + scale * 6}) scale(${scale})`}
            />
          )),
        )}
      </g>
    </svg>
  )
}
