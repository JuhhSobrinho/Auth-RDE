import type { PdfTextRow } from "./pdfText";
import type { CampoPosicao } from "../../types";

export type { CampoPosicao };

/**
 * Dado um intervalo de caracteres [inicio, fim) no `fullText` do documento
 * (o mesmo espaço de offsets que `PdfTextRow.offsetInicio/offsetFim` usa),
 * devolve o retângulo que cobre só os ITENS de texto originais que caem
 * dentro desse intervalo — não a linha inteira, que pode conter outro campo
 * ao lado (grade de 2 colunas). Quando o intervalo cruza mais de uma linha
 * (valor que quebrou), devolve um retângulo por linha afetada.
 */
export function boxParaIntervalo(linhas: PdfTextRow[], inicio: number, fim: number): CampoPosicao[] {
  const caixas: CampoPosicao[] = [];
  for (const linha of linhas) {
    if (linha.offsetFim <= inicio || linha.offsetInicio >= fim) continue; // sem sobreposição com essa linha
    const itensNoIntervalo = linha.itens.filter((it) => it.fim > inicio && it.inicio < fim);
    if (itensNoIntervalo.length === 0) continue;
    const xMin = Math.min(...itensNoIntervalo.map((i) => i.x));
    const xMax = Math.max(...itensNoIntervalo.map((i) => i.x + i.largura));
    caixas.push({ pagina: linha.pageIndex, x: xMin, y: linha.y, largura: xMax - xMin, altura: linha.altura });
  }
  return caixas;
}

/**
 * Atalho pra montar um mapa {chave -> primeira caixa} a partir de um mapa de
 * intervalos (o que `extrairPorRotulos`/`extrairGrupoCheckbox` devolvem) —
 * usado quando só interessa UM retângulo por campo (o caso comum; quando o
 * valor quebra linha, fica só a primeira, que já é a mais relevante porque
 * inclui o rótulo).
 */
export function mapaDePosicoes(linhas: PdfTextRow[], intervalos: Record<string, { inicio: number; fim: number }>): Record<string, CampoPosicao> {
  const mapa: Record<string, CampoPosicao> = {};
  for (const [chave, intervalo] of Object.entries(intervalos)) {
    const caixas = boxParaIntervalo(linhas, intervalo.inicio, intervalo.fim);
    if (caixas.length > 0) mapa[chave] = caixas[0];
  }
  return mapa;
}

/**
 * Como `mapaDePosicoes`, mas pra campos que são um BLOCO de texto livre
 * ocupando várias linhas (ex. "Resumo das Atividades", tabela "Materiais
 * Utilizados") — em vez de ficar só com a 1a linha, devolve o retângulo
 * ENVOLVENTE (bounding box) de todas as linhas afetadas, agrupado por
 * página (a maioria dos casos cai numa página só, mas o bloco pode em tese
 * cruzar pra outra). Usado quando a visualização precisa marcar "a caixa
 * inteira" do campo, não um trecho específico dentro dele.
 */
export function mapaDeAreas(linhas: PdfTextRow[], intervalos: Record<string, { inicio: number; fim: number }>): Record<string, CampoPosicao[]> {
  const mapa: Record<string, CampoPosicao[]> = {};
  for (const [chave, intervalo] of Object.entries(intervalos)) {
    const caixas = boxParaIntervalo(linhas, intervalo.inicio, intervalo.fim);
    if (caixas.length === 0) continue;
    const porPagina = new Map<number, CampoPosicao[]>();
    for (const c of caixas) {
      const lista = porPagina.get(c.pagina) ?? [];
      lista.push(c);
      porPagina.set(c.pagina, lista);
    }
    const envolventes: CampoPosicao[] = [];
    for (const [pagina, lista] of porPagina) {
      const xMin = Math.min(...lista.map((c) => c.x));
      const xMax = Math.max(...lista.map((c) => c.x + c.largura));
      const yMin = Math.min(...lista.map((c) => Math.min(c.y, c.y + c.altura)));
      const yMax = Math.max(...lista.map((c) => Math.max(c.y, c.y + c.altura)));
      envolventes.push({ pagina, x: xMin, y: yMin, largura: xMax - xMin, altura: yMax - yMin });
    }
    mapa[chave] = envolventes;
  }
  return mapa;
}
