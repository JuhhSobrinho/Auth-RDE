import type { RdeData, CampoPosicao } from "../../types";
import { parseValorComUnidade } from "../units";
import type { CampoAcroForm } from "./acroform";
import { campoTexto, campoMarcado, campoRetangulo } from "./acroform";
import type { PdfExtractedText } from "./pdfText";
import { extrairPorRotulos, extrairGrupoCheckbox, extrairFuroNaLinha } from "./labelParser";
import type { Intervalo } from "./labelParser";
import { mapaDePosicoes, mapaDeAreas } from "./posicao";
import {
  RDE_LABELS,
  RDE_TODOS_ROTULOS_TEXTO,
  RDE_TIPO_REPARO_OPCOES,
  RDE_PFP_OPCOES,
  RDE_GEOMETRIA_OPCOES_TEXTO,
  RDE_GEOMETRIA_CAMPOS_ACROFORM,
} from "./rdeLabels";
import type { ImagemDetectada } from "./images";
import { contarFotosCandidatas } from "./images";
import { extrairMateriaisUtilizados, itensDeKitsResina } from "./materiais";

// Nomes de campo observados no AcroForm de RDEs editados no Acrobat.
// Nem todo RDE terá esses nomes exatos — por isso o texto é sempre usado
// como complemento pra qualquer campo ausente/vazio no AcroForm.
const ACROFORM_MAP = {
  cliente: "Cliente",
  local: "Local",
  osTeam: "OS Team",
  data: "Data",
  emitidoPor: "Emissor",
  revisadoPor: "Revisor",
  diametroLinha: "Diâmetro Equipamento",
  tagLinha: "TAG Equipamento",
  materialLinha: "Material Equipamento",
  conteudoLinha: "Fluído Operação",
  pressaoProjeto: "Pressão de Projeto",
  temperaturaProjeto: "Temperatura de Projeto",
  pressaoOperacao: "Pressão de Operação",
  temperaturaOperacao: "Temperatura de Operação",
  comprimentoReparo: "Comprimento Reparo",
  numeroCamadas: "Número de Camadas",
  comprimentoPfp: "Comprimento PFP aplicado",
  kitsResimac101: "Qtd Kits RESIMAC 101",
  kitsResimac114: "Qtd Kits RESIMAC 114",
  temperaturaAmbiente: "Temperatura Ambiente",
  pontoOrvalho: "Temp Ponto de Orvalho",
  temperaturaSuperficie: "Temperatura Superfície",
  umidadeRelativa: "Umidade Relativa",
  rugosidadeSuperficie: "Rugosidade Superfície",
  espessuraRep: "Espessura",
  numeroRde: "N.RDE",
  resumoAtividades: "Resumo das AtividadesRow1",
  // Observado no PDF de teste: o campo que guarda a espessura de PFP está com
  // nome de origem trocado no template ("SS Cliente" em vez de algo como
  // "Espessura PFP aplicada") — mantido aqui até o form ser corrigido no Acrobat.
  espessuraPfp: "SS Cliente",
} as const;

