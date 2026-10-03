import { create } from "qrcode";

export interface QrShape {
  /** Modules per side. */
  size: number;
  /** SVG path covering every dark module, in module units. */
  path: string;
}

/** Encodes `value` as a QR code and returns it as one compact SVG path. Server-only. */
export function qrShape(value: string): QrShape {
  const { modules } = create(value, { errorCorrectionLevel: "M" });
  const { size, data } = modules;

  let path = "";
  for (let y = 0; y < size; y++) {
    let run = 0;
    for (let x = 0; x <= size; x++) {
      if (x < size && data[y * size + x]) {
        run++;
      } else if (run > 0) {
        path += `M${x - run} ${y}h${run}v1h-${run}z`;
        run = 0;
      }
    }
  }

  return { size, path };
}
