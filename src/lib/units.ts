import type { ValorComUnidade } from "../types";

/**
 * Extrai um número + unidade de uma string livre tipo "6,43BAR", "1655kpa",
 * "220MM", "90°C", "6''-FG-B10-023" (não numérico -> valor null).
 * Aceita vírgula ou ponto como separador decimal.
 */
export function parseValorComUnidade(raw: string | undefined | null): ValorComUnidade {
  const valorOriginal = (raw ?? "").trim();
  if (!valorOriginal) {
    return { valorOriginal, valor: null, unidade: null };
  }
  const match = valorOriginal.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) {
    return { valorOriginal, valor: null, unidade: null };
  }
  const numStr = match[0].replace(",", ".");
  const valor = Number.parseFloat(numStr);
  const restante = valorOriginal.slice((match.index ?? 0) + match[0].length).trim();
  const unidade = restante ? restante.replace(/^[():\s]+/, "").trim() || null : null;
  return { valorOriginal, valor: Number.isNaN(valor) ? null : valor, unidade };
}

/**
 * Converte pressão pra bar (aceita bar/barg, kpa/kPa, kgf/cm²). Retorna null
 * se não reconhecer a unidade.
 *
 * kgf/cm² é tratado como NUMERICAMENTE IGUAL a bar (sem aplicar o fator de
 * conversão físico de 0,980665) — não é um arredondamento grosseiro, é a
 * convenção que o próprio memorial de cálculo usa: RDEs reais confirmam que
 * um valor registrado em kgf/cm² (ex. "15kgf/cm²") corresponde ao mesmo
 * número em barg no memorial ("15 barg"), não ao valor fisicamente
 * convertido (14,71 bar). Aplicar o fator físico aqui faria a checagem
 * acusar divergência em casos que na prática são o mesmo valor.
 */
export function paraBar(v: ValorComUnidade | undefined): number | null {
  if (!v || v.valor === null) return null;
  const u = (v.unidade ?? "").toLowerCase();
  if (u.startsWith("bar")) return v.valor;
  if (u.startsWith("kpa")) return v.valor / 100;
  if (u.startsWith("kgf")) return v.valor;
  // sem unidade reconhecida: assume que já está em bar (RDE antigo costuma vir só em BAR sem sufixo confiável)
  return v.valor;
}

/** Converte temperatura pra °C (assume já estar em °C na grande maioria dos campos deste formulário). */
export function paraCelsius(v: ValorComUnidade | undefined): number | null {
  if (!v || v.valor === null) return null;
  return v.valor;
}

/** Converte comprimento pra mm (aceita mm, m, cm). */
export function paraMm(v: ValorComUnidade | undefined): number | null {
  if (!v || v.valor === null) return null;
  const u = (v.unidade ?? "").toLowerCase();
  if (u.startsWith("mm") || u === "") return v.valor;
  if (u.startsWith("cm")) return v.valor * 10;
  if (u.startsWith("m")) return v.valor * 1000;
  return v.valor;
}

/**
 * Tabela de diâmetro externo padrão (mm) por bitola nominal (NPS, polegadas) —
 * valores de OD padrão (não variam por schedule). Aproximação pra cruzar o
 * "Diâmetro da Linha" do RDE (normalmente em polegada nominal) com o
 * "Line Diameter" do memorial (normalmente em mm, OD real medido).
 */
const NPS_TO_OD_MM: Record<string, number> = {
  "1/2": 21.3,
  "3/4": 26.7,
  "1": 33.4,
  "1 1/4": 42.2,
  "1 1/2": 48.3,
  "2": 60.3,
  "2 1/2": 73.0,
  "3": 88.9,
  "4": 114.3,
  "5": 141.3,
  "6": 168.3,
  "8": 219.1,
  "10": 273.0,
  "12": 323.8,
  "14": 355.6,
  "16": 406.4,
  "18": 457.0,
  "20": 508.0,
  "24": 610.0,
};

/** Extrai a bitola nominal (ex: "6" de `6”` ou `6''-FG-B10-023`) e devolve o OD padrão em mm, se souber. */
export function npsParaOdMm(diametroRde: string | undefined | null): number | null {
  if (!diametroRde) return null;
  const match = diametroRde.match(/(\d+(?:\s\d+\/\d+)?|\d+\/\d+)/);
  if (!match) return null;
  const nps = match[0].trim();
  return NPS_TO_OD_MM[nps] ?? null;
}

/**
 * Alguns campos do memorial quebram linha ao redor do próprio rótulo (o
 * layout do PDF intercala rótulo/valor de forma incomum) e acabam carregando
 * texto de campos vizinhos junto no `valorOriginal`. O `valor` numérico já
 * sai correto (pega só o primeiro número), mas pra exibição na tela cortamos
 * na primeira quebra de linha pra não mostrar um parágrafo inteiro.
 */
export function primeiraLinha(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  return s.split("\n")[0].trim() || undefined;
}

/** Compara dois números com tolerância absoluta e/ou percentual. */
export function dentroDaTolerancia(
  a: number | null,
  b: number | null,
  opts: { abs?: number; pct?: number } = {}
): boolean {
  if (a === null || b === null) return false;
  const abs = opts.abs ?? 0;
  const pct = opts.pct ?? 0;
  const diff = Math.abs(a - b);
  const tolAbs = abs;
  const tolPct = (pct / 100) * Math.max(Math.abs(a), Math.abs(b));
  return diff <= Math.max(tolAbs, tolPct);
}
