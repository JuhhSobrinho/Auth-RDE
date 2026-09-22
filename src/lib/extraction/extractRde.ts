import type { RdeData } from "../../types";
import { lerAcroForm } from "./acroform";
import { extrairTextoPdf } from "./pdfText";
import { detectarImagens } from "./images";
import { parseRde } from "./parseRde";

/**
 * Orquestra a extração de um RDE: tenta AcroForm, tenta texto/layout, sempre
 * detecta imagens (presença de foto). `pdfjsLib` é injetado pra manter esse
 * módulo agnóstico de qual build do pdfjs-dist está em uso (browser vs. Node).
 */
export async function extractRde(pdfjsLib: any, bytes: Uint8Array): Promise<RdeData> {
  const [acroFields, texto, imagens] = await Promise.all([
    lerAcroForm(bytes).catch(() => []),
    extrairTextoPdf(pdfjsLib, bytes).catch(() => null),
    detectarImagens(bytes).catch(() => []),
  ]);
  return parseRde(acroFields, texto, imagens);
}
