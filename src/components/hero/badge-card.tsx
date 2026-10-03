import Image from "next/image";
import { Logo } from "@/components/logo";
import { qrShape } from "@/lib/qr";
import { site } from "@/lib/site";
// Imported rather than referenced by URL, so the file is fingerprinted: replace
// public/angel-portrait.png and the new photo shows up without a stale cache.
import portrait from "../../../public/angel-portrait.png";

// Braille cells. Dots are numbered 1-3 down the left column and 4-6 down the right.
const BRAILLE: Record<string, readonly number[]> = {
  a: [1],
  b: [1, 2],
  c: [1, 4],
  d: [1, 4, 5],
  e: [1, 5],
  f: [1, 2, 4],
  g: [1, 2, 4, 5],
  h: [1, 2, 5],
  i: [2, 4],
  j: [2, 4, 5],
  k: [1, 3],
  l: [1, 2, 3],
  m: [1, 3, 4],
  n: [1, 3, 4, 5],
  o: [1, 3, 5],
  p: [1, 2, 3, 4],
  q: [1, 2, 3, 4, 5],
  r: [1, 2, 3, 5],
  s: [2, 3, 4],
  t: [2, 3, 4, 5],
  u: [1, 3, 6],
  v: [1, 2, 3, 6],
  w: [2, 4, 5, 6],
  x: [1, 3, 4, 6],
  y: [1, 3, 4, 5, 6],
  z: [1, 3, 5, 6],
};

const DOTS = [1, 2, 3, 4, 5, 6] as const;

function NfcIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="4 2.5 13 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5.83 8.79A5 5 0 0 1 5.83 15.21" />
      <path d="M8.89 6.21A9 9 0 0 1 8.89 17.79" />
      <path d="M11.96 3.64A13 13 0 0 1 11.96 20.36" />
    </svg>
  );
}

// The marks beside the lines on the back. Drawn, not borrowed: no brand logos.
function LinkIcon({ name }: { name: "copy" | "out" | "down" }) {
  return (
    <svg className="badge__link-icon" viewBox="0 0 16 16" aria-hidden>
      {name === "copy" && <path d="M6 6V3.5h6.5V10H10M3.5 6H10v6.5H3.5Z" />}
      {name === "out" && <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />}
      {name === "down" && (
        <>
          <path className="badge__link-arrow" d="M8 2.5v7.5M5 7.2 8 10.2l3-3" />
          <path d="M3.5 13.2h9" />
        </>
      )}
    </svg>
  );
}

/**
 * The studio pass. Pure markup: the stage positions it and drives its
 * reflections through the `data-badge-*` hooks.
 *
 * It has a back, a business card, which the closing section turns it over to
 * show. The back is part of the picture, like the front: the closing section
 * carries the same links for keyboards and screen readers, and brings these
 * to life through the `data-contact` hooks.
 */
