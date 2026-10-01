// Modelos de dados canônicos usados pelo Verificador-RDE.
// Ver docs/regras-de-comparacao.md para o catálogo de regras que consome esses tipos.

export type MetodoExtracao = "acroform" | "text-layout" | "nenhum";

export interface ValorComUnidade {
  valorOriginal: string;
  valor: number | null;
  unidade: string | null;
}

export interface ExtracaoInfo {
  metodo: MetodoExtracao;
  avisos: string[];
}

export interface MaterialUtilizadoItem {
  item?: string;
  qtd?: string;
  descricao?: string;
}

/**
 * Retângulo de destaque de um campo sobre a página do PDF de origem, em
 * pontos PDF (origem inferior-esquerda — mesmo referencial que `pdfjs`
 * usa antes de aplicar o viewport). Usado pra desenhar a marcação colorida
 * na visualização de documento (ver PdfOverlayViewer.tsx); nem todo campo
 * tem posição conhecida (ex. vindo de AcroForm, ou um valor calculado que
 * não corresponde a um único trecho de texto do PDF) — por isso é sempre
 * opcional/pode faltar no mapa.
 */
export interface CampoPosicao {
  pagina: number; // 1-based
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface RdeData {
  meta: {
    cliente?: string;
    local?: string;
    osTeam?: string;
    refEngenharia?: string;
    plaqueta?: string;
    dataEmissao?: string;
    numeroRde?: string;
    emitidoPor?: string;
    revisadoPor?: string;
  };
  tipoReparo: {
    sistemaMarcado?: string; // ex: "TFCR HT-BC"
    pfpMarcados: string[]; // ex: ["JOTACHAR JF750 XT"]
  };
  geometria: {
    marcadas: string[]; // ex: ["CURVA 90"]
  };
  dadosProjeto: {
    diametroLinha?: ValorComUnidade;
    tagLinha?: string;
    materialLinha?: string;
    conteudoLinha?: string;
    pressaoProjeto?: ValorComUnidade;
    temperaturaProjeto?: ValorComUnidade;
    pressaoOperacao?: ValorComUnidade;
    temperaturaOperacao?: ValorComUnidade;
    comprimentoReparo?: ValorComUnidade;
    numeroCamadas?: number;
    espessuraRep?: ValorComUnidade;
    comprimentoPfpAplicado?: ValorComUnidade;
    espessuraPfpAplicada?: ValorComUnidade;
    furoNaLinha?: boolean;
  };
  condicoesAplicacao: {
    temperaturaAmbiente?: ValorComUnidade;
    tempPontoOrvalho?: ValorComUnidade;
    temperaturaSuperficie?: ValorComUnidade;
    umidadeRelativa?: ValorComUnidade;
    rugosidadeSuperficie?: ValorComUnidade;
  };
  resumoAtividades?: string;
  materiaisUtilizados: MaterialUtilizadoItem[];
  fotos: {
    antesPresente: boolean;
    depoisPresente: boolean;
    pfpPresente: boolean;
  };
  extracao: ExtracaoInfo;
  /** Posição de cada campo no PDF de origem, quando disponível — ver CampoPosicao. Chaves internas de extração (ex. "materialLinha", "tipoReparo"), não os rótulos exibidos na comparação. */
  posicoesCampos?: Record<string, CampoPosicao>;
  /** Caixa envolvente (uma por página, quando o bloco cruza página) de campos de BLOCO de texto livre (ex. "resumoAtividades", "materiaisUtilizados") — usada pra marcar a área inteira na visualização, em vez de um trecho específico. Ver mapaDeAreas em posicao.ts. */
  posicoesAreas?: Record<string, CampoPosicao[]>;
}

export interface MemorialData {
  meta: {
    operator?: string;
    location?: string;
    equipmentLineId?: string;
    engineeringId?: string; // Repair Reference / Engineering ID
    projectId?: string;
  };
  repairSpec: {
    lineIdentity?: string;
    lineDiameter?: ValorComUnidade;
    lineOriginalWallThickness?: ValorComUnidade;
    repairDesignPressure?: ValorComUnidade;
    repairDesignTemperature?: ValorComUnidade;
    repairConditions?: string;
    surfaceApplicationTemperature?: ValorComUnidade;
    repairSystem?: string; // ex: "FCR-BC-HT"
    repairThicknessLayers?: number;
    requiredOverlap?: ValorComUnidade;
    requiredTaperPerPly?: ValorComUnidade;
    customerSpecifiedRepairLength?: ValorComUnidade;
    // Parte "Required" (não "Requested") da linha "Min. Req. Length:" do
    // quadro "Design Basis Summary" — ex. em "540 mm Required | 12000 mm
    // Requested", este campo guarda os 540mm. É o mínimo que o CÁLCULO (ISO
    // 24817) de fato exige; "Requested"/"customerSpecifiedRepairLength" é só
    // o comprimento pedido/especificado pelo cliente, que pode (e
    // costuma) ser maior que o mínimo sem isso ser um problema. Ver
    // checagem "Comprimento aplicado vs. exigido" em compare.ts.
    minimumRequiredRepairLength?: ValorComUnidade;
  };
  systemDetails: {
    lineContents?: string;
    lineMaterial?: string;
    designPressure?: ValorComUnidade;
    maxDesignTemperature?: ValorComUnidade;
    operatingPressure?: ValorComUnidade;
    maxOperatingTemperature?: ValorComUnidade;
  };
  defectDetails: {
    axialDefectLength?: ValorComUnidade;
    lengthRequestedRequired?: ValorComUnidade;
    availableRequiredOverlapPastDefect?: ValorComUnidade;
    // "Defect Type:" em INPUTS - DEFECT DETAILS — ex. "Perforation/Leak"
    // (defeito passante = furo) vs. outros tipos (ex. "External Damage")
    // sem furo. Fonte principal da checagem "Furo na linha".
    defectType?: string;
    // Conteúdo da linha "Type B Basis:" no quadro "Design Basis Summary" (1a
    // página) — vem preenchido com um método + números de equação (ex.
    // "Circumferential Slot 13, 14") quando o cálculo exige um Design Type B
    // (defeito passante/vazamento, ISO 24817 7.5.7); vem vazio quando o
    // defeito é só estrutural. Usado como reforço/fallback de "defectType".
    typeBBasisConteudo?: string;
  };
  layerCountOverview: {
    straightLayers?: number;
    elbowLayers?: number;
  };
  installationConditions: {
    minInstallSurfaceTemperature?: ValorComUnidade;
    maxInstallSurfaceTemperature?: ValorComUnidade;
    humidityLimitPct?: number;
  };
  extracao: ExtracaoInfo;
  /** Posição de cada campo no PDF de origem — ver CampoPosicao e o campo equivalente em RdeData. */
  posicoesCampos?: Record<string, CampoPosicao>;
}

export type StatusChecagem =
  | "Consistente"
  | "Ponto de Atenção"
  | "Inconsistência"
  | "Não Verificável";

export interface ComparisonCheck {
  id: string;
  categoria: string;
  descricao: string;
  valorRde: string;
  valorMemorial: string;
  // Rótulos das duas colunas na UI. Por padrão "RDE"/"Memorial" — mas
  // algumas checagens comparam dois campos que vêm AMBOS do RDE (ex.:
  // resina citada nos materiais utilizados vs. checkbox de tipo do reparo).
  // Nesses casos o rótulo genérico "Memorial" seria enganoso, então a
  // checagem informa rótulos mais específicos.
  rotuloRde?: string;
  rotuloMemorial?: string;
  status: StatusChecagem;
  explicacao: string;
}

export interface ComparisonResult {
  checks: ComparisonCheck[];
  resumo: Record<StatusChecagem, number>;
}
