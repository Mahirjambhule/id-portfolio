import Image from "next/image";
import { measureLogo } from "@/lib/brand";
// Imported rather than referenced by URL, so the file is fingerprinted: replace
// public/angel-logo.png and the new artwork shows up without a stale cache.
import logoFile from "../../public/angel-logo.png";

interface LogoProps {
  /** The logo is scaled to fit inside this box, keeping its proportions. */
  maxWidth: number;
  maxHeight: number;
  /** `px`, or `u` for the badge's design pixels. */
  unit?: "px" | "u";
  className?: string;
  alt?: string;
  /** Load immediately rather than lazily. For logos that are on screen at once. */
  eager?: boolean;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The wordmark, cropped to its artwork so it sits flush against a grid line
 * whatever margin the file was exported with.
 *
 * A server component: it measures the file. Client components take it as a prop.
 */
export async function Logo({
  maxWidth,
  maxHeight,
  unit = "px",
  className = "",
  alt = "Angel",
  eager = false,
}: LogoProps) {
  const art = await measureLogo();
  const ratio = art.width / art.height;
  const width = Math.min(maxWidth, maxHeight * ratio);
  const height = width / ratio;
  const length = (value: number) => (unit === "px" ? `${round(value)}px` : `calc(var(--u) * ${round(value)})`);

  // The image is larger than the box by the margin being cropped away.
  const overscan = art.fileWidth / art.width;

  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className}`}
      style={{ width: length(width), height: length(height) }}
    >
      <Image
        src={logoFile}
        alt={alt}
        sizes={`${Math.ceil(width * overscan * (unit === "u" ? 1.3 : 1))}px`}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: `${overscan * 100}%`,
          height: "auto",
          left: `${(-art.x / art.width) * 100}%`,
          top: `${(-art.y / art.height) * 100}%`,
        }}
      />
    </span>
  );
}
