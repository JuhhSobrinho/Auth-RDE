import type { MemorialData } from "../../types";
import { extrairTextoPdf } from "./pdfText";
import { parseMemorial } from "./parseMemorial";
import { ehMemorialModeloNovo, parseMemorialNovo } from "./parseMemorialNovo";

/**
 * Lê o memorial de cálculo detectando qual dos dois modelos ele é — o modelo
 * legado (Composite Repair Specification + Composite Design Assessment) e o
 * modelo novo (ISO 24817 2026 Calculation Sheet) convivem durante a migração.
 */
export async function extractMemorial(pdfjsLib: any, bytes: Uint8Array): Promise<MemorialData> {
  const texto = await extrairTextoPdf(pdfjsLib, bytes).catch(() => null);
  if (texto && ehMemorialModeloNovo(texto.fullText)) return parseMemorialNovo(texto);
  const legado = parseMemorial(texto);
  legado.extracao.modeloMemorial = "legado";
  return legado;
}
