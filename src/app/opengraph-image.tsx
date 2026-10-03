import { ImageResponse } from "next/og";
import path from "node:path";
import sharp from "sharp";
import { qrShape } from "@/lib/qr";
import { site } from "@/lib/site";

/**
 * The picture shown where a link to the site is shared: the hero, as a still.
 * The greeting on the wall and the studio pass hanging beside it, set in the
 * site's own type and drawn from `site.ts`, the logo and the portrait, so it
 * follows them when they change. Made once, at build time.
 */

export const alt = `“Hello, I’m ${site.name}, a ${site.role.toLowerCase()}”, beside ${site.name}’s studio pass.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1b1815";
/** The site's one accent (`--color-cobalt` in globals.css): the ink the name is signed in. */
const COBALT = "#1c3a94";
const FAINT = "#726a60";
const LABEL = "PORTFOLIO  /  2026";
const SIGNED = `I’m ${site.name}`;
const ROLE = `a ${site.role.toLowerCase()}.`;
const PASS_ROLE = site.role.toUpperCase();
const SERIAL = `№ ${site.badge.serial}`;
const PASS = `STUDIO PASS — ${site.badge.edition}`;

/** The badge, at the size it is designed at, and where it hangs. */
const CARD = { width: 300, height: 478, x: 820, y: 104 };

/**
 * One of the site's fonts, cut down to the letters it sets here. Google sends
 * TrueType when asked like this, and TrueType is what the renderer reads. If it
 * cannot be had, the picture is still made, in the renderer's own type.
 */
async function googleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`).then(
      (response) => response.text(),
    );
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const response = await fetch(url);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const dataUrl = (buffer: Buffer, type: string) => `data:${type};base64,${buffer.toString("base64")}`;

/** The portrait, cropped to the badge's photo window as the site crops it (`object-position: 50% 22%`). */
async function portrait(width: number, height: number): Promise<string> {
  const file = path.join(process.cwd(), "public", "angel-portrait.png");
  const image = sharp(file);
  const meta = await image.metadata();
  const fileWidth = meta.width ?? width;
  const fileHeight = meta.height ?? height;
  const scale = Math.max(width / fileWidth, height / fileHeight);
  const cropWidth = Math.round(width / scale);
  const cropHeight = Math.round(height / scale);
  const crop = await image
    .extract({
      left: Math.round((fileWidth - cropWidth) * 0.5),
      top: Math.round((fileHeight - cropHeight) * 0.22),
      width: cropWidth,
      height: cropHeight,
    })
    .resize(width * 2, height * 2)
    .jpeg({ quality: 84 })
    .toBuffer();
  return dataUrl(crop, "image/jpeg");
}

/** The logo with its empty margin trimmed away, and its proportions. */
async function logo(): Promise<{ src: string; ratio: number }> {
  const { data, info } = await sharp(path.join(process.cwd(), "public", "angel-logo.png"))
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });
  return { src: dataUrl(data, "image/png"), ratio: info.width / info.height };
}

