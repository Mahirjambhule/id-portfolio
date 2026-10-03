import Link from "next/link";
import { CLASP, CORD_WIDTH, STEEL_STOPS, STRAND_LEAN } from "@/components/hero/lanyard-render";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";
import "./not-found.css";

/** How much cord is drawn above the clasp, in design pixels: more than any screen shows. */
const LENGTH = 900;
/** The braid, as the hero's canvas draws it: two columns of strands leaning into each other. */
const PITCH = CORD_WIDTH * 0.62;
const LEAN = (STRAND_LEAN * 180) / Math.PI;

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The hero's lanyard with nothing on it: the same braided cord, ferrule,
 * eyelet and ring, drawn in SVG to the hero's design pixels, with the clasp
 * at the origin. It needs no script; CSS lets the air stir it.
 */
function EmptyLanyard() {
  const ferruleHeight = CLASP.ferruleBottom - CLASP.ferruleTop;
  const cord = { y: -LENGTH, height: LENGTH + CLASP.ferruleTop + 6 };
  return (
    <div className="empty-lanyard" aria-hidden>
      <svg viewBox={`-30 ${-LENGTH} 60 ${LENGTH + 12}`}>
        <defs>
          <linearGradient id="empty-lanyard-steel">
            {STEEL_STOPS.map(([offset, colour]) => (
              <stop key={offset} offset={offset} stopColor={colour} />
            ))}
          </linearGradient>
          <linearGradient
            id="empty-lanyard-ring-steel"
            gradientUnits="userSpaceOnUse"
            x1="-6"
            y1={CLASP.ringTop}
            x2="6"
            y2={CLASP.ringBottom}
          >
            {STEEL_STOPS.map(([offset, colour]) => (
              <stop key={offset} offset={offset} stopColor={colour} />
            ))}
          </linearGradient>
          <pattern id="empty-lanyard-braid" patternUnits="userSpaceOnUse" x={-CORD_WIDTH / 2} width={CORD_WIDTH} height={PITCH}>
            {([1, -1] as const).map((side) =>
              [-1, 0, 1].map((k) => {
                const cx = CORD_WIDTH / 2 + side * CORD_WIDTH * 0.2;
                const cy = (side === 1 ? 0 : PITCH / 2) + k * PITCH;
                return (
                  <ellipse
                    key={`${side}${k}`}
                    cx={cx}
                    cy={cy}
                    rx={CORD_WIDTH * 0.44}
                    ry={CORD_WIDTH * 0.215}
                    transform={`rotate(${-90 + side * LEAN} ${cx} ${cy})`}
                    fill={side === 1 ? "#f5f1ea" : "#ffffff"}
                    stroke="rgb(96 78 56 / 0.3)"
                    strokeWidth="0.55"
                  />
                );
              }),
            )}
          </pattern>
          <filter id="empty-lanyard-penumbra" x="-2" y="-0.1" width="5" height="1.2">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Its shadow on the wall: thrown down and to the right, and all penumbra. */}
        <g transform="translate(22 30)" filter="url(#empty-lanyard-penumbra)" opacity="0.1" fill="rgb(74 56 34)">
          <rect x={-CORD_WIDTH / 2 - 2} y={cord.y} width={CORD_WIDTH + 4} height={cord.height} />
          <rect x={-CLASP.ferruleWidth / 2} y={CLASP.ferruleTop} width={CLASP.ferruleWidth} height={ferruleHeight} rx="2.6" />
        </g>

        {/* The cord: a darker core, so the gaps between strands read as grooves, the braid, and its roundness. */}
        <rect x={-(CORD_WIDTH + 1.1) / 2} y={cord.y} width={CORD_WIDTH + 1.1} height={cord.height} fill="#c6beb1" />
        <rect x={-(CORD_WIDTH - 0.4) / 2} y={cord.y} width={CORD_WIDTH - 0.4} height={cord.height} fill="#e0dacf" />
        <rect x={-CORD_WIDTH / 2} y={cord.y} width={CORD_WIDTH} height={cord.height} fill="url(#empty-lanyard-braid)" />
        <rect x={-CORD_WIDTH * 0.35} y={cord.y} width={CORD_WIDTH * 0.16} height={cord.height} fill="rgb(255 255 255 / 0.62)" />
        <rect x={CORD_WIDTH * 0.17} y={cord.y} width={CORD_WIDTH * 0.3} height={cord.height} fill="rgb(88 70 46 / 0.15)" />

        {/* The ring, with nothing to pass through. */}
        <g className="empty-lanyard__ring" fill="none">
          <ellipse
            cy={(CLASP.ringTop + CLASP.ringBottom) / 2}
            rx={CLASP.ringRadius}
            ry={(CLASP.ringBottom - CLASP.ringTop) / 2}
            stroke="rgb(52 44 34 / 0.5)"
            strokeWidth={CLASP.ringWeight + 0.9}
          />
          <ellipse
            cy={(CLASP.ringTop + CLASP.ringBottom) / 2}
            rx={CLASP.ringRadius}
            ry={(CLASP.ringBottom - CLASP.ringTop) / 2}
            stroke="url(#empty-lanyard-ring-steel)"
            strokeWidth={CLASP.ringWeight}
          />
        </g>

        {/* The eyelet it hangs from, and the ferrule crimped over the end of the cord. */}
        <g fill="url(#empty-lanyard-steel)" stroke="rgb(52 44 34 / 0.5)" strokeWidth="0.6">
          <rect
            x={-CLASP.eyeletWidth / 2}
            y={CLASP.eyeletTop}
            width={CLASP.eyeletWidth}
            height={CLASP.eyeletBottom - CLASP.eyeletTop}
            rx="3"
          />
          <rect x={-CLASP.ferruleWidth / 2} y={CLASP.ferruleTop} width={CLASP.ferruleWidth} height={ferruleHeight} rx="2.6" />
        </g>
        {[0.24, 0.76].map((at) => {
          const y = CLASP.ferruleTop + ferruleHeight * at;
          return (
            <g key={at}>
              <rect x={-CLASP.ferruleWidth / 2 + 0.4} y={y} width={CLASP.ferruleWidth - 0.8} height="0.9" fill="rgb(44 38 30 / 0.3)" />
              <rect x={-CLASP.ferruleWidth / 2 + 0.4} y={y + 0.9} width={CLASP.ferruleWidth - 0.8} height="0.6" fill="rgb(255 255 255 / 0.55)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * A page that is not there: the same room as the hero, lit the same way, the
 * lanyard hanging empty, and the way back.
 */
export default function NotFound() {
  return (
    <main className="relative isolate min-h-svh overflow-hidden">
      {/* The hero's wall, already lit. It needs no script: the scene is not here. */}
      <div className="wall" data-lit="true" aria-hidden>
        <div className="wall__scene">
          <div className="wall__wash" />
          <div className="wall__light">
            <div className="wall__beam">
              <div className="wall__pane" />
              <div className="wall__pane" />
              <div className="wall__pane" />
              <div className="wall__pane" />
            </div>
          </div>
        </div>
        <div className="wall__grain" />
      </div>

      <EmptyLanyard />

      <div className="relative z-20 mx-auto flex min-h-svh max-w-[1680px] flex-col px-6 sm:px-10 lg:px-12">
        <header className="flex h-20 items-center lg:h-24">
          <Link href="/" aria-label={`${site.name}, home`} className="block origin-left scale-[0.86] sm:scale-100">
            <Logo maxWidth={124} maxHeight={26} alt="" eager />
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center pb-24 pt-[clamp(120px,20svh,200px)] lg:pb-32 lg:pt-0">
          <p className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
            <span aria-hidden className="h-px w-8 bg-ink/25" />
            Error
            <span aria-hidden className="text-ink/25">
              /
            </span>
            404
          </p>
          <h1 className="mt-6 font-display text-[clamp(2.75rem,8vw,6rem)] font-light leading-[0.98] tracking-[-0.03em] lg:mt-9">
            Nothing hangs <em className="text-cobalt">here.</em>
          </h1>
          <p className="mt-6 max-w-[28rem] text-pretty text-[1.0625rem] leading-[1.55] text-ink-soft lg:mt-9 lg:text-[1.1875rem]">
            The page you were looking for has been taken down, or was never on the wall.
          </p>
          <Link
            href="/"
            className="group mt-9 inline-flex h-13 w-fit items-center gap-4 rounded-full bg-cobalt pl-7 pr-2 font-mono text-[0.71875rem] uppercase tracking-[0.12em] text-paper transition-colors duration-500 hover:bg-cobalt-deep lg:mt-12"
          >
            Back to the studio
            <span className="grid size-9 place-items-center rounded-full bg-paper text-cobalt transition-[rotate] duration-500 ease-out-expo group-hover:-rotate-45">
              <Arrow />
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
