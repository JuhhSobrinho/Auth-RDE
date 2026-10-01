import type { ComparisonCheck, ComparisonResult, MemorialData, RdeData, StatusChecagem } from "../../types";
import { dentroDaTolerancia, npsParaOdMm, paraBar, paraMm, primeiraLinha } from "../units";
import { RDE_PFP_OPCOES } from "../extraction/rdeLabels";

// Aspas/indicador de polegada em qualquer variante (reta, tipográfica, prime)
// — cobre o caso comum de um documento salvar `2"-FG-...` e o outro
// `2”-FG-...` (aspas curvas do Word) pra descrever a mesma linha. Removida
// junto com qualquer espaço colado nela (a reconstrução de texto do PDF às
// vezes deixa um espaço espúrio bem antes do caractere de aspas).
const RE_ASPAS = /\s*["'`´‘’‚‛“”„‟′″]\s*/g;

function normalizarTexto(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(RE_ASPAS, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function iguais(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return normalizarTexto(a) === normalizarTexto(b);
}

// --- Equivalências semânticas (mesma coisa, grafia/formato diferente) ---

// Material da linha: RDE costuma vir em português, memorial em inglês.
// Dicionário pequeno e explícito — um termo que não está aqui simplesmente
// cai na comparação exata (normalizada), não é tratado como equivalente por
// omissão.
const MATERIAIS_EQUIVALENTES: Record<string, string> = {
  "ACO CARBONO": "CARBON_STEEL",
  "CARBON STEEL": "CARBON_STEEL",
  "ACO INOX": "STAINLESS_STEEL",
  "ACO INOXIDAVEL": "STAINLESS_STEEL",
  "STAINLESS STEEL": "STAINLESS_STEEL",
  "FERRO FUNDIDO": "CAST_IRON",
  "CAST IRON": "CAST_IRON",
  "ACO LIGA": "ALLOY_STEEL",
  "ALLOY STEEL": "ALLOY_STEEL",
  "ACO GALVANIZADO": "GALVANIZED_STEEL",
  "GALVANIZED STEEL": "GALVANIZED_STEEL",
  COBRE: "COPPER",
  COPPER: "COPPER",
  "FIBRA DE VIDRO": "GRP",
  FIBERGLASS: "GRP",
  GRP: "GRP",
  ALUMINIO: "ALUMINUM",
  ALUMINUM: "ALUMINUM",
  ALUMINIUM: "ALUMINUM",
};

function materiaisEquivalentes(a: string, b: string): boolean {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  const ca = MATERIAIS_EQUIVALENTES[na];
  const cb = MATERIAIS_EQUIVALENTES[nb];
  return ca !== undefined && ca === cb;
}

// Conteúdo da linha: mesmo padrão do material — RDE em português, memorial em
// inglês. Termo fora do dicionário cai na comparação exata (normalizada).
const CONTEUDOS_EQUIVALENTES: Record<string, string> = {
  "GAS COMBUSTIVEL": "FUEL_GAS",
  "FUEL GAS": "FUEL_GAS",
  "GAS NATURAL": "NATURAL_GAS",
  "NATURAL GAS": "NATURAL_GAS",
  "GAS DE PROCESSO": "PROCESS_GAS",
  "PROCESS GAS": "PROCESS_GAS",
  "GAS ACIDO": "SOUR_GAS",
  "SOUR GAS": "SOUR_GAS",
  "OLEO CRU": "CRUDE_OIL",
  "CRUDE OIL": "CRUDE_OIL",
  OLEO: "OIL",
  OIL: "OIL",
  AGUA: "WATER",
  WATER: "WATER",
  "AGUA PRODUZIDA": "PRODUCED_WATER",
  "PRODUCED WATER": "PRODUCED_WATER",
  HIDROCARBONETO: "HYDROCARBON",
  HIDROCARBONETOS: "HYDROCARBON",
  HYDROCARBON: "HYDROCARBON",
  HYDROCARBONS: "HYDROCARBON",
  GLP: "LPG",
  LPG: "LPG",
  CONDENSADO: "CONDENSATE",
  CONDENSATE: "CONDENSATE",
  VAPOR: "STEAM",
  STEAM: "STEAM",
  "AR COMPRIMIDO": "COMPRESSED_AIR",
  "COMPRESSED AIR": "COMPRESSED_AIR",
  NITROGENIO: "NITROGEN",
  NITROGEN: "NITROGEN",
};

function conteudosEquivalentes(a: string, b: string): boolean {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  const ca = CONTEUDOS_EQUIVALENTES[na];
  const cb = CONTEUDOS_EQUIVALENTES[nb];
  return ca !== undefined && ca === cb;
}

// Sistema/material do reparo: o RDE marca um checkbox tipo "TFCR HT-BC"
// (prefixo do template + cura + fibra) e o memorial descreve o mesmo sistema
// como "FCR-BC-HT" (fibra + cura, sem o prefixo "T"). Prefixo e ordem mudam,
// os códigos que importam (cura: ST/HT/UT; fibra: QE/QC/BC) são os mesmos —
// comparar como conjunto em vez de string exata.
const CODIGOS_SISTEMA_REPARO = ["ST", "HT", "UT", "QE", "QC", "BC"];

function codigosSistemaReparo(s: string): Set<string> {
  const norm = normalizarTexto(s);
  const encontrados = new Set<string>();
  for (const codigo of CODIGOS_SISTEMA_REPARO) {
    if (new RegExp(`\\b${codigo}\\b`).test(norm)) encontrados.add(codigo);
  }
  return encontrados;
}

function sistemasReparoEquivalentes(a: string, b: string): boolean {
  const codigosA = codigosSistemaReparo(a);
  const codigosB = codigosSistemaReparo(b);
  if (codigosA.size === 0 || codigosB.size !== codigosA.size) return false;
  for (const c of codigosA) if (!codigosB.has(c)) return false;
  return true;
}

// Código de CURA da resina (ST/HT/UT — ver CODIGOS_SISTEMA_REPARO acima),
// isolado dos códigos de fibra (QE/QC/BC): usado pra checar a lista de
// "Materiais Utilizados" contra o "Tipo do Reparo" marcado — às vezes a
// descrição de um item da lista menciona a resina por código de cura (ex.
// "RESINA HT") e isso diverge do que foi marcado (ex. "TFCR ST-BC").
const CODIGOS_CURA = new Set(["ST", "HT", "UT"]);

function codigosCuraEmTexto(s: string | undefined): Set<string> {
  if (!s) return new Set();
  const codigos = codigosSistemaReparo(s);
  return new Set([...codigos].filter((c) => CODIGOS_CURA.has(c)));
}

// PFPs citados pelo NOME no resumo das atividades (texto livre). O resumo
// frequentemente cita produto de PFP aplicado — quando cita um nome
// específico, dá pra conferir contra o que foi marcado na seção "Tipo do
// Reparo"; quando só menciona "PFP"/"PPCI" de forma genérica (sem nome de
// produto), não tem o que comparar (ver comparar()).
function pfpsCitadosNoResumo(resumo: string | undefined): string[] {
  if (!resumo) return [];
  const normalizado = normalizarTexto(resumo);
  // Nomes mais longos primeiro e removidos do texto ao serem encontrados,
  // pra "JOTACHAR JF750" (mais curto) não ser contado de novo dentro de
  // "JOTACHAR JF750 XT" (mais longo) já encontrado.
  const ordenadas = [...RDE_PFP_OPCOES].sort((a, b) => b.length - a.length);
  const encontrados: string[] = [];
  let restante = normalizado;
  for (const opcao of ordenadas) {
    const opcaoNormalizada = normalizarTexto(opcao);
    if (restante.includes(opcaoNormalizada)) {
      encontrados.push(opcao);
      restante = restante.replace(opcaoNormalizada, "");
    }
  }
  return encontrados;
}

let contador = 0;
function check(
  categoria: string,
  descricao: string,
  valorRde: string | undefined,
  valorMemorial: string | undefined,
  status: StatusChecagem,
  explicacao: string,
  rotulos?: { rde?: string; memorial?: string }
): ComparisonCheck {
  contador += 1;
  return {
    id: `chk-${contador}`,
    categoria,
    descricao,
    valorRde: primeiraLinha(valorRde) ?? "—",
    valorMemorial: primeiraLinha(valorMemorial) ?? "—",
    rotuloRde: rotulos?.rde,
    rotuloMemorial: rotulos?.memorial,
    status,
    explicacao,
  };
}

/** Regra padrão: se falta dado de um dos lados -> Não Verificável; senão compara. */
function checarIgualdade(
  categoria: string,
  descricao: string,
  valorRde: string | undefined,
  valorMemorial: string | undefined,
  opts: { severidadeDivergencia?: StatusChecagem; equivalente?: (a: string, b: string) => boolean } = {}
): ComparisonCheck {
  // Compara só a PRIMEIRA LINHA de cada valor — a extração por rótulo às
  // vezes "vazapara" o texto seguinte na mesma célula/coluna do PDF (ex.
  // memorial: campo "Conteúdo da linha" vem como
  // "Fuel Gas\nProduced water and hydrocarbons, flammable" quando o valor
  // real é só "Fuel Gas"). Comparar a string inteira faz esse vazamento
  // quebrar tanto a igualdade exata (`iguais`) quanto os dicionários de
  // equivalência (que exigem bater a CHAVE EXATA, ex. "FUEL GAS" —
  // "FUEL GAS\n..." não bate). Como a exibição pro usuário já mostra só
  // `primeiraLinha()` (ver `check()`), comparar com a mesma primeira linha
  // mantém a checagem consistente com o que ele realmente vê na tela.
  const rdeCmp = primeiraLinha(valorRde);
  const memCmp = primeiraLinha(valorMemorial);
  if (!rdeCmp || !memCmp) {
    return check(categoria, descricao, valorRde, valorMemorial, "Não Verificável", "Dado ausente em um dos dois documentos — não dá pra comparar.");
  }
  if (iguais(rdeCmp, memCmp)) {
    return check(categoria, descricao, valorRde, valorMemorial, "Consistente", "Valores batem.");
  }
  if (opts.equivalente?.(rdeCmp, memCmp)) {
    return check(
      categoria,
      descricao,
      valorRde,
      valorMemorial,
      "Consistente",
      "Grafias/formatos diferentes, mas representam o mesmo valor."
    );
  }
  return check(
    categoria,
    descricao,
    valorRde,
    valorMemorial,
    opts.severidadeDivergencia ?? "Inconsistência",
    "Valores divergem entre RDE e memorial."
  );
}

function checarNumerico(
  categoria: string,
  descricao: string,
  rde: { display?: string; valor: number | null },
  mem: { display?: string; valor: number | null },
  opts: { abs?: number; pct?: number } = {}
): ComparisonCheck {
  if (rde.valor === null || mem.valor === null) {
    return check(categoria, descricao, rde.display, mem.display, "Não Verificável", "Dado ausente ou não numérico em um dos dois documentos.");
  }
  if (dentroDaTolerancia(rde.valor, mem.valor, opts)) {
    return check(categoria, descricao, rde.display, mem.display, "Consistente", "Valores batem dentro da tolerância.");
  }
  return check(categoria, descricao, rde.display, mem.display, "Inconsistência", "Valores divergem além da tolerância aceitável.");
}

export function comparar(rde: RdeData, memorial: MemorialData): ComparisonResult {
  contador = 0;
  const checks: ComparisonCheck[] = [];

  // --- A. Identificação e rastreabilidade ---
  checks.push(checarIgualdade("Identificação", "Cliente / Operador", rde.meta.cliente, memorial.meta.operator));
  checks.push(checarIgualdade("Identificação", "Local", rde.meta.local, memorial.meta.location));
  {
    // Duas fontes possíveis pro mesmo dado no memorial ("Line Identity:" na
    // Composite Repair Specification e "Equipment / Line ID:" na Composite
    // Design Assessment) — usa a mais COMPLETA (mais longa) das duas, porque
    // já observamos um bug real de extração em que o texto reconstruído em
    // ordem de leitura deixa o rótulo "Line Identity:" fisicamente ENTRE duas
    // linhas do seu próprio valor (quando ele quebra linha na tabela), e só a
    // parte DEPOIS do rótulo acaba capturada — cortando o início fora (ex.
    // virou só "FW-A-632" em vez de "3"-FW-A-1230; 3"-FW-A-658; 3"FW-A-627 &
    // 3"-FW-A-632"). Esse bug pode acontecer em qualquer um dos dois campos;
    // pegar o mais longo é a defesa mais simples sem depender de saber qual
    // dos dois está truncado.
    const candidatos = [memorial.repairSpec.lineIdentity, memorial.meta.equipmentLineId].filter((s): s is string =>
      Boolean(s && s.trim())
    );
    const memTagOriginal = candidatos.sort((a, b) => b.length - a.length)[0];
    const c = checarIgualdade("Identificação", "TAG da linha / Line Identity", rde.dadosProjeto.tagLinha, memTagOriginal);
    // Em campanhas com vários pontos de reparo na mesma linha, o RDE às
    // vezes anota o número do ponto junto da TAG — ex. "2"-PC-B9-0537 (P9)"
    // — enquanto o memorial (que é por linha, não por ponto) traz só
    // "2"-PC-B9-0537". Isso não é uma TAG errada, então não deveria virar
    // Inconsistência; mas também não é um match exato, então em vez de virar
    // Consistente automático, fica como Ponto de Atenção — só pra alguém
    // confirmar que o ponto citado é mesmo o do serviço executado.
    if (c.status === "Inconsistência") {
      const rdeTag = primeiraLinha(rde.dadosProjeto.tagLinha);
      const memTag = primeiraLinha(memTagOriginal);
      const rdeSemPonto = rdeTag?.replace(/\s*\(\s*P(?:T|ONTO)?\.?\s*\d+\s*\)\s*$/i, "").trim();
      const alvo = rdeSemPonto || rdeTag;
      if (rdeSemPonto && memTag && iguais(rdeSemPonto, memTag)) {
        c.status = "Ponto de Atenção";
        c.explicacao = `O RDE anota o ponto do serviço junto da TAG ("${rdeTag}") — a linha em si bate com o memorial ("${memTag}"). Confirmar apenas se o ponto citado corresponde ao serviço executado.`;
      } else if (memTag) {
        // Um mesmo memorial pode valer pra mais de uma linha ao mesmo tempo
        // (ex. um trecho/ponto comum a várias tubulações calculado junto) —
        // nesse caso "Line Identity"/"Equipment / Line ID" lista várias TAGs
        // separadas por ";", "," ou "&". Divergência aqui não é erro: basta a
        // TAG do RDE ser UMA das listadas no memorial.
        const linhasDoMemorial = memTag
          .split(/[;,&]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (linhasDoMemorial.length > 1 && alvo && linhasDoMemorial.some((l) => iguais(alvo, l))) {
          c.status = "Consistente";
          c.explicacao = `O memorial de cálculo cobre mais de uma linha ao mesmo tempo ("${memTag}") — a TAG do RDE ("${rdeTag}") é uma delas.`;
        }
      }
    }
    checks.push(c);
  }
  checks.push(checarIgualdade("Identificação", "OS Team / Project ID", rde.meta.osTeam, memorial.meta.projectId));
  checks.push(
    checarIgualdade("Identificação", "Referência de engenharia", rde.meta.refEngenharia, memorial.meta.engineeringId, {
      severidadeDivergencia: "Inconsistência",
    })
  );
  // "Emitido por" / "Revisado por" não têm um campo correspondente no
  // memorial pra comparar contra — são só presença no RDE. Mesmo assim
  // entram como checagem (não só um aviso de extração) porque são campos
  // essenciais de rastreabilidade: quem executou e quem revisou o serviço.
  checks.push(
    check(
      "Identificação",
      "Emitido por",
      rde.meta.emitidoPor,
      "—",
      rde.meta.emitidoPor ? "Consistente" : "Ponto de Atenção",
      rde.meta.emitidoPor
        ? "Campo preenchido no RDE."
        : 'Campo "Emitido por" não preenchido no RDE — essencial pra rastreabilidade de quem executou o serviço.'
    )
  );
  checks.push(
    check(
      "Identificação",
      "Revisado por",
      rde.meta.revisadoPor,
      "—",
      rde.meta.revisadoPor ? "Consistente" : "Ponto de Atenção",
      rde.meta.revisadoPor
        ? "Campo preenchido no RDE."
        : 'Campo "Revisado por" não preenchido no RDE — essencial pra rastreabilidade de quem revisou o serviço.'
    )
  );
  // Sinaliza que o "Resumo das Atividades" foi revisado — sem essa checagem
  // "de presença", a caixa do resumo na visualização só ficava colorida
  // quando havia um problema específico pra reportar (ex. PFP citado
  // divergente do marcado, ver checagem em "Sistema de reparo"), deixando o
  // caso comum de "preenchido e sem problema" indistinto de "não foi
  // conferido". Com isso, o campo entra sempre: verde quando preenchido (e
  // permanece vermelho se a checagem de PFP específica achar divergência,
  // já que a área agrega o PIOR status entre as duas — ver
  // construirMarcadoresDeArea em PdfOverlayViewer.tsx), e Ponto de Atenção
  // quando está em branco.
  checks.push(
    check(
      "Identificação",
      "Resumo das Atividades revisado",
      rde.resumoAtividades,
      "—",
      rde.resumoAtividades ? "Consistente" : "Ponto de Atenção",
      rde.resumoAtividades
        ? "Resumo das atividades preenchido — dados citados nele (PFP, referência de engenharia, plaqueta etc.) foram conferidos contra o restante do RDE."
        : 'Campo "Resumo das Atividades" não preenchido no RDE.'
    )
  );

  // --- B. Condições de projeto e operação ---
  {
    const rdeOd = npsParaOdMm(rde.dadosProjeto.diametroLinha?.valorOriginal);
    const memOd = paraMm(memorial.repairSpec.lineDiameter);
    if (rdeOd !== null && memOd !== null) {
      checks.push(
        checarNumerico(
          "Condições de projeto",
          "Diâmetro da linha (OD)",
          { display: `${rde.dadosProjeto.diametroLinha?.valorOriginal} (~${rdeOd}mm OD padrão)`, valor: rdeOd },
          { display: memorial.repairSpec.lineDiameter?.valorOriginal, valor: memOd },
          { abs: 3 }
        )
      );
    } else {
      checks.push(
        check(
          "Condições de projeto",
          "Diâmetro da linha (OD)",
          rde.dadosProjeto.diametroLinha?.valorOriginal,
          memorial.repairSpec.lineDiameter?.valorOriginal,
          "Não Verificável",
          "Não foi possível converter a bitola nominal do RDE pra OD em mm (bitola fora da tabela padrão ou dado ausente)."
        )
      );
    }
  }
  checks.push(checarIgualdade("Condições de projeto", "Material da linha", rde.dadosProjeto.materialLinha, memorial.systemDetails.lineMaterial, {
    severidadeDivergencia: "Inconsistência",
    equivalente: materiaisEquivalentes,
  }));
  checks.push(
    checarIgualdade("Condições de projeto", "Conteúdo da linha", rde.dadosProjeto.conteudoLinha, memorial.systemDetails.lineContents, {
      severidadeDivergencia: "Ponto de Atenção",
      equivalente: conteudosEquivalentes,
    })
  );
  checks.push(
    checarNumerico(
      "Condições de projeto",
      "Pressão de projeto",
      { display: rde.dadosProjeto.pressaoProjeto?.valorOriginal, valor: paraBar(rde.dadosProjeto.pressaoProjeto) },
      { display: memorial.repairSpec.repairDesignPressure?.valorOriginal, valor: paraBar(memorial.repairSpec.repairDesignPressure) },
      { abs: 0.1 }
    )
  );
  checks.push(
    checarNumerico(
      "Condições de projeto",
      "Pressão de operação",
      { display: rde.dadosProjeto.pressaoOperacao?.valorOriginal, valor: paraBar(rde.dadosProjeto.pressaoOperacao) },
      { display: memorial.systemDetails.operatingPressure?.valorOriginal, valor: paraBar(memorial.systemDetails.operatingPressure) },
      { abs: 0.1 }
    )
  );
  checks.push(
    checarNumerico(
      "Condições de projeto",
      "Temperatura de operação",
      { display: rde.dadosProjeto.temperaturaOperacao?.valorOriginal, valor: rde.dadosProjeto.temperaturaOperacao?.valor ?? null },
      {
        display: memorial.systemDetails.maxOperatingTemperature?.valorOriginal,
        valor: memorial.systemDetails.maxOperatingTemperature?.valor ?? null,
      },
      { abs: 1 }
    )
  );
  {
    const c = checarNumerico(
      "Condições de projeto",
      "Temperatura de projeto",
      { display: rde.dadosProjeto.temperaturaProjeto?.valorOriginal, valor: rde.dadosProjeto.temperaturaProjeto?.valor ?? null },
      {
        display: memorial.systemDetails.maxDesignTemperature?.valorOriginal,
        valor: memorial.systemDetails.maxDesignTemperature?.valor ?? null,
      },
      { abs: 1 }
    );
    if (c.status === "Inconsistência") {
      c.status = "Ponto de Atenção";
      c.explicacao =
        'O memorial tem duas "temperaturas de projeto" com propósitos diferentes (a do sistema/linha e a do laminado/reparo). Confirmar manualmente qual o RDE deveria refletir antes de tratar como erro.';
    }
    checks.push(c);
  }

  // Furo na linha: o RDE marca um checkbox "Furo na Linha: ( ) SIM (x) NÃO"
  // (dadosProjeto.furoNaLinha). No memorial isso aparece de duas formas: (1)
  // "Defect Type:" na seção "INPUTS - DEFECT DETAILS" — direto, ex.
  // "Perforation/Leak" = tem furo; outros tipos (dano mecânico, desgaste
  // externo etc.) = sem furo; (2) como reforço, o quadro "Design Basis
  // Summary" (1a página) sempre traz "Type A Basis: Reference Equations" —
  // mas só preenche a linha de baixo de "Type B Basis:" com um método e
  // números de equação (ex. "Circumferential Slot 13, 14") quando o cálculo
  // exige um Design Type B (ISO 24817 7.5.7 — defeito passante/vazamento); se
  // o defeito é só estrutural, essa linha fica vazia. Usamos (1) como fonte
  // principal e (2) como reforço/fallback quando (1) não é conclusivo.
  {
    const defectTypeTexto = memorial.defectDetails.defectType;
    const ehFuroPorTipo = defectTypeTexto ? /perforat|leak|through[- ]?wall|passante/i.test(defectTypeTexto) : undefined;
    const typeBConteudo = memorial.defectDetails.typeBBasisConteudo;
    const ehFuroPorTypeB = typeBConteudo ? /\d/.test(typeBConteudo) : undefined;
    const furoNoMemorial = ehFuroPorTipo ?? ehFuroPorTypeB;
    const furoNoRde = rde.dadosProjeto.furoNaLinha;

    const textoRde = furoNoRde === undefined ? undefined : furoNoRde ? "SIM" : "NÃO";
    const textoMemorial =
      furoNoMemorial === undefined
        ? undefined
        : furoNoMemorial
          ? (defectTypeTexto ?? `Type B Basis preenchido (${typeBConteudo})`)
          : (defectTypeTexto ?? "Type B Basis vazio — sem defeito passante");

    if (furoNoRde === undefined || furoNoMemorial === undefined) {
      checks.push(
        check(
          "Condições de projeto",
          "Furo na linha",
          textoRde,
          textoMemorial,
          "Não Verificável",
          "Não foi possível determinar com segurança se há furo/defeito passante em um dos dois documentos — conferir manualmente o checkbox \"Furo na Linha\" no RDE e o \"Defect Type\"/quadro \"Design Basis Summary\" no memorial."
        )
      );
    } else {
      const divergente = furoNoRde !== furoNoMemorial;
      checks.push(
        check(
          "Condições de projeto",
          "Furo na linha",
          textoRde,
          textoMemorial,
          divergente ? "Inconsistência" : "Consistente",
          divergente
            ? `O RDE marca "Furo na Linha: ${textoRde}", mas o memorial indica ${furoNoMemorial ? "defeito passante/vazamento (furo)" : "defeito não passante (sem furo)"} — confirmar qual está correto antes de liberar.`
            : "Marcação de furo no RDE é compatível com a natureza do defeito descrita no memorial."
        )
      );
    }
  }

  // --- C. Sistema de reparo (material e camadas) ---
  checks.push(
    checarIgualdade("Sistema de reparo", "Sistema/material do reparo", rde.tipoReparo.sistemaMarcado, memorial.repairSpec.repairSystem, {
      severidadeDivergencia: "Inconsistência",
      equivalente: sistemasReparoEquivalentes,
    })
  );

  // Resina citada na lista de "Materiais Utilizados" (por código de cura —
  // ST/HT/UT) vs. o que foi marcado no "Tipo do Reparo". Só entra quando a
  // lista de materiais de fato menciona um código de cura no texto (nem
  // sempre menciona) e há um "Tipo do Reparo" marcado pra comparar contra —
  // sem isso, não tem o que checar.
  {
    const curaMarcada = codigosCuraEmTexto(rde.tipoReparo.sistemaMarcado);
    const curasNaLista = new Set<string>();
    for (const item of rde.materiaisUtilizados) {
      for (const c of codigosCuraEmTexto(item.descricao)) curasNaLista.add(c);
    }
    if (curasNaLista.size > 0 && curaMarcada.size > 0) {
      const divergente = [...curasNaLista].some((c) => !curaMarcada.has(c));
      checks.push(
        check(
          "Sistema de reparo",
          "Resina na lista de materiais vs. Tipo do Reparo marcado",
          [...curasNaLista].join("/"),
          rde.tipoReparo.sistemaMarcado,
          divergente ? "Inconsistência" : "Consistente",
          divergente
            ? `A lista de "Materiais Utilizados" menciona resina ${[...curasNaLista].join("/")}, mas o "Tipo do Reparo" marcado é ${rde.tipoReparo.sistemaMarcado} — confirmar qual resina foi realmente aplicada.`
            : "Resina mencionada na lista de materiais é compatível com o \"Tipo do Reparo\" marcado.",
          // Essa checagem compara dois campos DO PRÓPRIO RDE (não o Memorial)
          // — os rótulos padrão "RDE"/"Memorial" ficariam enganosos aqui.
          { rde: "Materiais Utilizados", memorial: "Tipo do Reparo marcado" }
        )
      );
    }
  }

  // PFP citado pelo nome no resumo das atividades vs. o marcado na seção
  // "Tipo do Reparo". Só entra quando o resumo cita um PRODUTO específico —
  // uma menção genérica ("aplicação de PFP"/"PPCI") não dá o que comparar e
  // não é tratada como problema.
  {
    const pfpNoResumo = pfpsCitadosNoResumo(rde.resumoAtividades);
    if (pfpNoResumo.length > 0) {
      const divergente = pfpNoResumo.some((p) => !rde.tipoReparo.pfpMarcados.includes(p));
      checks.push(
        check(
          "Sistema de reparo",
          "PFP citado no resumo vs. marcado no Tipo do Reparo",
          pfpNoResumo.join(", "),
          rde.tipoReparo.pfpMarcados.join(", ") || "nenhum marcado",
          divergente ? "Inconsistência" : "Consistente",
          divergente
            ? 'O resumo das atividades cita um PFP diferente do marcado na seção "Tipo do Reparo" — confirmar qual foi realmente aplicado.'
            : 'PFP citado no resumo das atividades bate com o marcado na seção "Tipo do Reparo".'
        )
      );
    }
  }
  {
    const minimoExigido = Math.max(memorial.layerCountOverview.straightLayers ?? 0, memorial.layerCountOverview.elbowLayers ?? 0) || undefined;
    if (rde.dadosProjeto.numeroCamadas !== undefined && minimoExigido !== undefined) {
      if (rde.dadosProjeto.numeroCamadas < minimoExigido) {
        checks.push(
          check(
            "Sistema de reparo",
            "Número de camadas",
            String(rde.dadosProjeto.numeroCamadas),
            `mín. ${minimoExigido} (reto: ${memorial.layerCountOverview.straightLayers ?? "?"}, curva: ${memorial.layerCountOverview.elbowLayers ?? "?"})`,
            "Inconsistência",
            "Número de camadas aplicado é menor que o mínimo exigido pelo memorial."
          )
        );
      } else {
        checks.push(
          check(
            "Sistema de reparo",
            "Número de camadas",
            String(rde.dadosProjeto.numeroCamadas),
            `mín. ${minimoExigido}`,
            "Consistente",
            "Número de camadas atende ao mínimo exigido."
          )
        );
      }
    } else {
      checks.push(
        check(
          "Sistema de reparo",
          "Número de camadas",
          rde.dadosProjeto.numeroCamadas !== undefined ? String(rde.dadosProjeto.numeroCamadas) : undefined,
          minimoExigido !== undefined ? String(minimoExigido) : undefined,
          "Não Verificável",
          "Dado ausente em um dos dois documentos."
        )
      );
    }
  }

  // Espessura aplicada (RDE) vs. espessura TEÓRICA calculada a partir do
  // próprio RDE: número de camadas × espessura de 1 camada do conjunto
  // fibra+resina, que depende da cura marcada em "Tipo do Reparo" (ST ou
  // HT — valores por camada informados pelo usuário; UT ainda não tem
  // espessura de referência conhecida, então fica "Não Verificável"). Ao
  // contrário da maioria das checagens, essa é uma consistência INTERNA do
  // RDE (não compara contra o memorial) — pega tanto espessura registrada
  // menor do que o esperado (sub-aplicação) quanto maior (provável erro de
  // digitação em camadas/resina/espessura).
  const ESPESSURA_POR_CAMADA_MM: Record<string, number> = { ST: 1.08, HT: 1.14 };
  {
    const curas = codigosCuraEmTexto(rde.tipoReparo.sistemaMarcado);
    const cura = curas.size === 1 ? [...curas][0] : undefined;
    const espessuraPorCamada = cura ? ESPESSURA_POR_CAMADA_MM[cura] : undefined;
    const espessuraRdeMm = paraMm(rde.dadosProjeto.espessuraRep);
    if (espessuraPorCamada !== undefined && rde.dadosProjeto.numeroCamadas !== undefined && espessuraRdeMm !== null) {
      const esperadoMm = rde.dadosProjeto.numeroCamadas * espessuraPorCamada;
      const c = checarNumerico(
        "Sistema de reparo",
        "Espessura aplicada vs. calculada (camadas × resina)",
        { display: rde.dadosProjeto.espessuraRep?.valorOriginal, valor: espessuraRdeMm },
        { display: `${esperadoMm.toFixed(2)}mm`, valor: esperadoMm },
        { pct: 10 }
      );
      c.explicacao =
        c.status === "Consistente"
          ? `Espessura registrada bate com a calculada (${rde.dadosProjeto.numeroCamadas} camada(s) × ${espessuraPorCamada}mm/camada, resina ${cura}).`
          : `Espessura registrada (${rde.dadosProjeto.espessuraRep?.valorOriginal}) diverge mais de 10% da calculada (${rde.dadosProjeto.numeroCamadas} camada(s) × ${espessuraPorCamada}mm/camada, resina ${cura} = ${esperadoMm.toFixed(2)}mm) — confirmar número de camadas, resina e medição.`;
      checks.push(c);
    } else {
      let motivo: string;
      if (cura === undefined) {
        motivo = 'Não foi possível identificar uma única cura (ST/HT) no "Tipo do Reparo" marcado — sem isso não dá pra calcular a espessura teórica.';
      } else if (espessuraPorCamada === undefined) {
        motivo = `Cura "${cura}" marcada no "Tipo do Reparo" ainda não tem uma espessura de referência por camada cadastrada (só ST e HT têm) — não dá pra calcular a espessura teórica.`;
      } else {
        motivo = "Dado ausente (espessura ou número de camadas não preenchido no RDE).";
      }
      checks.push(
        check(
          "Sistema de reparo",
          "Espessura aplicada vs. calculada (camadas × resina)",
          rde.dadosProjeto.espessuraRep?.valorOriginal,
          rde.dadosProjeto.numeroCamadas !== undefined ? `${rde.dadosProjeto.numeroCamadas} camada(s)` : undefined,
          "Não Verificável",
          motivo
        )
      );
    }
  }

  // Espessura de PFP aplicada vs. referência do PRODUTO marcado — cada
  // produto de PFP tem uma espessura mínima de aplicação diferente (valores
  // informados pelo usuário; produtos sem valor de referência cadastrado
  // ficam "Não Verificável" em vez de inventar um número). Só entra quando
  // algum PFP foi de fato marcado — repô compósito sem PFP não tem o que
  // conferir aqui.
  const ESPESSURA_PFP_MM: Record<string, number> = {
    "JOTACHAR JF750 XT": 5,
    "JOTACHAR JF750": 10,
  };
  if (rde.tipoReparo.pfpMarcados.length > 0) {
    const pfpMarcado = rde.tipoReparo.pfpMarcados.length === 1 ? rde.tipoReparo.pfpMarcados[0] : undefined;
    const espessuraReferencia = pfpMarcado ? ESPESSURA_PFP_MM[pfpMarcado] : undefined;
    const espessuraPfpMm = paraMm(rde.dadosProjeto.espessuraPfpAplicada);
    if (espessuraReferencia !== undefined && espessuraPfpMm !== null) {
      const c = checarNumerico(
        "Sistema de reparo",
        "Espessura do PFP aplicado vs. referência do produto",
        { display: rde.dadosProjeto.espessuraPfpAplicada?.valorOriginal, valor: espessuraPfpMm },
        { display: `${espessuraReferencia}mm`, valor: espessuraReferencia },
        { pct: 10 }
      );
      c.explicacao =
        c.status === "Consistente"
          ? `Espessura de PFP aplicada bate com a referência do produto marcado (${pfpMarcado}: ${espessuraReferencia}mm).`
          : `Espessura de PFP aplicada (${rde.dadosProjeto.espessuraPfpAplicada?.valorOriginal}) diverge mais de 10% da referência do produto marcado (${pfpMarcado}: ${espessuraReferencia}mm).`;
      checks.push(c);
    } else {
      let motivo: string;
      if (rde.tipoReparo.pfpMarcados.length > 1) {
        motivo = `Mais de um produto de PFP aparenta estar marcado (${rde.tipoReparo.pfpMarcados.join(", ")}) — não dá pra saber qual espessura de referência usar.`;
      } else if (espessuraReferencia === undefined) {
        motivo = `Produto "${pfpMarcado}" ainda não tem uma espessura de referência cadastrada (só JOTACHAR JF750 e JOTACHAR JF750 XT têm) — não dá pra conferir.`;
      } else {
        motivo = 'Campo "Espessura PFP aplicada" não preenchido no RDE.';
      }
      checks.push(
        check(
          "Sistema de reparo",
          "Espessura do PFP aplicado vs. referência do produto",
          rde.dadosProjeto.espessuraPfpAplicada?.valorOriginal,
          espessuraReferencia !== undefined ? `${espessuraReferencia}mm` : undefined,
          "Não Verificável",
          motivo
        )
      );
    }
  }

  // --- D. Geometria do reparo ---
  {
    const marcadas = rde.geometria.marcadas;
    const temReto = marcadas.some((g) => /T\.?\s*RETO/i.test(g));
    const temCurva = marcadas.some((g) => /CURVA/i.test(g));
    const memTemReto = memorial.layerCountOverview.straightLayers !== undefined;
    const memTemCurva = memorial.layerCountOverview.elbowLayers !== undefined;

    if (marcadas.length === 0) {
      checks.push(check("Geometria", "Geometria do reparo marcada", "nenhuma", "—", "Não Verificável", "Nenhuma geometria identificada no RDE."));
    } else {
      const semCalculoCorrespondente = (temReto && !memTemReto) || (temCurva && !memTemCurva);
      checks.push(
        check(
          "Geometria",
          "Geometria marcada tem cálculo correspondente",
          marcadas.join(", "),
          [memTemReto ? "Straight" : null, memTemCurva ? "Elbows" : null].filter(Boolean).join(", "),
          semCalculoCorrespondente ? "Inconsistência" : "Consistente",
          semCalculoCorrespondente
            ? "Geometria marcada no RDE não tem dimensionamento correspondente no memorial."
            : "Geometria(s) marcada(s) têm cálculo correspondente no memorial."
        )
      );
    }
  }

  // --- E. Comprimento e overlap ---
  {
    const aplicadoMm = paraMm(rde.dadosProjeto.comprimentoReparo);
    // O mínimo de verdade (exigido pelo CÁLCULO ISO 24817) é a parte
    // "Required" de "Min. Req. Length:" quando disponível — NÃO o
    // "Customer specified repair length" / "Length Requested / Required",
    // que é só o comprimento pedido/especificado pelo cliente (a parte
    // "Requested") e pode ser bem maior que o mínimo sem que isso seja um
    // problema (ex. memorial real: "540 mm Required | 12000 mm Requested" —
    // 540mm é o mínimo, 12000mm é só o que o cliente pediu). Só cai pros
    // outros campos como fallback quando o memorial não tem essa linha.
    const minimoValor =
      memorial.repairSpec.minimumRequiredRepairLength ?? memorial.repairSpec.customerSpecifiedRepairLength ?? memorial.defectDetails.lengthRequestedRequired;
    const exigidoMm = paraMm(minimoValor);
    const solicitadoValor = memorial.repairSpec.customerSpecifiedRepairLength ?? memorial.defectDetails.lengthRequestedRequired;
    const solicitadoMm = paraMm(solicitadoValor);
    // primeiraLinha() aqui pela mesma razão do resto do arquivo (ver
    // checarIgualdade): o valor bruto desse campo às vezes "vaza" o início do
    // campo seguinte (ex. "Cure requirement:") por causa de outro caso do
    // mesmo bug de rótulo-no-meio-do-valor-multilinha.
    const solicitadoTexto = primeiraLinha(solicitadoValor?.valorOriginal);
    const notaSolicitado =
      solicitadoTexto && exigidoMm !== null && solicitadoMm !== null && solicitadoMm !== exigidoMm
        ? ` O memorial também registra um comprimento solicitado pelo cliente de ${solicitadoTexto} — isso é só uma referência do que foi pedido, não o mínimo obrigatório.`
        : "";
    if (aplicadoMm !== null && exigidoMm !== null) {
      if (aplicadoMm >= exigidoMm) {
        checks.push(
          check(
            "Comprimento",
            "Comprimento aplicado vs. exigido",
            rde.dadosProjeto.comprimentoReparo?.valorOriginal,
            minimoValor?.valorOriginal,
            "Consistente",
            `Comprimento aplicado atende ao mínimo exigido pelo cálculo.${notaSolicitado}`
          )
        );
      } else {
        checks.push(
          check(
            "Comprimento",
            "Comprimento aplicado vs. exigido",
            rde.dadosProjeto.comprimentoReparo?.valorOriginal,
            minimoValor?.valorOriginal,
            "Inconsistência",
            `Comprimento aplicado (${aplicadoMm}mm) é menor que o mínimo exigido pelo cálculo (${exigidoMm}mm).${notaSolicitado} Confirmar se este RDE cobre só um trecho parcial de uma aplicação em múltiplas etapas — o sistema não agrega outros RDEs da mesma referência automaticamente.`
          )
        );
      }
    } else {
      checks.push(
        check(
          "Comprimento",
          "Comprimento aplicado vs. exigido",
          rde.dadosProjeto.comprimentoReparo?.valorOriginal,
          minimoValor?.valorOriginal,
          "Não Verificável",
          "Dado ausente em um dos dois documentos."
        )
      );
    }
  }
  checks.push(
    check(
      "Comprimento",
      "Overlap aplicado",
      "—",
      memorial.repairSpec.requiredOverlap?.valorOriginal,
      "Não Verificável",
      "O RDE hoje não tem campo dedicado pra registrar o overlap aplicado — candidato a melhoria de formulário."
    )
  );

  // --- F. Condições de aplicação ---
  {
    const sup = rde.condicoesAplicacao.temperaturaSuperficie?.valor ?? null;
    const min = memorial.installationConditions.minInstallSurfaceTemperature?.valor ?? null;
    const max = memorial.installationConditions.maxInstallSurfaceTemperature?.valor ?? null;
    if (sup !== null && min !== null && max !== null) {
      const dentro = sup >= min && sup <= max;
      checks.push(
        check(
          "Condições de aplicação",
          "Temperatura de superfície dentro da faixa",
          `${sup}°C`,
          `${min}–${max}°C`,
          dentro ? "Consistente" : "Inconsistência",
          dentro ? "Dentro da faixa permitida de instalação." : "Fora da faixa permitida de instalação."
        )
      );
    } else {
      checks.push(
        check(
          "Condições de aplicação",
          "Temperatura de superfície dentro da faixa",
          rde.condicoesAplicacao.temperaturaSuperficie?.valorOriginal,
          undefined,
          "Não Verificável",
          "Dado ausente em um dos dois documentos."
        )
      );
    }
  }
  {
    const umid = rde.condicoesAplicacao.umidadeRelativa?.valor ?? null;
    const limite = memorial.installationConditions.humidityLimitPct ?? null;
    if (umid !== null && limite !== null) {
      const dentro = umid < limite;
      checks.push(
        check(
          "Condições de aplicação",
          "Umidade relativa dentro do limite",
          `${umid}%`,
          `< ${limite}%`,
          dentro ? "Consistente" : "Inconsistência",
          dentro ? "Dentro do limite." : "Acima do limite permitido pelo memorial."
        )
      );
    } else {
      checks.push(
        check(
          "Condições de aplicação",
          "Umidade relativa dentro do limite",
          rde.condicoesAplicacao.umidadeRelativa?.valorOriginal,
          undefined,
          "Não Verificável",
          "Dado ausente em um dos dois documentos."
        )
      );
    }
  }
  {
    const unidadeOrvalho = rde.condicoesAplicacao.tempPontoOrvalho?.unidade ?? "";
    if (unidadeOrvalho.includes("%")) {
      checks.push(
        check(
          "Condições de aplicação",
          "Ponto de orvalho vs. temperatura de superfície",
          rde.condicoesAplicacao.tempPontoOrvalho?.valorOriginal,
          "—",
          "Ponto de Atenção",
          'Campo "Temp. Ponto de Orvalho" está preenchido em % em vez de °C no RDE — não dá pra checar a margem contra a temperatura de superfície.'
        )
      );
    }
  }
  if (!rde.condicoesAplicacao.rugosidadeSuperficie?.valorOriginal) {
    checks.push(
      check("Condições de aplicação", "Rugosidade da superfície preenchida", "—", "—", "Ponto de Atenção", "Campo não preenchido no RDE.")
    );
  }

  // --- G. Evidência fotográfica (presença apenas — sem leitura de conteúdo) ---
  checks.push(
    check(
      "Evidência fotográfica",
      'Foto "Antes da Execução" presente',
      rde.fotos.antesPresente ? "presente" : "ausente",
      "obrigatória",
      rde.fotos.antesPresente ? "Consistente" : "Ponto de Atenção",
      rde.fotos.antesPresente ? "Foto detectada." : "Nenhuma imagem grande detectada nessa região da página 1."
    )
  );
  checks.push(
    check(
      "Evidência fotográfica",
      'Foto "Após Execução do Serviço" presente',
      rde.fotos.depoisPresente ? "presente" : "ausente",
      "obrigatória",
      rde.fotos.depoisPresente ? "Consistente" : "Inconsistência",
      rde.fotos.depoisPresente ? "Foto detectada." : "Sem evidência fotográfica do reparo em si."
    )
  );
  const declarouPfp = Boolean(rde.tipoReparo.pfpMarcados.length || /PPCI|PFP/i.test(rde.resumoAtividades ?? ""));
  if (declarouPfp) {
    checks.push(
      check(
        "Evidência fotográfica",
        'Foto "Após Execução de PFP" presente',
        rde.fotos.pfpPresente ? "presente" : "ausente",
        "obrigatória (RDE declara atividade de PFP)",
        rde.fotos.pfpPresente ? "Consistente" : "Ponto de Atenção",
        rde.fotos.pfpPresente
          ? "Foto detectada."
          : "RDE relata atividade de PFP/PPCI mas não há evidência fotográfica dessa etapa."
      )
    );
  }

  const resumo: Record<StatusChecagem, number> = {
    Consistente: 0,
    "Ponto de Atenção": 0,
    Inconsistência: 0,
    "Não Verificável": 0,
  };
  for (const c of checks) resumo[c.status] += 1;

  return { checks, resumo };
}
