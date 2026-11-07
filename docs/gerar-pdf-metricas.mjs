// Gera docs/metricas-bupin.pdf — tutorial de análise de métricas do Bupin.
// PDF montado à mão (PDF 1.4, fonte Helvetica/WinAnsi), sem dependências externas.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Codificação WinAnsi: mapeia acentos do texto para Latin-1 (WinAnsi coincide em grande
//    parte para o português). Caracteres fora do Latin-1 viram "?".
function winAnsi(str) {
  const map = {
    "–": 0x96, // en dash
    "—": 0x97, // em dash
    "÷": 0xf7, // division
    "×": 0xd7, // multiply
    "≥": 0xb3, // (aprox) — WinAnsi não tem ≥, usa aproximado
    "≤": 0xa3,
    "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92,
    "•": 0x95,
    "→": 0x3e, // seta vira ">"
    "⭐": 0x2a, // asterisco
    "🔎": 0x3f, "💡": 0x3f, "⚠️": 0x3f, "🔜": 0x3f,
  };
  const bytes = [];
  for (const ch of str) {
    if (map[ch] != null) {
      bytes.push(map[ch] & 0xff);
    } else {
      const code = ch.codePointAt(0);
      if (code <= 0xff) bytes.push(code);
      else bytes.push(0x3f); // "?"
    }
  }
  return Buffer.from(bytes, "latin1");
}

function parseRuns(text) {
  // Divide o texto em "runs" (trecho, negrito) interpretando **negrito**.
  const runs = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index), b: false });
    runs.push({ t: m[1], b: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ t: text.slice(last), b: false });
  return runs;
}

// Largura aproximada por caractere para Helvetica (bold um pouco maior). Apenas
// para estimar quebras de linha — não precisa ser meticulosa.
function charW(ch, bold) {
  const wide = "mwMW@".includes(ch) ? 820 : "iljI.,;:'!|t()[]".includes(ch) ? 300 : 520;
  return (bold ? wide * 1.03 : wide) / 1000;
}
function textWidth(str, bold) {
  let w = 0;
  for (const ch of str) w += charW(ch, bold);
  return w;
}

export { winAnsi, parseRuns, textWidth };

// ── Conteúdo do tutorial (markdown simplificado) ───────────────────────────────
const CONTENT = `
# Guia de Análise de Métricas — Bupin
## Como ler os números do seu painel e transformar dados em decisões

A aba **Análise > Métricas** responde à pergunta central: os clientes olham o quê, e o que os faz agir? Este guia explica cada número e como usá-lo no dia a dia do restaurante.

## 1. Cards do topo (volume e alcance)
- **Sessões abertas:** quantas vezes alguém abriu o cardápio (uma visita). É a sua audiência. Se cair, verifique os cartões NFC/QR das mesas.
- **Visualizações de pratos:** quantos pratos foram vistos no feed. Views ÷ Sessões = quantos pratos cada pessoa vê em média. Quanto maior, mais engajado.
- **Cliques no Google Review:** quantos tocaram em "Avaliar no Google". É a prova social, o que você quer no Google Maps.
- **Aberturas de Wi-Fi:** quantos abriram a senha do Wi-Fi. Indica cliente confortável, que fica mais tempo e consome mais.

## 2. Cards de qualidade e conversão (os mais estratégicos)
- **Atenção média:** tempo médio em cada prato. 2-5s = passou rápido; 5-10s = interesse real; mais de 15s = forte intenção de compra.
- **Conversão p/ Google:** cliques no Google ÷ sessões. 20% é excelente; abaixo de 5%, ninguém está avaliando — reforce o convite na tela inicial.
- **Uso do Wi-Fi:** aberturas de Wi-Fi ÷ sessões. Acima de 30%, o Wi-Fi é um atrativo forte. Muito baixo pode indicar rede difícil ou senha errada.

**Regra de ouro:** volume (topo) mostra alcance; conversão (base) mostra experiência. 1000 sessões com 2% de Google valem menos que 200 sessões com 25%.

## 3. Tabela por prato (o coração da análise)
Cada linha é um prato, ordenado por atenção média (o que chama mais olhar fica no topo).

- **Atenção média:** tempo médio olhando o prato.
- **Interesse:** (favoritos + personalizações) ÷ views. Mede quantos que viram o prato realmente agiram.
- **Views:** quantas vezes o prato apareceu.
- **Sessões (fase 2):** sessões distintas que viram o prato (funil).
- **Swipes (fase 2):** eventos de swipe até o prato (alcance/exposição).
- **Favoritos:** quantos marcaram com o coração.
- **Personalizações:** quantos abriram os adicionais (sinal forte de intenção de pedir).

## 4. Como cruzar as colunas
- **Atenção alta + Interesse alto:** prato campeão. Destaque na abertura, melhores fotos, teste preço/margem.
- **Atenção alta + Interesse baixo:** curiosidade sem ação. Reveja descrição/preço; talvez pareça caro ou confuso.
- **Atenção baixa + Views altas:** passou batido. Foto/vídeo fraco ou posição ruim — regrave ou reordene.
- **Interesse baixo (menos de 5%) com muitas views:** prato "frio". Re-posicione ou foque margem em outro.
- **Muitas Personalizações:** o cliente quer customizar. Garanta adicionais completos e com preço — é receita fácil.
- **Muitos Favoritos:** prato queridinho da casa. Use na comunicação.

Onde estão os olhos, está o dinheiro. Interesse acima de 15% (verde) é forte candidato a prato-vitrine.

## 5. Painel "Por mesa" (fase 2)
- **Sessões por mesa:** quantas visitas aquela mesa abriu.
- **Chamadas por mesa:** pedidos de garçom/conta/gerente. Muitas chamadas podem indicar fila de atendimento ou mesa que precisa de atenção.

## 6. O filtro de período (7 / 15 / 30 dias)
- **7 dias:** reação a um evento recente (mudou uma foto, fim de semana, novo prato).
- **30 dias:** tendência real e estável. Use para decisões de cardápio e preço.
- Compare o mesmo período entre si; se trocou uma foto, o antes/depois no 7 dias mostra o efeito.

## 7. Roteiro rápido (5 minutos por semana)
1. As sessões subiram ou caíram? (alcance físico/QR)
2. Conversão p/ Google está acima de 15%? Se não, ajuste o convite.
3. Qual prato tem os 3 melhores (atenção, interesse, personalizações)? Promova-o.
4. Ache o prato com mais views e menos interesse: troque a foto ou tire da frente.
5. Pratos com muitas personalizações: confira se os adicionais estão completos = dinheiro na mesa.

## 8. Observações importantes
- Os números só ficam significativos com tráfego real (clientes usando o NFC/QR). Em ambiente de teste pode haver pouco ou nenhum dado.
- Cada métrica é cumulativa do período selecionado; não some dias manualmente, o filtro já faz isso.
- As colunas Sessões, Swipes e o painel Por mesa dependem da atualização do banco (migration 0005). Enquanto ela não for aplicada, o painel mostra apenas as colunas clássicas.

Bupin — o cardápio que se assiste. Guia de métricas, versão 1.0.
`;

