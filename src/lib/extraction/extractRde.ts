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
  // O pdfjs-dist assume posse do ArrayBuffer passado em `getDocument({data})`
  // (transfere em vez de copiar, por performance) — o array original fica
  // com `.length === 0` depois. Como `bytes` também precisa continuar
  // utilizável DEPOIS do Promise.all (pra `parseRde` ler os bytes crus na
  // checagem de integridade), cada chamada abaixo recebe sua PRÓPRIA cópia
  // em vez da mesma referência.
  const [acroFields, texto, imagens] = await Promise.all([
    lerAcroForm(bytes.slice()).catch(() => []),
    extrairTextoPdf(pdfjsLib, bytes.slice()).catch(() => null),
    detectarImagens(bytes.slice()).catch(() => []),
  ]);
  return parseRde(acroFields, texto, imagens, bytes);
}
