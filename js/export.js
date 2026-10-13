// PNG-export voor de Tesla-app: 1024 × 1024 px, zwarte achtergrond, maximaal 1 MB.

export const MAX_BYTES = 1_000_000;
const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

// Maakt de PNG en controleert de eisen. Geeft { blob, width, height, mode, checks }.
export async function exportWrap(canvas, tpl) {
  const S = canvas.width;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, S, S).data;
  const black = (i) => (px[i * 4] | px[i * 4 + 1] | px[i * 4 + 2]) === 0;

  let outsideBlack = true;
  for (let i = 0; i < S * S && outsideBlack; i++) {
    if (!tpl.ids[i] && !black(i)) outsideBlack = false;
  }

  let borderBlack = true;
  for (let i = 0; i < S && borderBlack; i++) {
    borderBlack = black(i) && black((S - 1) * S + i) && black(i * S) && black(i * S + S - 1);
  }

  const { blob, mode } = await encodeWrap(canvas, px);
  const checks = [
    { ok: canvas.width === 1024 && canvas.height === 1024, label: `Formaat ${S} × ${S} px` },
    { ok: outsideBlack, label: 'Zwart tussen en rond de panelen' },
    { ok: borderBlack, label: 'Geen witte rand (de rand van het canvas is zwart)' },
    { ok: blob.size <= MAX_BYTES, label: `Bestandsgrootte ${(blob.size / 1024).toFixed(0)} KB (max. 1 MB)` },
  ];
  return { blob, width: S, height: S, mode, checks };
}

// Eerst met volledige kleuren. Komt dat boven 1 MB uit, dan een palet-PNG met minder kleuren.
async function encodeWrap(canvas, px) {
  const S = canvas.width;
  let blob = await canvasToBlob(canvas);
  let mode = 'volledige kleuren (RGBA)';
  for (const colors of [256, 128, 64]) {
    if (blob.size <= MAX_BYTES) break;
    const { indices, palette } = quantize(px, colors);
    const bytes = await encodeIndexedPng(S, S, indices, palette);
    blob = new Blob([bytes], { type: 'image/png' });
    mode = `${palette.length / 3} kleuren (palet-PNG)`;
  }
  return { blob, mode };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG maken mislukt'))), 'image/png');
  });
}

// Median-cut palet op een 5-bits histogram. Index 0 is altijd zwart, zodat de achtergrond exact zwart blijft.
function quantize(px, colors) {
  const count = px.length / 4;
  const BINS = 32768;
  const cnt = new Uint32Array(BINS);
  const sr = new Uint32Array(BINS);
  const sg = new Uint32Array(BINS);
  const sb = new Uint32Array(BINS);
  for (let j = 0; j < count; j++) {
    const r = px[j * 4];
    const g = px[j * 4 + 1];
    const b = px[j * 4 + 2];
    if (!(r | g | b)) continue;
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    cnt[k]++;
    sr[k] += r;
    sg[k] += g;
    sb[k] += b;
  }

  const keys = [];
  for (let k = 0; k < BINS; k++) if (cnt[k]) keys.push(k);
  const comp = (k, ch) => (ch === 0 ? k >> 10 : ch === 1 ? (k >> 5) & 31 : k & 31);

  let boxes = keys.length ? [keys] : [];
  while (boxes.length < colors - 1) {
    let pick = -1;
    let best = 0;
    let axis = 0;
    boxes.forEach((box, bi) => {
      if (box.length < 2) return;
      let total = 0;
      const lo = [31, 31, 31];
      const hi = [0, 0, 0];
      for (const k of box) {
        total += cnt[k];
        for (let ch = 0; ch < 3; ch++) {
          const v = comp(k, ch);
          if (v < lo[ch]) lo[ch] = v;
          if (v > hi[ch]) hi[ch] = v;
        }
      }
      const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      const range = Math.max(...ranges);
      if (range * total > best) {
        best = range * total;
        pick = bi;
        axis = ranges.indexOf(range);
      }
    });
    if (pick < 0) break;

    const box = boxes[pick];
    const shift = axis === 0 ? 10 : axis === 1 ? 5 : 0;
    box.sort((a, b) => ((a >> shift) & 31) - ((b >> shift) & 31));
    let total = 0;
    for (const k of box) total += cnt[k];
    let acc = 0;
    let cut = box.length >> 1;
    for (let j = 0; j < box.length; j++) {
      acc += cnt[box[j]];
      if (acc * 2 >= total) {
        cut = Math.min(Math.max(j + 1, 1), box.length - 1);
        break;
      }
    }
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }

  const entries = [0, 0, 0];
  for (const box of boxes) {
    let n = 0;
    let R = 0;
    let G = 0;
    let B = 0;
    for (const k of box) {
      n += cnt[k];
      R += sr[k];
      G += sg[k];
      B += sb[k];
    }
    entries.push(Math.round(R / n), Math.round(G / n), Math.round(B / n));
  }
  const palette = Uint8Array.from(entries);
  const np = palette.length / 3;

  // Dichtstbijzijnde palet-kleur per bin. Niet-zwarte pixels blijven zo niet-zwart.
  const lut = new Uint8Array(BINS);
  for (const k of keys) {
    const r = sr[k] / cnt[k];
    const g = sg[k] / cnt[k];
    const b = sb[k] / cnt[k];
    let bi = 1;
    let bd = Infinity;
    for (let p = 1; p < np; p++) {
      const dr = r - palette[p * 3];
      const dg = g - palette[p * 3 + 1];
      const db = b - palette[p * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) {
        bd = d;
        bi = p;
      }
    }
    lut[k] = bi;
  }

  const indices = new Uint8Array(count);
  for (let j = 0; j < count; j++) {
    const r = px[j * 4];
    const g = px[j * 4 + 1];
    const b = px[j * 4 + 2];
    if (!(r | g | b)) continue;
    indices[j] = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
  }
  return { indices, palette };
}

async function encodeIndexedPng(w, h, indices, palette) {
  const stride = w + 1;
  const raw = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    raw[row] = 2; // filter 'Up': egale vlakken worden nullen, dat comprimeert goed
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      raw[row + 1 + x] = indices[i] - (y ? indices[i - w] : 0);
    }
  }
  const header = new Uint8Array(13);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  header[8] = 8; // bitdiepte
  header[9] = 3; // kleurtype: palet
  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('PLTE', palette),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type, data) {
  const out = new Uint8Array(data.length + 12);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
