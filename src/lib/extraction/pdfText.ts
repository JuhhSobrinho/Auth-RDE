// Reconstrução de texto/linhas de um PDF via pdfjs-dist, com posição (em
// pontos PDF, origem inferior-esquerda) de cada linha — usada tanto pro
// parsing "Rótulo: Valor" (ver labelParser.ts) quanto pra desenhar o
// retângulo de destaque sobre o PDF na visualização de documento (ver
// PdfOverlayViewer.tsx).
//
// Import isolado nesse módulo pra manter o resto do código independente de
// qual build do pdfjs está sendo usado (browser vs. Node/teste).

/** Um "item" de texto original do PDF já posicionado dentro da linha. */
export interface PdfTextItemPos {
  x: number;
  largura: number;
  /** Índices de caractere GLOBAIS (mesma escala de `fullText` do documento inteiro, não só da linha). */
  inicio: number;
  fim: number;
}

export interface PdfTextRow {
  pageIndex: number; // 1-based — duplicado aqui pra não precisar navegar de volta até a página ao consumir só `linhas`
  y: number;
  /** Início/fim horizontal ocupado pela linha inteira, em pontos PDF. */
  xMin: number;
  xMax: number;
  /** Altura aproximada da linha (maior glifo da linha), em pontos PDF. */
  altura: number;
  text: string;
  /** Posição desta linha (índices de caractere) dentro do `fullText` do documento inteiro. */
  offsetInicio: number;
  offsetFim: number;
  /**
   * Itens originais que compõem a linha, com posição x individual. Uma linha
   * do PDF pode conter MAIS DE UM campo lado a lado (grade de 2 colunas,
   * comum no template do RDE — ex. "Material da Linha" e "Pressão de
   * Operação" na mesma linha visual) — pra desenhar um retângulo só em cima
   * do campo certo (e não da linha toda), é preciso saber qual item cobre
   * qual trecho de caractere.
   */
  itens: PdfTextItemPos[];
}

export interface PdfPageText {
  pageIndex: number; // 1-based
  /** Dimensões da página em pontos PDF (já considerando rotação). */
  largura: number;
  altura: number;
  rows: PdfTextRow[];
  fullText: string; // linhas concatenadas em ordem de leitura, separadas por \n
}

export interface PdfExtractedText {
  paginas: PdfPageText[];
  fullText: string; // todas as páginas concatenadas
  /** Todas as linhas do documento, em ordem, já com offset dentro de `fullText`. */
  linhas: PdfTextRow[];
}

const TOL_Y = 3; // tolerância de agrupamento de linha, em pontos PDF

// Limiar de espaço entre itens de texto adjacentes, em pontos PDF. Alguns
// PDFs (em geral gerados via Word, e sempre que a palavra tem letra
// acentuada) quebram uma única palavra em vários "text items" separados no
// content stream — cada caractere ao redor de um acento vira seu próprio
// item. Calibrado com dados reais: o vão entre pedaços da MESMA palavra fica
// entre -0.1 e +0.05pt (praticamente encostando), enquanto o vão entre
// palavras/campos de fato distintos fica em geral >= 4pt (chegando a 20-85pt
// entre rótulo e valor). Um limiar fixo de 1.5pt separa os dois casos com
// folga nesses exemplos.
const LIMIAR_ESPACO_PT = 1.5;

interface ItemBrutoPos {
  x: number;
  largura: number;
  inicioLocal: number;
  fimLocal: number;
}

interface LinhaBruta {
  y: number;
  xMin: number;
  xMax: number;
  altura: number;
  text: string;
  itens: ItemBrutoPos[];
}

interface PaginaBruta {
  pageIndex: number;
  largura: number;
  altura: number;
  rows: LinhaBruta[];
}

async function extrairPagina(doc: any, pageIndex: number): Promise<PaginaBruta> {
  const page = await doc.getPage(pageIndex);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  const items = content.items
    .filter((i: any) => "str" in i && i.str.trim())
    .map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5], largura: i.width ?? 0, altura: i.height ?? 0 }))
    .sort((a: any, b: any) => b.y - a.y || a.x - b.x);

  const rows: { y: number; items: { str: string; x: number; largura: number; altura: number }[] }[] = [];
  for (const it of items) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= TOL_Y);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);

  const textRows: LinhaBruta[] = rows.map((r) => {
    const ordenados = r.items.slice().sort((a, b) => a.x - b.x);
    let texto = "";
    let fimAnterior: number | null = null;
    const itens: ItemBrutoPos[] = [];
    for (const it of ordenados) {
      if (fimAnterior !== null && it.x - fimAnterior > LIMIAR_ESPACO_PT) {
        texto += " ";
      }
      const inicioLocal = texto.length;
      texto += it.str;
      itens.push({ x: it.x, largura: it.largura, inicioLocal, fimLocal: texto.length });
      fimAnterior = it.x + it.largura;
    }
    // Sem collapse agressivo de espaço aqui (`replace(/\s+/g, ' ')`) pra não
    // desalinhar os offsets locais dos itens acima — a linha nunca começa com
    // espaço (só inserido ENTRE itens), então só cortamos um possível espaço
    // sobrando no fim (não desloca nada antes dele).
    const textoFinal = texto.trimEnd();
    const xMin = Math.min(...ordenados.map((i) => i.x));
    const xMax = Math.max(...ordenados.map((i) => i.x + i.largura));
    const alturaLinha = Math.max(...ordenados.map((i) => i.altura), 0);
    return { y: r.y, xMin, xMax, altura: alturaLinha, text: textoFinal, itens };
  });

  return { pageIndex, largura: viewport.width, altura: viewport.height, rows: textRows };
}

export async function extrairTextoPdf(pdfjsLib: any, data: Uint8Array): Promise<PdfExtractedText> {
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const brutas: PaginaBruta[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    brutas.push(await extrairPagina(doc, p));
  }

  // Offset de cada linha é calculado num passo único sobre TODAS as linhas do
  // documento (não por página), porque `fullText` final é equivalente a
  // juntar todas as linhas com "\n" — juntar por página e depois juntar as
  // páginas por "\n" dá exatamente o mesmo resultado, então os offsets batem.
  const linhas: PdfTextRow[] = [];
  let offset = 0;
  const paginas: PdfPageText[] = brutas.map((pg) => {
    const rowsComOffset: PdfTextRow[] = pg.rows.map((r) => {
      const offsetInicio = offset;
      offset += r.text.length;
      const offsetFim = offset;
      offset += 1; // separador "\n"
      const itensGlobais: PdfTextItemPos[] = r.itens.map((it) => ({
        x: it.x,
        largura: it.largura,
        inicio: it.inicioLocal + offsetInicio,
        fim: it.fimLocal + offsetInicio,
      }));
      const linha: PdfTextRow = { pageIndex: pg.pageIndex, ...r, itens: itensGlobais, offsetInicio, offsetFim };
      linhas.push(linha);
      return linha;
    });
    return {
      pageIndex: pg.pageIndex,
      largura: pg.largura,
      altura: pg.altura,
      rows: rowsComOffset,
      fullText: rowsComOffset.map((r) => r.text).join("\n"),
    };
  });

  return {
    paginas,
    fullText: paginas.map((p) => p.fullText).join("\n"),
    linhas,
  };
}
