import type { MemorialData } from "../../types";
import { parseValorComUnidade } from "../units";
import type { PdfExtractedText } from "./pdfText";
import { extrairPorRotulos } from "./labelParser";
import type { Intervalo } from "./labelParser";
import { mapaDePosicoes } from "./posicao";
import { MEM_LABELS, MEM_TODOS_ROTULOS, MEM_REGEX } from "./memorialLabels";

function primeiroValido(...valores: (string | undefined)[]): string | undefined {
  for (const v of valores) {
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function parseMemorial(textoExtraido: PdfExtractedText | null): MemorialData {
  const avisos: string[] = [];
  const fullText = textoExtraido?.fullText ?? "";
  const temTexto = fullText.trim().length > 0;

  if (!temTexto) {
    avisos.push("PDF do memorial sem texto extraível — inesperado para esse tipo de documento. Verificar se não é uma versão escaneada.");
  }

  const porRotulo: { valores: Record<string, string>; intervalos: Record<string, Intervalo> } = temTexto
    ? extrairPorRotulos(fullText, MEM_TODOS_ROTULOS)
    : { valores: {}, intervalos: {} };

  // Posição (no PDF) de cada campo, indexada por um nome interno descritivo —
  // consumida por `mapaDePosicoes` no final pra montar `posicoesCampos` (ver
  // PdfOverlayViewer, ainda não implementado).
  const intervalosCampos: Record<string, Intervalo> = {};

  const get = (chaveInterna: string, labelTexto: string | undefined): string | undefined => {
    if (!labelTexto) return undefined;
    if (porRotulo.intervalos[labelTexto]) intervalosCampos[chaveInterna] = porRotulo.intervalos[labelTexto];
    return porRotulo.valores[labelTexto];
  };

  // Marca a posição de um trecho encontrado via regex direta no texto
  // (campos que não passam por `extrairPorRotulos`), usando o `.index` do
  // match (preservado mesmo em `String.prototype.match` com regex não-global).
  const marcarPosicaoRegex = (chaveInterna: string, m: RegExpMatchArray | null, grupo = 0) => {
    if (!m || m.index === undefined) return;
    const texto = m[grupo];
    if (!texto) return;
    const inicio = grupo === 0 ? m.index : fullText.indexOf(texto, m.index);
    if (inicio < 0) return;
    intervalosCampos[chaveInterna] = { inicio, fim: inicio + texto.length };
  };

  const minReqLength = fullText.match(MEM_REGEX.minReqLength);
  const availableOverlap = fullText.match(MEM_REGEX.availableRequiredOverlapPastDefect);
  const humidity = fullText.match(MEM_REGEX.humidity);
  const straightLayers = fullText.match(MEM_REGEX.straightLayers);
  const elbowLayers = fullText.match(MEM_REGEX.elbowLayers);
  const typeBBasisMatch = fullText.match(MEM_REGEX.typeBBasisConteudo);
  marcarPosicaoRegex("lengthRequestedRequired", minReqLength);
  marcarPosicaoRegex("availableRequiredOverlapPastDefect", availableOverlap);
  marcarPosicaoRegex("humidityLimitPct", humidity);
  marcarPosicaoRegex("straightLayers", straightLayers);
  marcarPosicaoRegex("elbowLayers", elbowLayers);
  marcarPosicaoRegex("typeBBasisConteudo", typeBBasisMatch, 1);

  const parseIntSafe = (s: string | undefined) => {
    const n = s ? Number.parseInt(s, 10) : NaN;
    return Number.isNaN(n) ? undefined : n;
  };

  // Esse campo costuma quebrar linha ao redor do próprio rótulo no PDF (o
  // valor aparece parte antes, parte depois de "Repair System:"), então
  // buscamos o código do sistema direto no texto inteiro em vez de confiar
  // no valor recortado pelo parser posicional de rótulos. Alguns memoriais
  // anotam uma variante de resina direto no código (ex. "FCR-BC-ST(b)") antes
  // do parênteses descritivo — "(a)"/"(b)" etc. — por isso esse sufixo é
  // opcional no meio do match, não só depois dele.
  const repairSystemMatch = fullText.match(/([A-Z]{2,}-[A-Z]{2,}-[A-Z]{2,}(?:\([a-zA-Z]\))?)\s*\(\s*Biaxial/);
  marcarPosicaoRegex("repairSystem", repairSystemMatch, 1);

  const repairThicknessValor = get("repairThicknessLayers", MEM_LABELS.repairThickness);

  return {
    meta: {
      operator: get("operator", MEM_LABELS.operator),
      location: get("location", MEM_LABELS.location),
      equipmentLineId: get("equipmentLineId", MEM_LABELS.equipmentLineId),
      engineeringId: get("engineeringId", MEM_LABELS.engineeringId),
      projectId: get("projectId", MEM_LABELS.projectId),
    },
    repairSpec: {
      lineIdentity: get("lineIdentity", MEM_LABELS.lineIdentity),
      lineDiameter: parseValorComUnidade(get("lineDiameter", MEM_LABELS.lineDiameter)),
      lineOriginalWallThickness: parseValorComUnidade(get("lineOriginalWallThickness", MEM_LABELS.lineOriginalWallThickness)),
      repairDesignPressure: parseValorComUnidade(get("repairDesignPressure", MEM_LABELS.repairDesignPressure)),
      repairDesignTemperature: parseValorComUnidade(get("repairDesignTemperature", MEM_LABELS.repairDesignTemperature)),
      repairConditions: get("repairConditions", MEM_LABELS.repairConditions),
      surfaceApplicationTemperature: parseValorComUnidade(get("surfaceApplicationTemperature", MEM_LABELS.surfaceApplicationTemperature)),
      repairSystem: repairSystemMatch?.[1],
      repairThicknessLayers: (() => {
        const m = repairThicknessValor?.match(/(\d+)/);
        return parseIntSafe(m?.[1]);
      })(),
      requiredOverlap: parseValorComUnidade(get("requiredOverlap", MEM_LABELS.requiredOverlap)),
      requiredTaperPerPly: parseValorComUnidade(get("requiredTaperPerPly", MEM_LABELS.requiredTaper)),
      customerSpecifiedRepairLength: parseValorComUnidade(
        primeiroValido(
          get("customerSpecifiedRepairLength", MEM_LABELS.customerSpecifiedRepairLength),
          minReqLength?.[2] ? `${minReqLength[2]} mm` : undefined
        )
      ),
      // Sempre que a linha "Min. Req. Length:" existir, guarda a parte
      // "Required" (o mínimo de verdade) — independente de
      // "Customer specified repair length:" também estar preenchido (esse
      // último é o "Requested", não o mínimo; ver comentário no types.ts).
      minimumRequiredRepairLength: parseValorComUnidade(minReqLength?.[1] ? `${minReqLength[1]} mm` : undefined),
    },
    systemDetails: {
      lineContents: get("lineContents", MEM_LABELS.lineContents),
      lineMaterial: get("lineMaterial", MEM_LABELS.lineMaterial),
      designPressure: parseValorComUnidade(get("designPressure", MEM_LABELS.designPressureSystem)),
      maxDesignTemperature: parseValorComUnidade(get("maxDesignTemperature", MEM_LABELS.maxDesignTemperature)),
      operatingPressure: parseValorComUnidade(get("operatingPressure", MEM_LABELS.operatingPressure)),
      maxOperatingTemperature: parseValorComUnidade(get("maxOperatingTemperature", MEM_LABELS.maxOperatingTemperature)),
    },
    defectDetails: {
      axialDefectLength: parseValorComUnidade(get("axialDefectLength", MEM_LABELS.axialDefectLength)),
      lengthRequestedRequired: parseValorComUnidade(
        primeiroValido(get("lengthRequestedRequired", MEM_LABELS.lengthRequestedRequired), minReqLength?.[1] ? `${minReqLength[1]} mm` : undefined)
      ),
      availableRequiredOverlapPastDefect: parseValorComUnidade(availableOverlap ? `${availableOverlap[1]} mm` : undefined),
      defectType: get("defectType", MEM_LABELS.defectType),
      typeBBasisConteudo: typeBBasisMatch?.[1]?.trim() || undefined,
    },
    layerCountOverview: {
      straightLayers: parseIntSafe(straightLayers?.[1]),
      elbowLayers: parseIntSafe(elbowLayers?.[1]),
    },
    installationConditions: {
      minInstallSurfaceTemperature: parseValorComUnidade(
        primeiroValido(get("minInstallSurfaceTempA", MEM_LABELS.minInstallSurfaceTempA), get("minInstallSurfaceTempB", MEM_LABELS.minInstallSurfaceTempB))
      ),
      maxInstallSurfaceTemperature: parseValorComUnidade(
        primeiroValido(get("maxInstallSurfaceTempA", MEM_LABELS.maxInstallSurfaceTempA), get("maxInstallSurfaceTempB", MEM_LABELS.maxInstallSurfaceTempB))
      ),
      humidityLimitPct: parseIntSafe(humidity?.[1]),
    },
    extracao: { metodo: temTexto ? "text-layout" : "nenhum", avisos },
    posicoesCampos: mapaDePosicoes(textoExtraido?.linhas ?? [], intervalosCampos),
  };
}
