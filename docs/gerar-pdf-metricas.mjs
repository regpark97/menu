// Gera docs/metricas-bupin.pdf — guia visual de métricas do Bupin.
// PDF desenhado à mão (PDF 1.4, Helvetica/WinAnsi), sem dependências externas.
import { writeFileSync, readFileSync } from "node:fs";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePng, resize, flattenOn } from "./png.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Paleta (marrom café / creme / caramelo) — rgb 0-255 ──────────────────────
const C = {
  ink: [43, 28, 18],
  coffee: [92, 58, 33],
  coffeeDark: [66, 40, 22],
  caramel: [200, 140, 70],
  cream: [247, 240, 230],
  cream2: [236, 223, 206],
  paper: [255, 253, 249],
  white: [255, 255, 255],
  muted: [122, 104, 88],
  green: [70, 130, 90],
  amber: [190, 130, 30],
  line: [214, 196, 176],
};

// ── Encoding WinAnsi ─────────────────────────────────────────────────────────
const MAP = {
  "–": 0x96, "—": 0x97, "÷": 0xf7, "×": 0xd7, "≥": 0xb3, "≤": 0xa3,
  "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "•": 0x95,
  "→": 0x3e, "✓": 0xfb, "✔": 0xfb, "▲": 0x1e, "●": 0x95,
};
function winAnsi(str) {
  const bytes = [];
  for (const ch of str) {
    if (MAP[ch] != null) bytes.push(MAP[ch] & 0xff);
    else {
      const code = ch.codePointAt(0);
      bytes.push(code <= 0xff ? code : 0x3f);
    }
  }
  return Buffer.from(bytes, "latin1");
}
function charW(ch, bold) {
  const wide = "mwMW@%".includes(ch) ? 840 : "iljI.,;:'!|t()[]r".includes(ch) ? 300 : 520;
  return (bold ? wide * 1.05 : wide) / 1000;
}
function textWidth(str, bold) {
  let w = 0;
  for (const ch of str) w += charW(ch, bold);
  return w;
}
function pdfStr(text) {
  const buf = winAnsi(text);
  let s = "(";
  for (const byte of buf) {
    if (byte === 0x28) s += "\\(";
    else if (byte === 0x29) s += "\\)";
    else if (byte === 0x5c) s += "\\\\";
    else if (byte >= 0x20 && byte <= 0x7e) s += String.fromCharCode(byte);
    else s += "\\" + byte.toString(8).padStart(3, "0");
  }
  return s + ")";
}
const num = (n) => Math.round(n * 100) / 100;
const rgb = (c) => `${num(c[0] / 255)} ${num(c[1] / 255)} ${num(c[2] / 255)}`;

// ── Modelo de "page": cada página é uma lista de ops de desenho ──────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;

