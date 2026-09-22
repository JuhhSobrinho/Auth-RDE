// Rótulos conhecidos do template de RDE "Reparo por Compósito" (TISI/TEAM).
// Baseado nos exemplares observados: RDE achatado em imagem, RDE editado no
// Acrobat (AcroForm) e RDE gerado via Word → PDF. Ajustar aqui quando o
// template mudar — é o único lugar que deveria precisar mudar.

export const RDE_TIPO_REPARO_OPCOES = [
  "TFCR ST-QE",
  "TFCR HT-QE",
  "TFCR UT-QE",
  "TFCR ST-QC",
  "TFCR HT-QC",
  "TFCR UT-QC",
  "TFCR ST-BC",
  "TFCR HT-BC",
  "TFCR UT-BC",
];

export const RDE_PFP_OPCOES = ["JOTACHAR JF750 XT", "JOTACHAR JF750", "FIRETEX - M90/2", "CHARTEK 7E", "CONTRAFLEX PFP"];

// Rótulos de geometria como aparecem no TEXTO (fallback), com pontuação/acento.
export const RDE_GEOMETRIA_OPCOES_TEXTO = [
  "FLANGE",
  "VÁLVULA",
  "T. RETO",
  "CURVA 45°",
  "CURVA 90°",
  "TEE",
  "REDUÇÃO",
  "TANQUE",
  "OUTROS",
];

// Nomes dos campos de checkbox de geometria no AcroForm (observado no PDF editado no Acrobat).
export const RDE_GEOMETRIA_CAMPOS_ACROFORM: Record<string, string> = {
  FLANGE: "FLANGE",
  "VÁLVULA": "VÁLVULA",
  "T. RETO": "T RETO",
  "CURVA 45°": "CURVA 45",
  "CURVA 90°": "CURVA 90",
  TEE: "TEE",
  "REDUÇÃO": "REDUÇÃO",
  TANQUE: "TANQUE",
  OUTROS: "OUTROS",
};

export const RDE_LABELS = {
  cliente: "Cliente:",
  local: "Local:",
  osTeam: "OS Team:",
  data: "Data:",
  emitidoPor: "Emitido por:",
  revisadoPor: "Revisado por:",
  diametroLinha: "Diâmetro da Linha:",
  tagLinha: "TAG da Linha:",
  materialLinha: "Material Fab, da LInha:",
  conteudoLinha: "Conteúdo da Linha:",
  pressaoProjeto: "Pressão de Projeto:",
  temperaturaProjeto: "Temperatura de Projeto:",
  pressaoOperacao: "Pressão de Operação:",
  temperaturaOperacao: "Temperatura de Operação:",
  comprimentoReparo: "Comprimento Reparo:",
  numeroCamadas: "Número de Camadas:",
  espessuraRep: "Espessura Rep.:",
  comprimentoPfp: "Comprimento PFP aplicado:",
  espessuraPfp: "Espessura PFP aplicada:",
  kitsResimac101: "Qtd. Kits RESIMAC 101:",
  kitsResimac114: "Qtd. Kits RESIMAC 114:",
  furoNaLinha: "Furo na Linha:",
  numeroOm: "Número OM / WO (cliente):",
  temperaturaAmbiente: "Temperatura Ambiente:",
  pontoOrvalho: "Temp. Ponto de Orvalho:",
  temperaturaSuperficie: "Temperatura Superfície:",
  umidadeRelativa: "Umidade Relativa:",
  rugosidadeSuperficie: "Rugosidade Superfície:",
} as const;

// Rótulos que existem no template (cabeçalhos de seção, texto estático de
// rodapé, cabeçalhos de tabela) mas não mapeiam pra nenhum campo do RdeData —
// entram só como "marcador de fronteira" pro parser posicional
// (extrairPorRotulos) saber onde o valor do campo anterior termina. Sem isso,
// um campo como "OS Team:" ou "Rugosidade Superfície:" engole o resto da
// página inteira (checkboxes, resumo, rodapé) como se fosse seu próprio
// valor — mesmo bug já visto e corrigido no memorial (ver MEM_ROTULOS_FRONTEIRA).
const RDE_ROTULOS_FRONTEIRA = [
  "Tipo do Reparo",
  "Geometria do Reparo",
  "Dados de Projeto",
  "Condições de Aplicação",
  "Resumo das Atividades",
  "Fotos da Execução",
  "Materiais Utilizados",
  "Antes da Execução do Serviço",
  "Após Execução do Serviço",
  "Após Aplicação de PPCI",
  "Anotações gerais",
  "Item Qtd. Descrição (Resina; F.Vidro; F.Carbono; etc)",
  "Item Qtd. Descrição (Fita; Peel Ply; Thinner; etc)",
  "Representante Team",
  "Representante Cliente",
  "Relatório de Execução de Serviço Reparo",
  "por Compósito",
  "TISI do Brasil - Serviços Industriais Ltda.",
  "Pág.",
];

export const RDE_TODOS_ROTULOS_TEXTO = [...new Set([...Object.values(RDE_LABELS), ...RDE_ROTULOS_FRONTEIRA])];
