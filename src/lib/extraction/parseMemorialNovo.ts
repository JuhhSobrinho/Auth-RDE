import type { MemorialData, ValorComUnidade } from "../../types";
import { parseValorComUnidade } from "../units";
import type { PdfExtractedText } from "./pdfText";
import type { Intervalo } from "./labelParser";
import { mapaDePosicoes } from "./posicao";

// Parser do modelo NOVO de memorial de cálculo ("Engineered Composite
// Repairs — Calculations in accordance with ISO 24817 2026", planilha
// "ISO 24817 2026 Calculation Sheet"). Convive com o modelo legado
// (parseMemorial.ts) enquanto a migração acontece aos poucos — a escolha
// entre os dois é feita por `ehMemorialModeloNovo` (ver extractMemorial.ts).
//
// Diferenças em relação ao modelo legado que importam pra comparação:
// - Tudo é uma linha "Rótulo  símbolo  valor unidade  [valor em outra unidade]"
//   (ex. "Component External Diameter D 88.9 mm 3.50 in"), em vez de pares
//   "Rótulo:" / valor — então cada campo é lido por regex da própria linha.
// - Pressões vêm em N/mm² (= MPa; o texto sai como "Nmm" porque o expoente
//   "-2" é um item separado, acima da linha), com a conversão pra kgf/cm²
//   só no resumo da página 2 (ex. "1.57 Nmm 16.0 kgf/cm²").
// - Só existe temperatura MÁXIMA de superfície na instalação (sem mínima).
// - Não existe "Defect Type: Perforation/Leak" nem "Type B Basis" com número
//   de equação: o sinal de furo é "Defect type considered: Type A and B"
//   (Type B = defeito passante, ISO 24817 §9.8) e "Type B defect design basis".
// - Comprimento: não há "Required | Requested" — há o comprimento mínimo
//   calculado ("Total repair length") e "Requested repair length" (0 = nenhum
//   pedido pelo cliente).

/** Detecta o modelo novo pelo texto característico da capa/rodapé. */
export function ehMemorialModeloNovo(fullText: string): boolean {
  return /ISO 24817 2026 Calculation Sheet|Calculations in accordance with ISO 24817 2026/i.test(fullText);
}

const NUM = "(-?\\d+(?:[.,]\\d+)?)";