export function BadgeCard() {
  const qr = qrShape(site.url);
  // Scanned from the back, the card opens a message to its owner.
  const scan = qrShape(`mailto:${site.email}`);
  const letters = site.name
    .toLowerCase()
    .split("")
    .filter((letter) => letter in BRAILLE)
    .slice(0, 8);

  return (
    <div className="badge" data-badge>
      {/* To assistive technology the card is one picture, and the slab under
          the whole of it is that picture. The card itself is not: an image
          cannot hold the links on the back, which are there for a pointer. */}
      <div
        className="badge__slab"
        role="img"
        aria-label={`${site.name}'s studio pass. ${site.role}. ${site.availability.label}.`}
      />
      <div className="badge__frost" />
      <div className="badge__slot" />

      <div className="badge__head">
        <Logo maxWidth={96} maxHeight={22} unit="u" alt="" eager />
        <NfcIcon className="badge__nfc" />
      </div>

      <div className="badge__photo">
        <Image
          className="badge__portrait"
          data-badge-portrait
          src={portrait}
          sizes="(min-width: 1024px) 340px, 220px"
          quality={90}
          loading="eager"
          fetchPriority="high"
          draggable={false}
          alt=""
        />
      </div>

      {/* Its words are in the picture's description. */}
      <div className="badge__info" aria-hidden>
        <div>
          <p className="badge__name">{site.name}</p>
          <p className="badge__role">{site.role}</p>
        </div>
        <svg className="badge__qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" aria-hidden>
          <path d={qr.path} fill="currentColor" />
        </svg>
      </div>

      <div className="badge__rule" />

      <div className="badge__foot" aria-hidden>
        <span className="badge__status">
          <span className="badge__dot" data-open={site.availability.open} />
          {site.availability.label}
        </span>
        <span className="badge__serial">№ {site.badge.serial}</span>
      </div>

      <div className="badge__base" aria-hidden>
        <span className="badge__micro">Studio pass — {site.badge.edition}</span>
        <span className="badge__braille">
          {letters.map((letter, index) => (
            <span className="badge__cell" key={`${letter}-${index}`}>
              {DOTS.map((dot) => (
                <span key={dot} className={BRAILLE[letter].includes(dot) ? "badge__bump" : undefined} />
              ))}
            </span>
          ))}
        </span>
      </div>

      {/* The back. Out of sight until the card has turned past its edge. */}
      <div className="badge__back" data-badge-back aria-hidden>
        <div className="badge__back-head">
          <span>Contact</span>
          <i />
          <span>№ {site.badge.serial}</span>
        </div>
        <p className="badge__back-name">{site.name}</p>
        <p className="badge__back-role">{site.role}</p>

        <div className="badge__links">
          <a className="badge__link" data-contact="email" href={`mailto:${site.email}`} tabIndex={-1} draggable={false}>
            <span className="badge__link-label">Email</span>
            <span className="badge__link-value">
              <span className="badge__link-text">{site.email}</span>
              <span className="badge__link-note">Copied ✓</span>
            </span>
            <LinkIcon name="copy" />
          </a>
          <a
            className="badge__link"
            data-contact="github"
            href={site.contact.github.href}
            rel="noreferrer"
            tabIndex={-1}
            draggable={false}
          >
            <span className="badge__link-label">GitHub</span>
            <span className="badge__link-value">
              <span className="badge__link-text">{site.contact.github.label}</span>
            </span>
            <LinkIcon name="out" />
          </a>
          <a
            className="badge__link"
            data-contact="linkedin"
            href={site.contact.linkedin.href}
            rel="noreferrer"
            tabIndex={-1}
            draggable={false}
          >
            <span className="badge__link-label">LinkedIn</span>
            <span className="badge__link-value">
              <span className="badge__link-text">{site.contact.linkedin.label}</span>
            </span>
            <LinkIcon name="out" />
          </a>
          <a
            className="badge__link"
            data-contact="resume"
            href={site.contact.resume.href}
            download={site.contact.resume.file}
            tabIndex={-1}
            draggable={false}
          >
            <span className="badge__link-label">Resume</span>
            <span className="badge__link-value">
              <span className="badge__link-text">{site.contact.resume.label}</span>
              <span className="badge__link-note">Downloading…</span>
            </span>
            <LinkIcon name="down" />
          </a>
        </div>

        <button type="button" className="badge__scan" data-contact="qr" tabIndex={-1}>
          <span className="badge__scan-plate">
            <svg viewBox={`0 0 ${scan.size} ${scan.size}`} shapeRendering="crispEdges" aria-hidden>
              <path d={scan.path} fill="currentColor" />
            </svg>
          </span>
          <span className="badge__scan-copy">
            <span className="badge__link-label">QR Code</span>
            <span className="badge__scan-line">Scan to connect</span>
          </span>
        </button>
      </div>

      <div className="badge__shade" data-badge-shade />
      <div className="badge__gloss">
        <div className="badge__window" data-badge-window />
        <div className="badge__sheen" data-badge-sheen />
        <div className="badge__glance" data-badge-glance />
      </div>
      <div className="badge__glint badge__glint--left" data-badge-glint-left />
      <div className="badge__glint badge__glint--right" data-badge-glint-right />
    </div>
  );
}
