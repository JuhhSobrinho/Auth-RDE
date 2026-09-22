import { PDFDocument, PDFCheckBox, PDFTextField, PDFRadioGroup } from "pdf-lib";

/** Retângulo do widget de um campo de AcroForm no PDF, em pontos PDF (mesmo referencial que `CampoPosicao`). */
export interface RetanguloAcroForm {
  pagina: number; // 1-based
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface CampoAcroForm {
  nome: string;
  tipo: "texto" | "checkbox" | "radio" | "outro";
  valor: string | boolean | null;
  /**
   * Posição do 1º widget desse campo no PDF, quando localizável. Útil pra
   * campos de BLOCO cujo valor não aparece na camada de texto na mesma
   * posição visual (ex. "Resumo das Atividades": o texto digitado no campo
   * de formulário não sai junto dos outros rótulos/valores no `getTextContent`
   * do pdfjs — fica só acessível via este AcroForm — então não dá pra achar
   * a posição por regex em cima do texto reconstruído como os outros campos;
   * a posição real vem direto do retângulo do próprio widget).
   */
  retangulo?: RetanguloAcroForm;
}

/**
 * Lê os campos de um AcroForm (PDF editado no Acrobat / gerado com campos
 * preenchíveis de verdade). Devolve [] se o PDF não tiver formulário —
 * nesse caso o chamador deve cair pro extrator de texto (textLayout).
 */
export async function lerAcroForm(bytes: Uint8Array): Promise<CampoAcroForm[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();

  // pdf-lib não expõe diretamente "em qual página está este campo" a partir
  // do campo em si — só dá pra descobrir olhando as anotações de CADA
  // página e comparando com os widgets do campo. Monta esse mapa uma vez
  // (dict do widget -> índice de página) pra não repetir a varredura por
  // campo.
  const paginaPorWidgetDict = new Map<object, number>();
  try {
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const annots = pages[i].node.Annots();
      const arr = annots ? annots.asArray() : [];
      for (const ref of arr) {
        const dict = doc.context.lookup(ref);
        if (dict) paginaPorWidgetDict.set(dict, i + 1);
      }
    }
  } catch {
    // Sem mapa de página, os campos ainda funcionam — só ficam sem `retangulo`.
  }

  function retanguloDoCampo(f: (typeof fields)[number]): RetanguloAcroForm | undefined {
    try {
      const widget = f.acroField.getWidgets()[0];
      if (!widget) return undefined;
      const pagina = paginaPorWidgetDict.get(widget.dict);
      if (pagina === undefined) return undefined;
      const r = widget.getRectangle();
      return { pagina, x: r.x, y: r.y, largura: r.width, altura: r.height };
    } catch {
      return undefined;
    }
  }

  return fields.map((f) => {
    const nome = f.getName();
    const retangulo = retanguloDoCampo(f);
    if (f instanceof PDFCheckBox) {
      return { nome, tipo: "checkbox" as const, valor: f.isChecked(), retangulo };
    }
    if (f instanceof PDFTextField) {
      return { nome, tipo: "texto" as const, valor: f.getText() ?? "", retangulo };
    }
    if (f instanceof PDFRadioGroup) {
      return { nome, tipo: "radio" as const, valor: f.getSelected() ?? null, retangulo };
    }
    return { nome, tipo: "outro" as const, valor: null, retangulo };
  });
}

export function campoTexto(campos: CampoAcroForm[], nome: string): string | undefined {
  const c = campos.find((c) => c.nome === nome && c.tipo === "texto");
  const v = c?.valor;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function campoMarcado(campos: CampoAcroForm[], nome: string): boolean {
  const c = campos.find((c) => c.nome === nome && c.tipo === "checkbox");
  return c?.valor === true;
}

/** Posição do widget de um campo de AcroForm, quando localizável — ver `CampoAcroForm.retangulo`. */
export function campoRetangulo(campos: CampoAcroForm[], nome: string): RetanguloAcroForm | undefined {
  return campos.find((c) => c.nome === nome)?.retangulo;
}