function newOps() {
  return [];
}
function addText(ops, x, y, text, { size = 11, bold = false, color = C.ink } = {}) {
  ops.push(
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${num(x)} ${num(y)} Td ${pdfStr(text)} Tj ET`,
  );
}
function addRect(ops, x, y, w, h, color) {
  ops.push(`${rgb(color)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
}
function addRoundRect(ops, x, y, w, h, r, color) {
  const k = 0.5523 * r;
  ops.push(
    `${rgb(color)} rg ${num(x + r)} ${num(y)} m ` +
      `${num(x + w - r)} ${num(y)} l ` +
      `${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c ` +
      `${num(x + w)} ${num(y + h - r)} l ` +
      `${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c ` +
      `${num(x + r)} ${num(y + h)} l ` +
      `${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c ` +
      `${num(x)} ${num(y + r)} l ` +
      `${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c f`,
  );
}
function addLine(ops, x1, y1, x2, y2, color, w = 1) {
  ops.push(`${rgb(color)} RG ${num(w)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
}

export { winAnsi, textWidth, pdfStr, num, rgb, addText, addRect, addRoundRect, addLine, C };

// ── Tokeniza "**negrito**" em runs ───────────────────────────────────────────
function runs(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), b: false });
    out.push({ t: m[1], b: true });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: text.slice(last), b: false });
  return out;
}

// Desenha uma linha com runs misturando normal/bold, retornando x final.
function drawRuns(ops, x, y, parts, size, color) {
  let cx = x;
  for (const p of parts) {
    if (!p.t) continue;
    addText(ops, cx, y, p.t, { size, bold: p.b, color: p.b ? color.head : color.body });
    cx += textWidth(p.t, p.b) * size;
  }
  return cx;
}

// ── Estado de layout ─────────────────────────────────────────────────────────
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = PAGE_H - 96; // abaixo do cabeçalho
const BOTTOM = 64;

let pages = [];
let ops = newOps();
let y = TOP;
let pageStarted = false;

function header() {
  // faixa superior marrom + marca
  addRect(ops, 0, PAGE_H - 40, PAGE_W, 40, C.coffee);
  addText(ops, MARGIN, PAGE_H - 26, "BUPIN", { size: 12, bold: true, color: C.cream });
  addText(ops, PAGE_W - MARGIN - 150, PAGE_H - 26, "Guia de Métricas", {
    size: 11,
    color: C.cream,
  });
}
function footer(o, pageNo, total) {
  addLine(o, MARGIN, 46, PAGE_W - MARGIN, 46, C.line, 0.8);
  addText(o, MARGIN, 32, "Bupin — o cardápio que se assiste", { size: 8.5, color: C.muted });
  const label = `${pageNo} / ${total}`;
  addText(o, PAGE_W - MARGIN - textWidth(label, false) * 8.5, 32, label, {
    size: 8.5,
    color: C.muted,
  });
}

function startPage() {
  ops = newOps();
  header();
  y = TOP;
  pageStarted = true;
}
function finishPage() {
  if (pageStarted) pages.push(ops);
  pageStarted = false;
}
function needBlock(h) {
  if (y - h < BOTTOM) {
    finishPage();
    startPage();
  }
}

// Quebra texto (com runs) em linhas que caibam em maxW.
function wrapRuns(parts, size, maxW) {
  const words = [];
  for (const p of parts) {
    for (const w of p.t.split(/(\s+)/)) if (w) words.push({ t: w, b: p.b });
  }
  const lines = [];
  let line = [];
  let lineW = 0;
  for (const w of words) {
    const ww = textWidth(w.t, w.b) * size;
    if (lineW + ww > maxW && line.length && !/^\s+$/.test(w.t)) {
      lines.push(line);
      line = [];
      lineW = 0;
    }
    line.push(w);
    lineW += ww;
  }
  if (line.length) lines.push(line);
  return lines;
}

// Parágrafo de ordem corrente (corpo).
function para(text, { size = 10.5, color = { body: C.ink, head: C.coffeeDark }, x = MARGIN, maxW = CONTENT_W, lh = null } = {}) {
  const parts = runs(text);
  const lineH = lh ?? size * 1.5;
  const lines = wrapRuns(parts, size, maxW);
  for (const ln of lines) {
    needBlock(lineH);
    drawRuns(ops, x, y, ln, size, color);
    y -= lineH;
  }
}

export { runs, drawRuns, wrapRuns, para, needBlock, startPage, finishPage, MARGIN, CONTENT_W, TOP, BOTTOM, PAGE_W, PAGE_H };

// ── Componentes ──────────────────────────────────────────────────────────────
let sectionNo = 0;

function titleHeading(kicker, title) {
  sectionNo = 0;
  needBlock(90);
  addRect(ops, MARGIN, y - 4, 5, 40, C.caramel);
  addText(ops, MARGIN + 14, y - 6, kicker, { size: 9, bold: true, color: C.caramel });
  addText(ops, MARGIN + 14, y - 32, title, { size: 22, bold: true, color: C.coffee });
  y -= 58;
}

function sectionHeading(title) {
  sectionNo += 1;
  needBlock(46);
  y -= 8;
  // badge circular com número
  addRoundRect(ops, MARGIN, y - 20, 22, 22, 6, C.coffee);
  const n = String(sectionNo);
  addText(ops, MARGIN + 11 - textWidth(n, true) * 7.5, y - 14, n, {
    size: 13,
    bold: true,
    color: C.cream,
  });
  addText(ops, MARGIN + 34, y - 15, title, { size: 14.5, bold: true, color: C.coffeeDark });
  y -= 34;
}

// Bullet com marcador caramelo; aceita **negrito**.
function bullet(text) {
  const size = 10.5;
  const lh = size * 1.5;
  const indent = 16;
  const parts = runs(text);
  const lines = wrapRuns(parts, size, CONTENT_W - indent);
  lines.forEach((ln, i) => {
    needBlock(lh);
    if (i === 0) {
      addRect(ops, MARGIN + 2, y + 3, 5, 5, C.caramel);
    }
    drawRuns(ops, MARGIN + indent, y, ln, size, { body: C.ink, head: C.coffeeDark });
    y -= lh;
  });
}

// Card destacado (fundo creme, faixa lateral).
function card(text, accent = C.caramel) {
  const size = 10.5;
  const lh = size * 1.5;
  const pad = 14;
  const parts = runs(text);
  const lines = wrapRuns(parts, size, CONTENT_W - pad * 2 - 8);
  const h = lines.length * lh + pad * 1.4;
  needBlock(h + 10);
  addRoundRect(ops, MARGIN, y - h + 6, CONTENT_W, h, 10, C.cream);
  addRect(ops, MARGIN, y - h + 6 + 10, 4, h - 20, accent); // faixa lateral
  let ty = y - pad + 2;
  for (const ln of lines) {
    drawRuns(ops, MARGIN + pad + 6, ty, ln, size, { body: C.ink, head: C.coffeeDark });
    ty -= lh;
  }
  y -= h + 12;
}

// Duas colunas de "métrica": rótulo pequeno + valor grande.
function statGrid(items) {
  const gap = 12;
  const colW = (CONTENT_W - gap) / 2;
  const rowH = 62;
  for (let i = 0; i < items.length; i += 2) {
    needBlock(rowH + gap);
    for (let j = 0; j < 2 && i + j < items.length; j++) {
      const it = items[i + j];
      const x = MARGIN + j * (colW + gap);
      addRoundRect(ops, x, y - rowH, colW, rowH, 10, C.paper);
      addLine(ops, x, y - rowH + 1, x + colW, y - rowH + 1, C.line, 0.6);
      addText(ops, x + 12, y - 16, it.label, { size: 8.5, bold: true, color: C.muted });
      addText(ops, x + 12, y - 40, it.value, { size: 15, bold: true, color: it.color || C.coffee });
      if (it.note) addText(ops, x + 12, y - 54, it.note, { size: 7.5, color: C.muted });
    }
    y -= rowH + gap;
  }
}

// Tabela simples com cabeçalho marrom.
function table(headers, rows, widths) {
  const size = 9;
  const rowH = 22;
  const headH = 24;
  needBlock(headH + rowH * Math.min(rows.length, 4));
  const drawHead = () => {
    addRect(ops, MARGIN, y - headH, CONTENT_W, headH, C.coffee);
    let x = MARGIN;
    headers.forEach((h, i) => {
      addText(ops, x + 8, y - 16, h, { size: 9, bold: true, color: C.cream });
      x += widths[i];
    });
    y -= headH;
  };
  drawHead();
  rows.forEach((row, ri) => {
    if (y - rowH < BOTTOM) {
      finishPage();
      startPage();
      drawHead();
    }
    if (ri % 2 === 0) addRect(ops, MARGIN, y - rowH, CONTENT_W, rowH, C.cream);
    addLine(ops, MARGIN, y - rowH, MARGIN + CONTENT_W, y - rowH, C.line, 0.6);
    let x = MARGIN;
    row.forEach((cell, i) => {
      addText(ops, x + 8, y - 15, cell, { size, color: C.ink });
      x += widths[i];
    });
    y -= rowH;
  });
  y -= 12;
}

function spacer(h = 10) {
  y -= h;
}

// ── Capa ─────────────────────────────────────────────────────────────────────
function cover() {
  ops = newOps();
  addRect(ops, 0, 0, PAGE_W, PAGE_H, C.paper);
  addRect(ops, 0, PAGE_H * 0.42, PAGE_W, PAGE_H * 0.58, C.coffee);
  addRect(ops, 0, PAGE_H * 0.42, PAGE_W, 6, C.caramel);
  // Selo creme com a logo no canto superior direito
  const badgeW = 96;
  const badgeH = 96;
  const bx = MARGIN + CONTENT_W - badgeW;
  const by = PAGE_H - 132;
  addRoundRect(ops, bx, by, badgeW, badgeH, 18, C.cream);
  const logoW = 58;
  const logoH = 72; // proporção 4:5
  const lx = bx + (badgeW - logoW) / 2;
  const ly = by + (badgeH - logoH) / 2;
  ops.push(`%LOGO ${num(lx)} ${num(ly)} ${num(logoW)} ${num(logoH)}`);
  addText(ops, MARGIN, PAGE_H - 90, "BUPIN", { size: 16, bold: true, color: C.cream });
  addText(ops, MARGIN, PAGE_H - 210, "Guia de", { size: 40, bold: true, color: C.white });
  addText(ops, MARGIN, PAGE_H - 258, "Métricas", { size: 40, bold: true, color: C.white });
  addText(ops, MARGIN, PAGE_H - 300, "Do número à decisão — leia seus dados", {
    size: 13,
    color: C.cream,
  });
  const py = 118;
  addRoundRect(ops, MARGIN, py, CONTENT_W, 156, 14, C.white);
  addLine(ops, MARGIN + 14, py + 1, MARGIN + CONTENT_W - 14, py + 1, C.line, 0.8);
  addRect(ops, MARGIN, py + 156 - 8, CONTENT_W, 8, C.caramel);
  addText(ops, MARGIN + 22, py + 100, "O que você vai encontrar", {
    size: 10,
    bold: true,
    color: C.caramel,
  });
  addText(ops, MARGIN + 22, py + 74, "Volume e alcance, conversão e", {
    size: 13,
    bold: true,
    color: C.coffeeDark,
  });
  addText(ops, MARGIN + 22, py + 54, "interesse por prato, painel por mesa", {
    size: 13,
    bold: true,
    color: C.coffeeDark,
  });
  addText(ops, MARGIN + 22, py + 30, "e um roteiro prático de 5 minutos por semana.", {
    size: 11,
    color: C.muted,
  });
  pages.push(ops);
}

// ── Conteúdo ─────────────────────────────────────────────────────────────────
function buildContent() {
  startPage();

  titleHeading("GUIA PRÁTICO", "Análise de Métricas");
  para(
    "A aba **Análise > Métricas** responde à pergunta central: os clientes olham o quê, e o que os faz agir? Este guia explica cada número e como transformá-lo em decisão.",
  );
  spacer(6);

  sectionHeading("Cards do topo — volume e alcance");
  statGrid([
    { label: "SESSÕES ABERTAS", value: "≈ visitas", note: "sua audiência", color: C.coffee },
    { label: "VIEWS ÷ SESSÕES", value: "engajamento", note: "pratos por visita", color: C.coffee },
    { label: "GOOGLE REVIEW", value: "prova social", note: "quem avaliou", color: C.coffee },
    { label: "WI-FI", value: "conforto", note: "fica mais tempo", color: C.coffee },
  ]);
  spacer(2);
  bullet("**Sessões abertas:** quantas vezes alguém abriu o cardápio. Se cair, verifique os cartões NFC/QR das mesas.");
  bullet("**Visualizações de pratos:** views ÷ sessões mostra quantos pratos cada pessoa vê. Quanto maior, mais engajado.");
  bullet("**Cliques no Google Review:** é a prova social que você quer no Google Maps.");
  bullet("**Aberturas de Wi-Fi:** indicam cliente confortável, que fica mais tempo e consome mais.");
  spacer(6);

  sectionHeading("Qualidade e conversão — os mais estratégicos");
  statGrid([
    { label: "ATENÇÃO MÉDIA", value: "5–10s", note: "interesse real", color: C.green },
    { label: "CONVERSÃO GOOGLE", value: "20%+", note: "excelente", color: C.green },
    { label: "USO DO WI-FI", value: "30%+", note: "atrativo forte", color: C.green },
    { label: "ABAIXO DE 5%", value: "alerta", note: "ninguém agindo", color: C.amber },
  ]);
  card(
    "**Regra de ouro:** volume (topo) mostra alcance; conversão (base) mostra experiência. 1000 sessões com 2% de Google valem menos que 200 sessões com 25%.",
  );

  sectionHeading("Tabela por prato — o coração da análise");
  para("Cada linha é um prato, ordenado por atenção média (o que chama mais olhar fica no topo).");
  spacer(4);
  table(
    ["Coluna", "O que mede", "Use para..."],
    [
      ["Atenção média", "tempo olhando o prato", "medir intenção"],
      ["Interesse", "(fav+personaliz.) ÷ views", "achar quem converte"],
      ["Views", "quantas vezes apareceu", "medir alcance"],
      ["Sessões*", "sessões distintas que viram", "ler o funil"],
      ["Swipes*", "exposição até o prato", "alcance real"],
      ["Favoritos", "corações marcados", "achar queridinhos"],
      ["Personalizações", "abriram adicionais", "intenção de pedir"],
    ],
    [150, 205, 182],
  );
  para("* Colunas da Fase 2 (requerem a migration 0005 no banco).", {
    size: 8.5,
    color: { body: C.muted, head: C.muted },
  });

  sectionHeading("Como cruzar as colunas");
  bullet("**Atenção alta + Interesse alto:** prato campeão. Destaque na abertura, melhore fotos, teste preço/margem.");
  bullet("**Atenção alta + Interesse baixo:** curiosidade sem ação. Reveja descrição/preço — talvez pareça caro.");
  bullet("**Atenção baixa + Views altas:** passou batido. Foto/vídeo fraco ou posição ruim — regrave ou reordene.");
  bullet("**Interesse baixo (<5%) com muitas views:** prato frio. Re-posicione ou foque margem em outro.");
  bullet("**Muitas personalizações:** garanta adicionais completos e com preço — é receita fácil.");
  card(
    "Onde estão os olhos, está o dinheiro. **Interesse acima de 15%** (verde) é forte candidato a prato-vitrine da casa.",
    C.green,
  );

  sectionHeading("Painel por mesa (Fase 2)");
  bullet("**Sessões por mesa:** quantas visitas aquela mesa abriu.");
  bullet("**Chamadas por mesa:** pedidos de garçom/conta/gerente. Muitas chamadas indicam fila de atendimento ou mesa que precisa de atenção.");

  sectionHeading("O filtro de período (7 / 15 / 30 dias)");
  bullet("**7 dias:** reação a um evento recente (mudou uma foto, fim de semana, prato novo).");
  bullet("**30 dias:** tendência real e estável — use para decisões de cardápio e preço.");
  bullet("Compare o mesmo período entre si; se trocou uma foto, o antes/depois no 7 dias mostra o efeito.");

  sectionHeading("Roteiro rápido — 5 minutos por semana");
  bullet("**1.** As sessões subiram ou caíram? (alcance físico/QR)");
  bullet("**2.** Conversão p/ Google acima de 15%? Se não, ajuste o convite na tela inicial.");
  bullet("**3.** Qual prato tem os 3 melhores (atenção, interesse, personalizações)? Promova-o.");
  bullet("**4.** Ache o prato com mais views e menos interesse: troque a foto ou tire da frente.");
  bullet("**5.** Pratos com muitas personalizações: confira se os adicionais estão completos.");

  sectionHeading("Observações importantes");
  card(
    "Os números só ficam significativos com **tráfego real** (clientes usando o NFC/QR). Em ambiente de teste pode haver pouco ou nenhum dado. Cada métrica é cumulativa do período selecionado.",
    C.amber,
  );

  spacer(10);
  needBlock(56);
  addRoundRect(ops, MARGIN, y - 46, CONTENT_W, 46, 10, C.coffee);
  addText(ops, MARGIN + 16, y - 20, "Bupin — o cardápio que se assiste.", {
    size: 11,
    bold: true,
    color: C.cream,
  });
  addText(ops, MARGIN + 16, y - 36, "Guia de Métricas · versão 1.1", {
    size: 8.5,
    color: C.cream2,
  });
  y -= 52;

  finishPage();
}

// ── Imagem da logo (para a capa) ─────────────────────────────────────────────
function loadLogoImage() {
  const png = decodePng(readFileSync(join(__dirname, "..", "public", "logo.png")));
  // Reamostra para largura ~360px e compõe sobre creme (opaco) => RGB.
  const small = resize(png.data, png.w, png.h, 360);
  const rgb = flattenOn(small.data, small.w, small.h, C.cream);
  const comp = zlib.deflateSync(Buffer.from(rgb), { level: 9 });
  return { w: small.w, h: small.h, comp };
}

// ── Serialização ─────────────────────────────────────────────────────────────
function assemble() {
  const objects = [];
  const addObj = (body) => {
    objects.push(body);
    return objects.length;
  };
  const F1 = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const F2 = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  // Objeto de imagem (XObject) — stream binário, montado separadamente.
  const logo = loadLogoImage();
  const logoObjNum = objects.length + 1;
  const logoDict =
    `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.comp.length} >>`;
  // guarda como buffer especial { binary: true }
  objects.push({ binary: true, head: logoDict, stream: logo.comp });

  let next = objects.length + 1;
  const contentNums = [];
  const pageNums = [];
  for (let i = 0; i < pages.length; i++) {
    contentNums.push(next++);
    pageNums.push(next++);
  }
  const pagesNum = next++;
  const catalogNum = next++;

  const total = pages.length;
  for (let i = 0; i < pages.length; i++) {
    footer(pages[i], i + 1, total);
    // Substitui marcadores %LOGO x y w h por comando de desenho da imagem.
    const ops2 = pages[i].map((line) => {
      const m = line.match(/^%LOGO ([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+)/);
      if (m) {
        const [, x, y2, w, h] = m;
        return `q ${w} 0 0 ${h} ${x} ${y2} cm /Im0 Do Q`;
      }
      return line;
    });
    const stream = ops2.join("\n");
    objects[contentNums[i] - 1] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }

  const kids = pageNums.map((n) => `${n} 0 R`).join(" ");
  for (let i = 0; i < pages.length; i++) {
    const xobj = i === 0 ? ` /XObject << /Im0 ${logoObjNum} 0 R >>` : "";
    objects[pageNums[i] - 1] =
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${F1} 0 R /F2 ${F2} 0 R >>${xobj} >> ` +
      `/Contents ${contentNums[i]} 0 R >>`;
  }
  objects[pagesNum - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[catalogNum - 1] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`;

  let pdf = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1");
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = pdf.length;
    const o = objects[i];
    if (o && o.binary) {
      pdf = Buffer.concat([
        pdf,
        Buffer.from(`${i + 1} 0 obj\n${o.head}\nstream\n`, "latin1"),
        o.stream,
        Buffer.from("\nendstream\nendobj\n", "latin1"),
      ]);
    } else {
      pdf = Buffer.concat([pdf, Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1")]);
    }
  }
  const xrefStart = pdf.length;
  const n = objects.length + 1;
  let tail = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 0; i < objects.length; i++) {
    tail += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  tail += `trailer\n<< /Size ${n} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.concat([pdf, Buffer.from(tail, "latin1")]);
}

// ── Build ────────────────────────────────────────────────────────────────────
cover();
buildContent();
const out = join(__dirname, "metricas-bupin.pdf");
writeFileSync(out, assemble());
console.log("PDF gerado:", out, `(${pages.length} páginas)`);