// ── Layout / geração das páginas ──────────────────────────────────────────────
const PAGE_W = 595.28; // A4 (pt)
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = PAGE_H - MARGIN;

let pages = [];
let cur = [];
let y = TOP;

function newPage() {
  if (cur.length) pages.push(cur);
  cur = [];
  y = TOP;
}

function ensure(space) {
  if (y - space < MARGIN) newPage();
}

// Quebra o texto em linhas que cabem em CONTENT_W.
function wrap(text, size, bold, indent) {
  const maxW = CONTENT_W - indent;
  const scale = size / 12;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? line + " " + w : w;
    if (textWidth(tryLine, bold) * scale > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function pushLine(text, opts = {}) {
  const { size = 11, bold = false, color = [40, 32, 24], lh = null, indent = 0 } = opts;
  const lineHeight = lh ?? size * 1.45;
  const lines = wrap(text, size, bold, indent);
  for (const ln of lines) {
    ensure(lineHeight);
    // Guarda a coordenada Y real da baseline desta linha (medida da página).
    const baselineY = y - lineHeight + (lineHeight - size) * 0.25;
    cur.push({ text: ln, size, bold, color, indent, y: baselineY });
    y -= lineHeight;
  }
}

function renderMarkdown(md) {
  const blocks = md.split("\n");
  for (const raw of blocks) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      y -= 6;
      continue;
    }
    if (line.startsWith("# ")) {
      pushLine(line.slice(2), { size: 22, bold: true, color: [74, 44, 20], lh: 30 });
      ensure(10);
      cur.push({ rule: true, y: y - 2 });
      y -= 10;
    } else if (line.startsWith("## ")) {
      ensure(30);
      y -= 6;
      pushLine(line.slice(3), { size: 14, bold: true, color: [120, 68, 30], lh: 20 });
    } else if (/^- /.test(line)) {
      pushLine("• " + line.slice(2), { size: 11, indent: 12, lh: 16 });
    } else {
      pushLine(line, { size: 11, lh: 16 });
    }
  }
  if (cur.length) pages.push(cur);
}

// ── Serialização do PDF ───────────────────────────────────────────────────────
function num(n) {
  return Math.round(n * 100) / 100;
}

// String literal PDF com bytes WinAnsi escapados em octal.
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

function buildContentStream(lines) {
  const parts = [];
  for (const ln of lines) {
    if (ln.rule) {
      parts.push(
        `0.42 0.26 0.14 RG 1 w ${num(MARGIN)} ${num(ln.y)} m ${num(MARGIN + CONTENT_W)} ${num(ln.y)} l S`,
      );
      continue;
    }
    const font = ln.bold ? "/F2" : "/F1";
    const [r, g, b] = ln.color;
    parts.push(
      `BT ${font} ${ln.size} Tf ${num(r / 255)} ${num(g / 255)} ${num(b / 255)} rg ` +
        `${num(MARGIN + (ln.indent || 0))} ${num(ln.y)} Td ${pdfStr(ln.text)} Tj ET`,
    );
  }
  return parts.join("\n");
}

function assemble() {
  const objects = [];
  const addObj = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontF1 = addObj(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const fontF2 = addObj(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  let next = objects.length + 1;
  const contentNums = [];
  const pageNums = [];
  for (let i = 0; i < pages.length; i++) {
    contentNums.push(next++);
    pageNums.push(next++);
  }
  const pagesNum = next++;
  const catalogNum = next++;

  for (let i = 0; i < pages.length; i++) {
    const stream = buildContentStream(pages[i]);
    objects[contentNums[i] - 1] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }

  const kids = pageNums.map((n) => `${n} 0 R`).join(" ");
  for (let i = 0; i < pages.length; i++) {
    objects[pageNums[i] - 1] =
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R >> >> ` +
      `/Contents ${contentNums[i]} 0 R >>`;
  }

  objects[pagesNum - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[catalogNum - 1] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`;

  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  const total = objects.length + 1;
  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 0; i < objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${total} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

renderMarkdown(CONTENT);
const out = join(__dirname, "metricas-bupin.pdf");
writeFileSync(out, assemble());
console.log("PDF gerado:", out, `(${pages.length} páginas)`);



