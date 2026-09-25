// Liga cada checagem (identificada pela `descricao` usada em compare.ts) às
// chaves internas de `posicoesCampos` do RDE e do memorial (ver
// parseRde.ts/parseMemorial.ts) — usado pelo PdfOverlayViewer pra saber onde
// desenhar o retângulo colorido de cada checagem em cima do PDF de origem.
//
// Mantido como uma tabela separada (em vez de acoplar isso a compare.ts)
// porque a relação é só sobre POSIÇÃO NO PDF, não sobre a lógica de
// comparação em si — várias checagens podem apontar pra nenhuma, uma ou
// várias chaves (ex. "Número de camadas" no memorial vem de duas seções
// somadas: reto e curva).
export type LadoDocumento = "rde" | "memorial";

interface MapaCampo {
  rde?: string[];
  memorial?: string[];
  /**
   * Chave de `RdeData.posicoesAreas` (área de bloco — caixa envolvente de
   * várias linhas) usada por esta checagem, quando ela não tem um trecho
   * específico pra destacar (ex. um nome citado em texto livre) mas sim a
   * seção inteira de onde o valor foi lido (ex. "Resumo das Atividades",
   * "Materiais Utilizados"). Diferente de `rde`/`memorial`, que marcam UM
   * campo pontual, a área é colorida pela checagem AGREGADA (pior status)
   * entre todas as checagens que apontam pra ela — ver `construirMarcadores`
   * em PdfOverlayViewer.tsx.
   */
  rdeArea?: string;
}

const MAPA: Record<string, MapaCampo> = {
  "Cliente / Operador": { rde: ["cliente"], memorial: ["operator"] },
  "Local": { rde: ["local"], memorial: ["location"] },
  "TAG da linha / Line Identity": { rde: ["tagLinha"], memorial: ["lineIdentity", "equipmentLineId"] },
  "OS Team / Project ID": { rde: ["osTeam"], memorial: ["projectId"] },
  // O valor do RDE vem de dentro do próprio texto do "Resumo das
  // Atividades" ("Ref Engenharia : ..."), então essa checagem também entra
  // na agregação da caixa do resumo — sem isso, uma referência divergente
  // não aparecia refletida na cor da caixa, mesmo lendo o número dali.
  "Referência de engenharia": { memorial: ["engineeringId"], rdeArea: "resumoAtividades" },
  "Emitido por": { rde: ["emitidoPor"] },
  "Revisado por": { rde: ["revisadoPor"] },
  // Checagem "de presença" do Resumo das Atividades (ver compare.ts) — marca
  // a caixa inteira do resumo, igual à checagem "PFP citado..." abaixo (as
  // duas apontam pra MESMA área e são agregadas juntas: fica verde quando só
  // esta dispara — resumo preenchido, sem produto específico pra cruzar —, e
  // continua vermelha se a de PFP também disparar com divergência).
  "Resumo das Atividades revisado": { rdeArea: "resumoAtividades" },
  "Diâmetro da linha (OD)": { rde: ["diametroLinha"], memorial: ["lineDiameter"] },
  "Material da linha": { rde: ["materialLinha"], memorial: ["lineMaterial"] },
  "Conteúdo da linha": { rde: ["conteudoLinha"], memorial: ["lineContents"] },
  "Pressão de projeto": { rde: ["pressaoProjeto"], memorial: ["repairDesignPressure"] },
  "Pressão de operação": { rde: ["pressaoOperacao"], memorial: ["operatingPressure"] },
  "Temperatura de operação": { rde: ["temperaturaOperacao"], memorial: ["maxOperatingTemperature"] },
  "Temperatura de projeto": { rde: ["temperaturaProjeto"], memorial: ["maxDesignTemperature"] },
  "Furo na linha": { rde: ["furoNaLinha"], memorial: ["defectType", "typeBBasisConteudo"] },
  "Sistema/material do reparo": { rde: ["tipoReparo"], memorial: ["repairSystem"] },
  // Além do checkbox "Tipo do Reparo" (o outro lado da comparação), marca a
  // caixa inteira de onde o valor citado em texto livre foi lido —
  // "Materiais Utilizados"/"Resumo das Atividades" não têm posição do
  // TRECHO específico (ex. só o nome do PFP dentro do parágrafo), então em
  // vez disso a área inteira é colorida pelo status da checagem.
  "Resina na lista de materiais vs. Tipo do Reparo marcado": { rde: ["tipoReparo"], rdeArea: "materiaisUtilizados" },
  "PFP citado no resumo vs. marcado no Tipo do Reparo": { rde: ["tipoReparo"], rdeArea: "resumoAtividades" },
  "Número de camadas": { rde: ["numeroCamadas"], memorial: ["straightLayers", "elbowLayers"] },
  // Checagem interna do RDE (não compara contra o memorial) — marca os 3
  // campos que entram na conta: espessura registrada, número de camadas e o
  // "Tipo do Reparo" marcado (de onde vem a cura ST/HT usada no cálculo).
  "Espessura aplicada vs. calculada (camadas × resina)": { rde: ["espessuraRep", "numeroCamadas", "tipoReparo"] },
  "Espessura do PFP aplicado vs. referência do produto": { rde: ["espessuraPfp", "pfpMarcados"] },
  "Geometria marcada tem cálculo correspondente": { rde: ["geometria"], memorial: ["straightLayers", "elbowLayers"] },
  "Geometria do reparo marcada": { rde: ["geometria"] },
  "Comprimento aplicado vs. exigido": {
    rde: ["comprimentoReparo"],
    memorial: ["customerSpecifiedRepairLength", "lengthRequestedRequired"],
  },
  "Overlap aplicado": { memorial: ["requiredOverlap"] },
  "Temperatura de superfície dentro da faixa": {
    rde: ["temperaturaSuperficie"],
    memorial: ["minInstallSurfaceTempA", "minInstallSurfaceTempB", "maxInstallSurfaceTempA", "maxInstallSurfaceTempB"],
  },
  "Umidade relativa dentro do limite": { rde: ["umidadeRelativa"], memorial: ["humidityLimitPct"] },
  "Ponto de orvalho vs. temperatura de superfície": { rde: ["pontoOrvalho"] },
  "Rugosidade da superfície preenchida": { rde: ["rugosidadeSuperficie"] },
};

/** Chaves de `posicoesCampos` (do lado pedido) associadas a uma checagem, pelo texto de `descricao`. */
export function camposParaCheck(descricao: string, lado: LadoDocumento): string[] {
  const entrada = MAPA[descricao];
  if (!entrada) return [];
  return (lado === "rde" ? entrada.rde : entrada.memorial) ?? [];
}

/** Chave de `RdeData.posicoesAreas` associada a uma checagem, pelo texto de `descricao` — ver `MapaCampo.rdeArea`. */
export function areaParaCheck(descricao: string): string | undefined {
  return MAPA[descricao]?.rdeArea;
}
