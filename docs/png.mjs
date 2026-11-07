// Utilitários PNG sem dependências (decode/encode RGBA 8-bit), usando zlib nativo.
import zlib from "node:zlib";

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c;
}

/** Decodifica PNG 8-bit (gray/rgb/palette/gray+alpha/rgba) para RGBA. */
export function decodePng(buf) {
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
  if (interlace) throw new Error("PNG interlaced não suportado");
  if (bitDepth !== 8) throw new Error("PNG bitDepth != 8 não suportado: " + bitDepth);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error("colorType não suportado: " + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const px = Buffer.alloc(w * h * bpp);
  let p = 0;
  for (let yy = 0; yy < h; yy++) {
    const filter = raw[p++];
    const rs = yy * stride;
    for (let i = 0; i < stride; i++) {
      const rv = raw[p++];
      const a = i >= bpp ? px[rs + i - bpp] : 0;
      const b = yy > 0 ? px[rs - stride + i] : 0;
      const c = i >= bpp && yy > 0 ? px[rs - stride + i - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = rv; break;
        case 1: val = rv + a; break;
        case 2: val = rv + b; break;
        case 3: val = rv + ((a + b) >> 1); break;
        case 4: val = rv + paeth(a, b, c); break;
        default: throw new Error("filtro PNG inválido: " + filter);
      }
      px[rs + i] = val & 0xff;
    }
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (colorType === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; al = px[i * 4 + 3]; }
    else if (colorType === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (colorType === 0) { r = g = b = px[i]; }
    else if (colorType === 4) { r = g = b = px[i * 2]; al = px[i * 2 + 1]; }
    else { const idx = px[i]; r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2]; if (trns && idx < trns.length) al = trns[idx]; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = al;
  }
  return { w, h, data: rgba };
}

/** Codifica RGBA em PNG (filtro 0). */
export function encodePng(rgba, w, h) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = rgba[y * stride + x];
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", comp), chunk("IEND", Buffer.alloc(0))]);
}

/** Compõe RGBA sobre um fundo opaco (r,g,b) e devolve RGB opaco reamostrado. */
export function flattenOn(rgba, w, h, bg) {
  const rgb = new Uint8ClampedArray(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    rgb[i * 3] = rgba[i * 4] * a + bg[0] * (1 - a);
    rgb[i * 3 + 1] = rgba[i * 4 + 1] * a + bg[1] * (1 - a);
    rgb[i * 3 + 2] = rgba[i * 4 + 2] * a + bg[2] * (1 - a);
  }
  return rgb;
}

/** Reamostra RGBA para largura alvo (nearest), mantendo proporção. */
export function resize(rgba, w, h, targetW) {
  const scale = targetW / w;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor(x / scale));
      const sy = Math.min(h - 1, Math.floor(y / scale));
      const si = (sy * w + sx) * 4;
      const di = (y * nw + x) * 4;
      out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
    }
  }
  return { data: out, w: nw, h: nh };
}
