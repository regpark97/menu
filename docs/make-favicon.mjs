// Gera public/favicon.png (quadrado) a partir de public/logo.png, sem libs.
// Decodifica o PNG (RGBA/rgb/palette/gray via zlib), reamostra para um quadrado
// com a logo inteira centralizada, e recodifica como PNG RGBA.
import { readFileSync, writeFileSync } from "node:fs";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "public", "logo.png");
const OUT = join(__dirname, "..", "public", "favicon.png");
const SIZE = 256; // favicon 256x256

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Extrai e decodifica o PNG em {w,h,x,y, width, height, data:Uint8ClampedArray RGBA}
function decodePng(buf) {
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let palette = null;
  let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (interlace) throw new Error("Interlaced PNG não suportado");
  if (bitDepth !== 8) throw new Error("Só bitDepth 8 é suportado: " + bitDepth);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error("colorType não suportado: " + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const pixels = Buffer.alloc(w * h * bpp);
  let p = 0;
  for (let yy = 0; yy < h; yy++) {
    const filter = raw[p++];
    const rowStart = yy * stride;
    for (let i = 0; i < stride; i++) {
      const rawByte = raw[p++];
      const a = i >= bpp ? pixels[rowStart + i - bpp] : 0;
      const b = yy > 0 ? pixels[rowStart - stride + i] : 0;
      const c = i >= bpp && yy > 0 ? pixels[rowStart - stride + i - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = rawByte; break;
        case 1: val = rawByte + a; break;
        case 2: val = rawByte + b; break;
        case 3: val = rawByte + ((a + b) >> 1); break;
        case 4: val = rawByte + paeth(a, b, c); break;
        default: throw new Error("filtro inválido " + filter);
      }
      pixels[rowStart + i] = val & 0xff;
    }
  }
  // Converte para RGBA
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (colorType === 6) { r = pixels[i * 4]; g = pixels[i * 4 + 1]; b = pixels[i * 4 + 2]; al = pixels[i * 4 + 3]; }
    else if (colorType === 2) { r = pixels[i * 3]; g = pixels[i * 3 + 1]; b = pixels[i * 3 + 2]; }
    else if (colorType === 0) { r = g = b = pixels[i]; }
    else if (colorType === 4) { r = g = b = pixels[i * 2]; al = pixels[i * 2 + 1]; }
    else if (colorType === 3) {
      const idx = pixels[i];
      r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
      if (trns && idx < trns.length) al = trns[idx];
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = al;
  }
  return { w, h, data: rgba };
}

function encodePng(rgba, w, h) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filtro 0
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = rgba[y * stride + x];
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", comp), chunk("IEND", Buffer.alloc(0))]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c;
}

const img = decodePng(readFileSync(SRC));
// Escala "contain": cabe toda a logo no quadrado, centralizada, com leve respiro.
const pad = Math.round(SIZE * 0.06);
const avail = SIZE - pad * 2;
const scale = Math.min(avail / img.w, avail / img.h);
const dw = Math.round(img.w * scale);
const dh = Math.round(img.h * scale);
const ox = Math.round((SIZE - dw) / 2);
const oy = Math.round((SIZE - dh) / 2);

const out = new Uint8ClampedArray(SIZE * SIZE * 4); // fundo transparente
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
writeFileSync(OUT, encodePng(out, SIZE, SIZE));
console.log(`favicon gerado: ${OUT} (${SIZE}x${SIZE}, logo ${dw}x${dh})`);