export function parseMemorialNovo(textoExtraido: PdfExtractedText | null): MemorialData {
  const avisos: string[] = [];
  const fullText = textoExtraido?.fullText ?? "";
  const intervalosCampos: Record<string, Intervalo> = {};

  // Marca a posição (no fullText) do trecho casado, pro destaque no PDF.
  const marcar = (chave: string, m: RegExpMatchArray | null, grupo = 0) => {
    if (!m || m.index === undefined) return;
    const texto = m[grupo];
    if (!texto) return;
    const inicio = grupo === 0 ? m.index : fullText.indexOf(texto, m.index);
    if (inicio < 0) return;
    intervalosCampos[chave] = { inicio, fim: inicio + texto.length };
  };

  const casar = (chave: string, re: RegExp, grupo = 1): string | undefined => {
    const m = fullText.match(re);
    marcar(chave, m, grupo);
    const v = m?.[grupo]?.replace(/\s+/g, " ").trim();
    return v || undefined;
  };

  // Número + unidade da linha (primeira unidade após o símbolo). Aceita o
  // valor na unidade original e deixa a 2a unidade (ex. "3.50 in") de fora.
  const comUnidade = (chave: string, re: RegExp, unidadeFixa?: string): ValorComUnidade => {
    const m = fullText.match(re);
    marcar(chave, m);
    if (!m) return parseValorComUnidade(undefined);
    return parseValorComUnidade(`${m[1]} ${unidadeFixa ?? m[2] ?? ""}`.trim());
  };

  // --- Capa (página 1): "Prepared for:", "Location:", "Subject:", ... ---
  const operator = casar("operator", /Prepared for:\s*([\s\S]*?)\s*\n\s*Location:/);
  const location = casar("location", /\nLocation:\s*([\s\S]*?)\s*\n\s*Subject:/);
  const projectId = casar("projectId", /Subject:\s*([\s\S]*?)\s*\n\s*Component ID:/);
  const componentId = casar("lineIdentity", /Component ID:\s*([\s\S]*?)\s*\n\s*TEAM reference:/);
  const engineeringId = casar("engineeringId", /TEAM reference:\s*(\d[\w./-]*)/);
  if (componentId) intervalosCampos.equipmentLineId = intervalosCampos.lineIdentity;

  // --- Original Component Information / Line Contents ---
  const lineMaterial = casar("lineMaterial", /Component material family\s+([^\n]+)/);
  const lineDiameter = comUnidade("lineDiameter", new RegExp(`Component External Diameter\\s+D\\s+${NUM}\\s*(mm)`));
  const lineWall = comUnidade("lineOriginalWallThickness", new RegExp(`Original wall thickness\\s+t\\s+${NUM}\\s*(mm)`));
  // O conteúdo da linha é a 1a linha de texto depois do cabeçalho "Line Contents".
  const lineContents = casar("lineContents", /\nLine Contents\s*\n([^\n]+)/);

  // --- Defeito / furo ---
  const axialDefect = comUnidade("axialDefectLength", new RegExp(`Axial length of defect\\s+${NUM}\\s*(mm)`));
  const defectTypeConsiderado = casar("defectTypeConsiderado", /Defect type considered\s+([^\n]+)/);
  const typeBBasis = casar("typeBBasisConteudo", /Type B defect design basis\s+([^\n]+)/);
  const defectTypeDescricao = casar("defectType", /\nDefect type\s+(?!considered)([^\n]+)/);
  const minRemainingWall = fullText.match(new RegExp(`Minimum remaining wall thickness\\s+t\\s*s\\s+${NUM}\\s*mm`));

  // Type B = defeito passante (ISO 24817 §9.8). Fontes, da mais à menos
  // direta: (1) "Defect type considered" cita "Type B"; (2) "Type B defect
  // design basis" preenchido; (3) espessura remanescente mínima = 0 mm.
  let defeitoPassante: { valor: boolean; fonte: string } | undefined;
  if (defectTypeConsiderado) {
    defeitoPassante = {
      valor: /\bB\b/.test(defectTypeConsiderado),
      fonte: `Defect type considered: ${defectTypeConsiderado}`,
    };
  } else if (typeBBasis !== undefined) {
    defeitoPassante = { valor: typeBBasis.trim().length > 0, fonte: `Type B defect design basis: ${typeBBasis}` };
  } else if (minRemainingWall) {
    const t = Number.parseFloat(minRemainingWall[1].replace(",", "."));
    defeitoPassante = { valor: t <= 0, fonte: `Minimum remaining wall thickness: ${minRemainingWall[1]} mm` };
  }

  // --- Condições de projeto (página 3: "Repair Design Conditions") ---
  // Pressão em N/mm² (o "-2" do expoente é um item à parte, então o texto
  // fica "... 1.57 Nmm"). O resumo da pág. 2 repete o valor já em kgf/cm²
  // ("1.57 Nmm 16.0 kgf/cm²") — guardamos esse equivalente no texto exibido.
  const kgfResumo = fullText.match(new RegExp(`Maximum repair design pressure\\s+p\\s+${NUM}\\s*Nmm\\s+${NUM}\\s*kgf/cm`));
  const pressaoMPa = (chave: string, re: RegExp, equivalenteKgf?: string): ValorComUnidade => {
    const m = fullText.match(re);
    marcar(chave, m);
    if (!m) return parseValorComUnidade(undefined);
    const valor = Number.parseFloat(m[1].replace(",", "."));
    return {
      valorOriginal: `${m[1]} Nmm⁻²${equivalenteKgf ? ` (${equivalenteKgf} kgf/cm²)` : ""}`,
      valor,
      unidade: "Nmm-2",
    };
  };
  const repairDesignPressure = pressaoMPa(
    "repairDesignPressure",
    new RegExp(`Maximum repair design pressure \\(internal\\)\\s+p\\s+${NUM}\\s*Nmm`),
    kgfResumo?.[2]
  );
  const operatingPressure = pressaoMPa("operatingPressure", new RegExp(`System internal operating pressure\\s+p\\s*op\\s+${NUM}\\s*Nmm`));
  const maxDesignTemperature = comUnidade("maxDesignTemperature", new RegExp(`Maximum design temperature\\s+T\\s+${NUM}\\s*(°C)`));
  const maxOperatingTemperature = comUnidade("maxOperatingTemperature", new RegExp(`System operating temperature\\s+T\\s*op\\s+${NUM}\\s*(°C)`));
  const maxInstallSurfaceTemp = comUnidade(
    "maxInstallSurfaceTempA",
    new RegExp(`Maximum surface temperature at time of installation\\s+T\\s*install\\s+${NUM}\\s*(°C)`)
  );

  // --- Sistema de reparo / camadas / comprimento ---
  const repairSystem = casar("repairSystem", /Repair system selected\s+([A-Z]{2,}-[A-Z]{2,}(?:[\s-][A-Z]{2}(?:\([a-zA-Z]\))?)?)/);
  const straight = fullText.match(new RegExp(`Straight\\s+${NUM}\\s*mm\\s+(\\d+)\\s*layers?`));
  const elbow = fullText.match(new RegExp(`Elbows?\\s+${NUM}\\s*mm\\s+(\\d+)\\s*layers?`));
  marcar("straightLayers", straight);
  marcar("elbowLayers", elbow);
  const overlap = comUnidade("requiredOverlap", new RegExp(`Minimum axial extent of repair beyond defect\\s+l\\s*over\\s+${NUM}\\s*(mm)`));
  // Comprimento mínimo total calculado (usa a coluna com 1 casa decimal da
  // pág. 2, ex. "447 mm 447.3 mm" -> 447.3, pra não arredondar pra baixo).
  const minTotalLength = fullText.match(new RegExp(`Total repair length\\s+l\\s+${NUM}\\s*mm\\s+${NUM}\\s*mm`));
  marcar("minimumRequiredRepairLength", minTotalLength);
  const minimumRequiredRepairLength = parseValorComUnidade(minTotalLength ? `${minTotalLength[2]} mm` : undefined);
  // "Requested repair length 0 mm" = o cliente não especificou comprimento.
  const requested = fullText.match(new RegExp(`Requested repair length\\s+${NUM}\\s*mm`));
  const requestedMm = requested ? Number.parseFloat(requested[1].replace(",", ".")) : 0;
  const customerSpecifiedRepairLength =
    requested && requestedMm > 0 ? parseValorComUnidade(`${requested[1]} mm`) : parseValorComUnidade(undefined);
  if (requested && requestedMm > 0) marcar("customerSpecifiedRepairLength", requested);

  const faltando = (nome: string, v: unknown) => {
    if (v === undefined || (typeof v === "object" && v !== null && "valor" in v && (v as ValorComUnidade).valor === null)) {
      avisos.push(`Modelo novo de memorial: não foi possível ler "${nome}" — conferir manualmente neste campo.`);
    }
  };
  faltando("Component ID", componentId);
  faltando("Maximum repair design pressure", repairDesignPressure);
  faltando("Total repair length", minimumRequiredRepairLength);
  faltando("Repair system selected", repairSystem);

  return {
    meta: {
      operator,
      location,
      equipmentLineId: componentId,
      engineeringId,
      projectId,
    },
    repairSpec: {
      lineIdentity: componentId,
      lineDiameter,
      lineOriginalWallThickness: lineWall,
      repairDesignPressure,
      repairDesignTemperature: maxDesignTemperature,
      repairSystem,
      requiredOverlap: overlap,
      customerSpecifiedRepairLength,
      minimumRequiredRepairLength,
    },
    systemDetails: {
      lineContents,
      lineMaterial,
      designPressure: repairDesignPressure,
      maxDesignTemperature,
      operatingPressure,
      maxOperatingTemperature,
    },
    defectDetails: {
      axialDefectLength: axialDefect,
      defectType: defectTypeDescricao,
      typeBBasisConteudo: typeBBasis,
      defeitoPassante,
    },
    layerCountOverview: {
      straightLayers: straight ? Number.parseInt(straight[2], 10) : undefined,
      elbowLayers: elbow ? Number.parseInt(elbow[2], 10) : undefined,
    },
    installationConditions: {
      // O modelo novo só informa a temperatura MÁXIMA de superfície na
      // instalação — sem mínima. A checagem em compare.ts trata limite único.
      maxInstallSurfaceTemperature: maxInstallSurfaceTemp,
    },
    extracao: { metodo: "text-layout", avisos, modeloMemorial: "iso24817-2026" },
    posicoesCampos: mapaDePosicoes(textoExtraido?.linhas ?? [], intervalosCampos),
  };
}
