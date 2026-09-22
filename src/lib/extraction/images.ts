import { PDFDocument, PDFName, PDFDict, PDFStream } from "pdf-lib";

export interface ImagemDetectada {
  paginaIndex: number; // 1-based
  largura: number;
  altura: number;
}

/**
 * Enumera as imagens embutidas em cada página de um PDF usando pdf-lib,
 * sem precisar interpretar o conteúdo — só existência e tamanho.
 * Usado pra checagem de PRESENÇA de foto (regra G do catálogo), nunca pra
 * interpretar o que a foto mostra (isso é Fase 2 / IA, fora do MVP).
 */
export async function detectarImagens(bytes: Uint8Array): Promise<ImagemDetectada[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const resultado: ImagemDetectada[] = [];

  const pages = doc.getPages();
  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const resources = page.node.Resources();
    if (!resources) continue;
    const xObjectsRef = resources.get(PDFName.of("XObject"));
    if (!xObjectsRef) continue;
    const xObjects = page.doc.context.lookup(xObjectsRef, PDFDict);
    if (!xObjects) continue;

    for (const [, ref] of xObjects.entries()) {
      const stream = page.doc.context.lookupMaybe(ref, PDFStream);
      if (!stream) continue;
      const subtype = stream.dict.get(PDFName.of("Subtype"));
      if (!subtype || subtype.toString() !== "/Image") continue;
      const widthObj = stream.dict.get(PDFName.of("Width"));
      const heightObj = stream.dict.get(PDFName.of("Height"));
      const largura = widthObj ? Number((widthObj as any).numberValue ?? widthObj) : 0;
      const altura = heightObj ? Number((heightObj as any).numberValue ?? heightObj) : 0;
      resultado.push({ paginaIndex: idx + 1, largura, altura });
    }
  }
  return resultado;
}

/**
 * Classifica imagens "grandes" (candidatas a foto de execução) descartando
 * ícones/logo pequenos. Limiar pragmático baseado no template observado:
 * fotos reais vêm em ~700-1000px, logo/ícones em <=500px de largura OU altura.
 */
export function contarFotosCandidatas(imagens: ImagemDetectada[], paginaIndex = 1): number {
  return imagens.filter((i) => i.paginaIndex === paginaIndex && i.largura >= 500 && i.altura >= 500).length;
}
