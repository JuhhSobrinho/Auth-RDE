import type { MemorialData } from "../../types";
import { extrairTextoPdf } from "./pdfText";
import { parseMemorial } from "./parseMemorial";

export async function extractMemorial(pdfjsLib: any, bytes: Uint8Array): Promise<MemorialData> {
  const texto = await extrairTextoPdf(pdfjsLib, bytes).catch(() => null);
  return parseMemorial(texto);
}
