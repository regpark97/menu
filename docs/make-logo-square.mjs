// Gera public/logo-square.png (512x512) a partir de public/logo.png,
// com a logo inteira centralizada (contain) sobre fundo transparente.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePng, encodePng } from "./png.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const img = decodePng(readFileSync(join(__dirname, "..", "public", "logo.png")));
const SIZE = 512;
const pad = Math.round(SIZE * 0.06);
const avail = SIZE - pad * 2;
const scale = Math.min(avail / img.w, avail / img.h);
const dw = Math.round(img.w * scale);
const dh = Math.round(img.h * scale);
const ox = Math.round((SIZE - dw) / 2);
const oy = Math.round((SIZE - dh) / 2);

const out = new Uint8ClampedArray(SIZE * SIZE * 4); // transparente
for (let y = 0; y < dh; y++) {
  for (let x = 0; x < dw; x++) {
    const sx = Math.min(img.w - 1, Math.floor(x / scale));
    const sy = Math.min(img.h - 1, Math.floor(y / scale));
    const si = (sy * img.w + sx) * 4;
    const di = ((oy + y) * SIZE + (ox + x)) * 4;
    out[di] = img.data[si];
    out[di + 1] = img.data[si + 1];
    out[di + 2] = img.data[si + 2];
    out[di + 3] = img.data[si + 3];
  }
}
writeFileSync(join(__dirname, "..", "public", "logo-square.png"), encodePng(out, SIZE, SIZE));
console.log(`logo-square.png gerada: ${SIZE}x${SIZE} (logo ${dw}x${dh})`);