function primeiroValido(...valores: (string | undefined)[]): string | undefined {
  for (const v of valores) {
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function parseRde(
  acroFields: CampoAcroForm[],
  textoExtraido: PdfExtractedText | null,
  imagens: ImagemDetectada[]
): RdeData {
  const avisos: string[] = [];
  const temAcroForm = acroFields.length > 0;
  const fullText = textoExtraido?.fullText ?? "";
  const temTexto = fullText.trim().length > 0;

  let porRotulo: { valores: Record<string, string>; intervalos: Record<string, Intervalo> } = { valores: {}, intervalos: {} };
  if (temTexto) {
    porRotulo = extrairPorRotulos(fullText, RDE_TODOS_ROTULOS_TEXTO);
  }

  // Posição (no PDF) de cada campo, indexada pela MESMA chave usada em
  // ACROFORM_MAP (ou por um nome descritivo pros campos que não vêm de
  // `get()`, ex. checkboxes) — consumida por `mapaDePosicoes` no final pra
  // montar `posicoesCampos` (ver PdfOverlayViewer, ainda não implementado).
  const intervalosCampos: Record<string, Intervalo> = {};
  // Intervalos separados pra campos de BLOCO (várias linhas) que precisam de
  // uma caixa envolvente inteira na visualização, não só a 1a linha — ver
  // `mapaDeAreas` (posicao.ts) e o comentário perto de `posicoesAreas` no
  // retorno desta função.
  const intervalosAreas: Record<string, Intervalo> = {};

  const get = (chaveAcroform: keyof typeof ACROFORM_MAP, labelTexto: string): string | undefined => {
    const viaForm = temAcroForm ? campoTexto(acroFields, ACROFORM_MAP[chaveAcroform]) : undefined;
    const viaTexto = porRotulo.valores[labelTexto];
    if (porRotulo.intervalos[labelTexto]) {
      intervalosCampos[chaveAcroform] = porRotulo.intervalos[labelTexto];
    }
    return primeiroValido(viaForm, viaTexto);
  };

  let metodo: RdeData["extracao"]["metodo"] = "nenhum";
  if (temAcroForm) metodo = "acroform";
  else if (temTexto) metodo = "text-layout";
  else avisos.push("PDF sem texto ou formulário extraível — provavelmente uma página achatada em imagem. Revisão manual necessária.");

  // Tipo do reparo / geometria: sempre via texto quando disponível, porque no
  // AcroForm observado esses checkboxes usam nomes de campo genéricos
  // ("undefined_8") pro grupo Tipo do Reparo — só Geometria tem nomes usáveis.
  let sistemaMarcado: string | undefined;
  let pfpMarcados: string[] = [];
  let geometriaMarcadas: string[] = [];

  if (temTexto) {
    const tipos = extrairGrupoCheckbox(fullText, RDE_TIPO_REPARO_OPCOES);
    sistemaMarcado = tipos.marcadas[0];
    if (tipos.marcadas.length > 1) avisos.push(`Mais de um "Tipo do Reparo" aparenta estar marcado: ${tipos.marcadas.join(", ")}.`);
    if (sistemaMarcado && tipos.intervalos[sistemaMarcado]) intervalosCampos.tipoReparo = tipos.intervalos[sistemaMarcado];

    const pfp = extrairGrupoCheckbox(fullText, RDE_PFP_OPCOES);
    pfpMarcados = pfp.marcadas;
    if (pfpMarcados[0] && pfp.intervalos[pfpMarcados[0]]) intervalosCampos.pfpMarcados = pfp.intervalos[pfpMarcados[0]];

    const geometria = extrairGrupoCheckbox(fullText, RDE_GEOMETRIA_OPCOES_TEXTO);
    geometriaMarcadas = geometria.marcadas;
    if (geometriaMarcadas[0] && geometria.intervalos[geometriaMarcadas[0]]) {
      intervalosCampos.geometria = geometria.intervalos[geometriaMarcadas[0]];
    }
  }
  if (!sistemaMarcado && temAcroForm) {
    // Em PDFs de AcroForm, os checkboxes de "Tipo do Reparo" e PFP costumam ter
    // nomes de campo genéricos (ex. "undefined_8") no template observado — ao
    // contrário de "Geometria do Reparo", que tem nomes usáveis. Sem nome
    // confiável nem marca visível no texto (o valor do checkbox não aparece no
    // conteúdo textual de um AcroForm), não dá pra identificar com segurança
    // qual opção está marcada. Recomenda-se renomear esses campos no Acrobat.
    avisos.push(
      'Não foi possível identificar com segurança o "Tipo do Reparo" marcado neste PDF de AcroForm — os campos de checkbox dessa seção não têm nomes reconhecíveis. Recomenda-se renomear os campos no Acrobat (a exemplo do que já foi feito na seção "Geometria do Reparo").'
    );
  }
  if (geometriaMarcadas.length === 0 && temAcroForm) {
    for (const [label, campoNome] of Object.entries(RDE_GEOMETRIA_CAMPOS_ACROFORM)) {
      if (campoMarcado(acroFields, campoNome)) geometriaMarcadas.push(label);
    }
  }

  let furoNaLinha: boolean | undefined;
  if (temTexto) {
    const r = extrairFuroNaLinha(fullText);
    if (r !== null) furoNaLinha = r;
  }
  if (furoNaLinha === undefined && temAcroForm) {
    if (campoTexto(acroFields, "Furo na Linha-não")) furoNaLinha = false;
    else if (campoTexto(acroFields, "Furo na Linha-sim")) furoNaLinha = true;
  }

  const resumoMatch = temTexto ? fullText.match(/Resumo das Atividades([\s\S]*?)(?:Fotos da Execução|$)/i) : null;
  const resumoAtividades = primeiroValido(campoTexto(acroFields, ACROFORM_MAP.resumoAtividades), resumoMatch?.[1]);
  // Posição do bloco "Resumo das Atividades": prioriza o retângulo do
  // próprio widget de AcroForm quando existe — o texto DIGITADO no campo de
  // formulário normalmente não sai na mesma posição na camada de texto do
  // `getTextContent` (só o rótulo estático "Resumo das Atividades" aparece
  // lá, colado direto no próximo rótulo "Fotos da Execução", sem o conteúdo
  // no meio) — então basear a caixa no texto reconstruído aqui marcaria só
  // os dois RÓTULOS, não a área real onde o resumo foi escrito. Sem
  // AcroForm (PDF puro texto), cai pro intervalo via regex, que aí sim tem
  // o conteúdo de verdade entre os dois rótulos.
  const areasDiretas: Record<string, CampoPosicao[]> = {};
  const resumoRetangulo = campoRetangulo(acroFields, ACROFORM_MAP.resumoAtividades);
  if (resumoRetangulo) {
    areasDiretas.resumoAtividades = [
      { pagina: resumoRetangulo.pagina, x: resumoRetangulo.x, y: resumoRetangulo.y, largura: resumoRetangulo.largura, altura: resumoRetangulo.altura },
    ];
  } else if (resumoMatch && resumoMatch.index !== undefined) {
    intervalosAreas.resumoAtividades = { inicio: resumoMatch.index, fim: resumoMatch.index + resumoMatch[0].length };
  }
  const refMatch = (resumoAtividades ?? fullText).match(/Ref\s*Engenharia\s*:\s*([\w./-]+)/i);
  const plaquetaMatch = (resumoAtividades ?? fullText).match(/Plaqueta\s*:\s*([\w./-]+)/i);

  const kitsResina = itensDeKitsResina({
    resimac101: get("kitsResimac101", RDE_LABELS.kitsResimac101),
    resimac114: get("kitsResimac114", RDE_LABELS.kitsResimac114),
  });
  const materiaisExtraidos = temTexto ? extrairMateriaisUtilizados(fullText) : { itens: [] };
  if (materiaisExtraidos.intervalo) intervalosAreas.materiaisUtilizados = materiaisExtraidos.intervalo;
  const materiaisUtilizados = [...kitsResina, ...materiaisExtraidos.itens];
  if (temTexto && materiaisUtilizados.length === 0) {
    avisos.push(
      'Não foi possível identificar itens na tabela "Materiais Utilizados" — pode estar em branco no RDE ou em um formato que o parser ainda não reconhece. Confirmar manualmente.'
    );
  }

  const fotosCandidatas = contarFotosCandidatas(imagens, 1);
  // heurística: sem posição exata, assume que "antes"/"depois" são preenchidos
  // antes de "PFP" — ver docs/regras-de-comparacao.md, seção G.
  const fotos = {
    antesPresente: fotosCandidatas >= 1,
    depoisPresente: fotosCandidatas >= 2,
    pfpPresente: fotosCandidatas >= 3,
  };
  if (fotosCandidatas > 0 && fotosCandidatas < 3) {
    avisos.push(
      `Detectadas ${fotosCandidatas} foto(s) grande(s) na página 1 (esperado até 3: antes/depois/PFP). A checagem de qual slot está vazio é aproximada — confirmar visualmente.`
    );
  }

  return {
    meta: {
      cliente: get("cliente", RDE_LABELS.cliente),
      local: get("local", RDE_LABELS.local),
      osTeam: get("osTeam", RDE_LABELS.osTeam),
      refEngenharia: refMatch?.[1],
      plaqueta: plaquetaMatch?.[1],
      dataEmissao: get("data", RDE_LABELS.data),
      emitidoPor: get("emitidoPor", RDE_LABELS.emitidoPor),
      revisadoPor: get("revisadoPor", RDE_LABELS.revisadoPor),
    },
    tipoReparo: {
      sistemaMarcado,
      pfpMarcados,
    },
    geometria: {
      marcadas: geometriaMarcadas,
    },
    dadosProjeto: {
      diametroLinha: parseValorComUnidade(get("diametroLinha", RDE_LABELS.diametroLinha)),
      tagLinha: get("tagLinha", RDE_LABELS.tagLinha),
      materialLinha: get("materialLinha", RDE_LABELS.materialLinha),
      conteudoLinha: get("conteudoLinha", RDE_LABELS.conteudoLinha),
      pressaoProjeto: parseValorComUnidade(get("pressaoProjeto", RDE_LABELS.pressaoProjeto)),
      temperaturaProjeto: parseValorComUnidade(get("temperaturaProjeto", RDE_LABELS.temperaturaProjeto)),
      pressaoOperacao: parseValorComUnidade(get("pressaoOperacao", RDE_LABELS.pressaoOperacao)),
      temperaturaOperacao: parseValorComUnidade(get("temperaturaOperacao", RDE_LABELS.temperaturaOperacao)),
      comprimentoReparo: parseValorComUnidade(get("comprimentoReparo", RDE_LABELS.comprimentoReparo)),
      numeroCamadas: (() => {
        const raw = get("numeroCamadas", RDE_LABELS.numeroCamadas);
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        return Number.isNaN(n) ? undefined : n;
      })(),
      espessuraRep: parseValorComUnidade(get("espessuraRep", RDE_LABELS.espessuraRep)),
      comprimentoPfpAplicado: parseValorComUnidade(get("comprimentoPfp", RDE_LABELS.comprimentoPfp)),
      espessuraPfpAplicada: parseValorComUnidade(get("espessuraPfp", RDE_LABELS.espessuraPfp)),
      furoNaLinha,
    },
    condicoesAplicacao: {
      temperaturaAmbiente: parseValorComUnidade(get("temperaturaAmbiente", RDE_LABELS.temperaturaAmbiente)),
      tempPontoOrvalho: parseValorComUnidade(get("pontoOrvalho", RDE_LABELS.pontoOrvalho)),
      temperaturaSuperficie: parseValorComUnidade(get("temperaturaSuperficie", RDE_LABELS.temperaturaSuperficie)),
      umidadeRelativa: parseValorComUnidade(get("umidadeRelativa", RDE_LABELS.umidadeRelativa)),
      rugosidadeSuperficie: parseValorComUnidade(get("rugosidadeSuperficie", RDE_LABELS.rugosidadeSuperficie)),
    },
    resumoAtividades: resumoAtividades?.trim(),
    materiaisUtilizados,
    fotos,
    extracao: { metodo, avisos },
    posicoesCampos: mapaDePosicoes(textoExtraido?.linhas ?? [], intervalosCampos),
    // Áreas de bloco (caixa envolvente de várias linhas) pros campos de texto
    // livre "Resumo das Atividades" e "Materiais Utilizados" — usadas pra
    // marcar a caixa inteira na visualização (cor agregada entre as
    // checagens associadas), ver overlayMapping.ts/PdfOverlayViewer.tsx.
    posicoesAreas: { ...mapaDeAreas(textoExtraido?.linhas ?? [], intervalosAreas), ...areasDiretas },
  };
}
