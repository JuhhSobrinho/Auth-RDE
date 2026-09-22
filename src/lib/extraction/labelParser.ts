// Parser genérico "Rótulo: Valor" em cima do texto já reconstruído em ordem
// de leitura (ver pdfText.ts). Funciona tanto pro RDE (Word→PDF ou texto
// solto) quanto pro memorial de cálculo, desde que se passe a lista de
// rótulos conhecidos do respectivo template.

export interface Intervalo {
  inicio: number;
  fim: number;
}

export interface ResultadoRotulos {
  valores: Record<string, string>;
  /** Posição [inicio, fim) do RÓTULO+VALOR no `fullText` original — usada pra desenhar o retângulo de destaque (ver posicao.ts). */
  intervalos: Record<string, Intervalo>;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Dado o texto completo (em ordem de leitura) e uma lista de rótulos
 * conhecidos (ex. "Pressão de Projeto:"), devolve um mapa rótulo -> valor,
 * usando a posição de cada ocorrência de rótulo no texto pra delimitar onde
 * o valor anterior termina. Também devolve, por rótulo, o intervalo de
 * caracteres [inicio, fim) que cobre rótulo+valor no MESMO texto de entrada
 * — o chamador usa isso com `boxParaIntervalo` (posicao.ts) pra saber onde
 * desenhar o destaque em cima do PDF.
 */
export function extrairPorRotulos(fullText: string, rotulos: string[]): ResultadoRotulos {
  // fullText vindo de pdfText.ts nunca tem \r (só \n entre linhas), então essa
  // normalização não desalinha os offsets — mantida só como defesa caso o
  // texto venha de outra fonte no futuro.
  const normalizado = fullText.replace(/\r\n/g, "\n");
  const alternancia = rotulos
    .slice()
    .sort((a, b) => b.length - a.length) // rótulos mais longos primeiro evita prefixo colidir
    .map(escapeRegex)
    .join("|");
  const re = new RegExp(`(${alternancia})`, "g");

  const ocorrencias: { rotulo: string; inicio: number; fim: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalizado))) {
    ocorrencias.push({ rotulo: m[1], inicio: m.index, fim: m.index + m[0].length });
  }

  const valores: Record<string, string> = {};
  const intervalos: Record<string, Intervalo> = {};
  for (let i = 0; i < ocorrencias.length; i++) {
    const atual = ocorrencias[i];
    const proximo = ocorrencias[i + 1];
    const fimValor = proximo ? proximo.inicio : normalizado.length;
    let valor = normalizado.slice(atual.fim, fimValor).trim();
    valor = valor.replace(/^:+\s*/, "").trim(); // alguns templates duplicam o ":" (ex. "Data::")
    // não sobrescreve um valor não vazio já capturado (mantém a 1a ocorrência)
    if (!(atual.rotulo in valores) || !valores[atual.rotulo]) {
      valores[atual.rotulo] = valor;
      intervalos[atual.rotulo] = { inicio: atual.inicio, fim: fimValor };
    }
  }
  return { valores, intervalos };
}

const MARCADORES = ["☒", "☑", "✔", "✓", "■", "X"];

export interface ResultadoCheckbox {
  marcadas: string[];
  /** Posição [inicio, fim) de cada opção MARCADA (rótulo da própria opção, sem o marcador). */
  intervalos: Record<string, Intervalo>;
}

/**
 * Detecta quais opções de um grupo de checkbox estão marcadas, olhando se
 * algum marcador aparece imediatamente antes do rótulo da opção no texto.
 */
export function extrairGrupoCheckbox(fullText: string, opcoes: string[]): ResultadoCheckbox {
  const marcadas: string[] = [];
  const intervalos: Record<string, Intervalo> = {};
  // opções mais longas primeiro, e mascara só o texto da PRÓPRIA opção (nunca
  // o prefixo de 4 caracteres usado só pra olhar se tem marcador) — evita que
  // uma opção curta (ex. "JOTACHAR JF750") case por engano dentro de uma mais
  // longa que a contém (ex. "JOTACHAR JF750 XT"), sem corromper o rótulo de
  // uma opção vizinha ainda não processada (o prefixo pode invadir o fim do
  // rótulo anterior quando os dois ficam coladas no texto reconstruído).
  let texto = fullText;
  const ordenadas = opcoes.slice().sort((a, b) => b.length - a.length);
  for (const opcao of ordenadas) {
    const re = new RegExp(`([\\s\\S]{0,4})${escapeRegex(opcao)}`, "g");
    let m: RegExpExecArray | null;
    let achouMarcado = false;
    let inicioOpcao = -1;
    while ((m = re.exec(texto))) {
      const prefixo = m[1] ?? "";
      inicioOpcao = m.index + prefixo.length;
      if (MARCADORES.some((marc) => prefixo.includes(marc))) {
        achouMarcado = true;
      }
    }
    if (achouMarcado) {
      marcadas.push(opcao);
      if (inicioOpcao >= 0) intervalos[opcao] = { inicio: inicioOpcao, fim: inicioOpcao + opcao.length };
    }
    if (inicioOpcao >= 0) {
      texto = texto.slice(0, inicioOpcao) + "#".repeat(opcao.length) + texto.slice(inicioOpcao + opcao.length);
    }
  }
  return { marcadas, intervalos };
}

/**
 * Caso especial do campo "Furo na Linha: ( ) SIM (X) NÃO" — descobre qual das
 * duas opções tem o "X" dentro dos parênteses.
 */
export function extrairFuroNaLinha(fullText: string): boolean | null {
  const re = /\(\s*(X?)\s*\)\s*SIM[\s\S]{0,20}?\(\s*(X?)\s*\)\s*N[ÃA]O/i;
  const m = fullText.match(re);
  if (!m) return null;
  const simMarcado = m[1].toUpperCase() === "X";
  const naoMarcado = m[2].toUpperCase() === "X";
  if (simMarcado && !naoMarcado) return true;
  if (naoMarcado && !simMarcado) return false;
  return null; // ambíguo ou nenhum marcado
}