export default async function Image() {
  const [serif, italic, name, script, mono, monoMedium, photo, mark] = await Promise.all([
    googleFont("Newsreader:opsz,wght@72,300", "Hello,"),
    googleFont("Newsreader:ital,opsz,wght@1,72,300", ROLE),
    // The mono has no "№": the serif's stands in for it, as the browser's own fallback does on the site.
    googleFont("Newsreader:opsz,wght@72,400", `${site.name}№`),
    googleFont("The+Nautigal", SIGNED),
    googleFont("DM+Mono:wght@400", `${LABEL}${site.availability.label}${PASS}`),
    googleFont("DM+Mono:wght@500", `${PASS_ROLE}${SERIAL}`),
    portrait(268, 232),
    logo(),
  ]);
  const fonts = (
    [
      ["Newsreader", serif, 300, "normal"],
      ["Newsreader", italic, 300, "italic"],
      ["Newsreader", name, 400, "normal"],
      ["The Nautigal", script, 400, "normal"],
      ["DM Mono", mono, 400, "normal"],
      ["DM Mono", monoMedium, 500, "normal"],
    ] as const
  )
    .filter(([, data]) => data)
    .map(([family, data, weight, style]) => ({ name: family, data: data as ArrayBuffer, weight, style }));

  const qr = qrShape(site.url);
  const qrSrc = dataUrl(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><path d="${qr.path}" fill="rgb(27,24,21)" fill-opacity="0.88"/></svg>`,
    ),
    "image/svg+xml",
  );
  const logoHeight = Math.min(22, 96 / mark.ratio);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#f4f1eb",
          // Daylight pooling at the top left, and a window's worth of it falling across the wall behind the pass.
          backgroundImage:
            "radial-gradient(90% 80% at 14% 0%, rgba(255,255,255,0.92), rgba(255,255,255,0) 70%), " +
            "linear-gradient(104deg, rgba(255,255,255,0) 50%, rgba(255,254,250,0.55) 56%, rgba(255,254,250,0.5) 74%, rgba(255,255,255,0) 82%), " +
            "linear-gradient(142deg, rgba(255,255,255,0) 45%, rgba(186,184,180,0.22) 100%)",
          color: INK,
        }}
      >
        {/* The greeting, as the hero sets it. */}
        <div style={{ position: "absolute", left: 80, top: 150, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", fontFamily: "DM Mono", fontSize: 15, letterSpacing: "0.18em", color: FAINT }}>
            <div style={{ width: 34, height: 1, backgroundColor: "rgba(27,24,21,0.25)", marginRight: 14 }} />
            {LABEL}
          </div>
          <div style={{ marginTop: 34, fontFamily: "Newsreader", fontWeight: 300, fontSize: 80, lineHeight: 0.98, letterSpacing: "-0.03em" }}>
            Hello,
          </div>
          <div
            style={{
              fontFamily: "The Nautigal",
              fontSize: 132,
              color: COBALT,
              lineHeight: 0.86,
              marginTop: 6,
              transform: "rotate(-4deg)",
              transformOrigin: "0% 100%",
            }}
          >
            {SIGNED}
          </div>
          <div
            style={{
              fontFamily: "Newsreader",
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 80,
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
              marginTop: 16,
            }}
          >
            {ROLE}
          </div>
        </div>

        {/* The cord it hangs from. */}
        <div
          style={{
            position: "absolute",
            left: CARD.x + CARD.width / 2 - 5,
            top: 0,
            width: 10,
            height: CARD.y + 20,
            backgroundImage: "linear-gradient(90deg, #c6beb1, #f5f1ea 30%, #ffffff 48%, #e0dacf 72%, #c6beb1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: CARD.x + CARD.width / 2 - 7,
            top: CARD.y - 34,
            width: 14,
            height: 18,
            borderRadius: 3,
            backgroundImage: "linear-gradient(90deg, #6f6a63, #d9d5ce 22%, #ffffff 40%, #a8a39b 62%, #e6e2dc 82%, #7d7870)",
            boxShadow: "0 0 0 0.6px rgba(52,44,34,0.5)",
          }}
        />

        {/* The studio pass: a slab of frosted acrylic with its shadow on the wall. */}
        <div
          style={{
            position: "absolute",
            left: CARD.x,
            top: CARD.y,
            width: CARD.width,
            height: CARD.height,
            display: "flex",
            borderRadius: 22,
            backgroundImage:
              "radial-gradient(130% 70% at 8% 0%, rgba(255,255,255,0.98), rgba(255,255,255,0) 62%), " +
              "linear-gradient(158deg, #fdfcfa 0%, #f9f7f3 48%, #f2eee8 100%)",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.9), 0 0 0 0.6px rgba(104,84,58,0.25), " +
              "26px 34px 46px rgba(84,64,38,0.2), 12px 16px 16px rgba(72,54,32,0.12)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 6,
              right: 6,
              bottom: 6,
              borderRadius: 16.5,
              backgroundColor: "rgba(255,255,255,0.44)",
              boxShadow: "inset 0 0 0 0.75px rgba(255,255,255,0.95), 0 0 0 0.6px rgba(118,96,66,0.08)",
            }}
          />
          {/* The slot the ring passes through. */}
          <div
            style={{
              position: "absolute",
              left: CARD.width / 2 - 20,
              top: 14,
              width: 40,
              height: 9,
              borderRadius: 999,
              backgroundColor: "rgba(226,219,208,0.95)",
              boxShadow: "inset 0 1.4px 1.8px rgba(70,52,30,0.34), 0 0.9px 0 rgba(255,255,255,0.9)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mark.src}
            alt=""
            width={logoHeight * mark.ratio}
            height={logoHeight}
            style={{ position: "absolute", left: 21, top: 37 + (25 - logoHeight) / 2 }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            width={268}
            height={232}
            style={{ position: "absolute", left: 16, top: 74, borderRadius: 11, boxShadow: "inset 0 0 0 0.75px rgba(60,45,30,0.14)" }}
          />
          <div style={{ position: "absolute", left: 22, top: 321, display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Newsreader", fontWeight: 400, fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {site.name}
            </div>
            <div
              style={{
                marginTop: 9,
                fontFamily: "DM Mono",
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "rgba(27,24,21,0.72)",
              }}
            >
              {PASS_ROLE}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="" width={48} height={48} style={{ position: "absolute", right: 20, top: 325 }} />
          <div
            style={{
              position: "absolute",
              left: 22,
              right: 20,
              top: 392,
              height: 1,
              backgroundColor: "rgba(60,45,30,0.13)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.95)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              top: 404,
              height: 25,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                height: 25,
                display: "flex",
                alignItems: "center",
                padding: "0 11px 0 9px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.8)",
                boxShadow: "inset 0 0 0 0.75px rgba(27,24,21,0.1)",
                fontFamily: "DM Mono",
                fontSize: 11,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  marginRight: 7,
                  borderRadius: 999,
                  backgroundColor: site.availability.open ? "#4a9f6e" : FAINT,
                }}
              />
              {site.availability.label}
            </div>
            <div style={{ fontFamily: "DM Mono", fontWeight: 500, fontSize: 11, letterSpacing: "0.16em", color: "rgba(60,45,30,0.4)" }}>
              {SERIAL}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 22,
              top: 442,
              fontFamily: "DM Mono",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(27,24,21,0.66)",
            }}
          >
            {PASS}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
