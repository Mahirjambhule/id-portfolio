// Reads files and decodes images: importing this from a Client Component is a
// build error rather than a broken page.
import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Where the artwork sits inside the logo file, in the file's own pixels. */
export interface ArtBox {
  x: number;
  y: number;
  width: number;
  height: number;
  fileWidth: number;
  fileHeight: number;
}

const LOGO_FILE = path.join(process.cwd(), "public", "angel-logo.png");

let cache: { stamp: number; box: ArtBox } | undefined;

/**
 * Finds the artwork inside `public/angel-logo.png` by trimming away its empty
 * margin, so an exported logo can be dropped in as it is, whatever padding it
 * came with. Works for transparent and for flat-colour backgrounds.
 *
 * Server-only. The page is static, so this runs once at build time.
 */
export async function measureLogo(): Promise<ArtBox> {
  const { mtimeMs } = await stat(LOGO_FILE);
  if (cache?.stamp === mtimeMs) return cache.box;

  const image = sharp(LOGO_FILE);
  const { width: fileWidth, height: fileHeight } = await image.metadata();
  const { info } = await image.clone().trim().toBuffer({ resolveWithObject: true });

  const box: ArtBox = {
    x: -(info.trimOffsetLeft ?? 0),
    y: -(info.trimOffsetTop ?? 0),
    width: info.width,
    height: info.height,
    fileWidth,
    fileHeight,
  };
  cache = { stamp: mtimeMs, box };
  return box;
}
