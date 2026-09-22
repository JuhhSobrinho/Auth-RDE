import { pdfjsLib } from "./pdfjsSetup";
import { extractRde } from "./extraction/extractRde";
import { extractMemorial } from "./extraction/extractMemorial";
import { comparar } from "./comparison/compare";
import type { RdeData, MemorialData, ComparisonResult } from "../types";

export interface ResultadoVerificacao {
  rde: RdeData;
  memorial: MemorialData;
  comparacao: ComparisonResult;
}

async function paraBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Orquestra a verificação completa: lê os dois PDFs (RDE + Memorial de
 * Cálculo), extrai os dados de cada um via biblioteca (sem IA — ver
 * docs/regras-de-comparacao.md) e roda o motor de comparação. Tudo em
 * memória, no navegador — nenhum dado sai da máquina do usuário e nada é
 * persistido (ver decisão de escopo do MVP).
 */
export async function verificar(rdeFile: File, memorialFile: File): Promise<ResultadoVerificacao> {
  const [rdeBytes, memBytes] = await Promise.all([paraBytes(rdeFile), paraBytes(memorialFile)]);
  // Extrai o RDE e o memorial em SEQUÊNCIA, não em paralelo (`Promise.all`).
  // Os dois usam `pdfjsLib.getDocument(...)` — abrir dois documentos pdfjs ao
  // mesmo tempo (via Promise.all) se mostrou capaz de embaralhar a resposta
  // de uma chamada `getPage()`/`getTextContent()` entre os dois documentos
  // sob carga (mesmo bug observado na visualização em PDF — ver
  // PdfOverlayViewer.tsx), corrompendo silenciosamente a extração de um dos
  // dois lados (a maioria dos campos vira "Não Verificável" sem nenhum erro
  // visível). Sequencial é levemente mais lento, mas eliminar esse risco de
  // corrupção silenciosa importa muito mais aqui do que alguns ms a menos.
  const rde = await extractRde(pdfjsLib, rdeBytes);
  const memorial = await extractMemorial(pdfjsLib, memBytes);
  const comparacao = comparar(rde, memorial);
  return { rde, memorial, comparacao };
}
