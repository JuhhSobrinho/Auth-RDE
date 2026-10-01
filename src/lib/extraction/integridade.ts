/**
 * Detecta um sinal específico de corrupção já observado em RDEs reais nesta
 * ferramenta: o PDF foi salvo de forma incremental (reaberto e reeditado
 * depois da geração original — o formato PDF permite isso sem reescrever o
 * arquivo inteiro) e a atualização mais recente aparenta ter perdido o
 * conteúdo de um campo de texto. O valor "oficial" (o que qualquer leitor de
 * PDF correto — incluindo pdf-lib e pdfjs, as duas bibliotecas usadas por
 * este app — deve usar) vem vazio ou quase vazio, mas uma versão ANTERIOR do
 * mesmo campo, ainda fisicamente presente no arquivo (uma atualização
 * incremental nunca apaga os bytes da versão antiga, só marca ela como
 * substituída), tinha bem mais conteúdo.
 *
 * Isso é enganoso pra quem revisa o RDE: a maioria dos visualizadores de PDF
 * — inclusive navegadores comuns — tolera esse tipo de corrupção (um erro
 * de parsing na atualização mais recente, ex. uma tabela de referência
 * cruzada malformada) e cai de volta pra versão antiga do campo sem avisar
 * nada, então o arquivo "parece" preenchido normalmente ao abrir. Só uma
 * leitura estrita da cadeia de atualizações do PDF revela que o dado
 * realmente vigente está vazio.
 *
 * Esta função NÃO tenta recuperar/usar o valor antigo como se fosse o atual
 * — seria arriscado (pode ter sido alterado de propósito numa reedição
 * legítima). Ela só avisa que vale a pena conferir esse campo manualmente
 * antes de aprovar o RDE.
 */
export function avisoDePerdaEmRegravacao(
  bytesPdf: Uint8Array,
  nomeCampoAcroForm: string,
  nomeExibicao: string,
  valorAtual: string | undefined,
  limiarCaracteres = 15
): string | undefined {
  const atualLen = (valorAtual ?? "").trim().length;
  // Valor atual já parece razoável — não vale a pena escanear o arquivo
  // inteiro procurando um problema que provavelmente não existe.
  if (atualLen >= limiarCaracteres) return undefined;

  // `TextDecoder("latin1")` (mapeamento byte-a-byte, sem multibyte) em vez de
  // `Buffer` — este módulo roda no navegador, onde `Buffer` (API do Node) não
  // existe.
  let latin1: string;
  try {
    latin1 = new TextDecoder("latin1").decode(bytesPdf);
  } catch {
    return undefined;
  }

  // Acha cada definição do objeto desse campo no arquivo (uma por
  // atualização incremental em que ele foi reescrito) e o tamanho do valor
  // (/V) de cada uma. Como o formato PDF só ANEXA atualizações no fim do
  // arquivo, a ÚLTIMA ocorrência por posição no arquivo corresponde à versão
  // mais recente/vigente — não precisamos resolver a cadeia de xref inteira
  // pra essa comparação aproximada.
  const escapado = nomeCampoAcroForm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reObjeto = new RegExp(`<<([^<>]*?/T\\(${escapado}\\)[^<>]*?)>>`, "g");
  const tamanhos: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = reObjeto.exec(latin1))) {
    const vm = m[1].match(/\/V\(([\s\S]*?)\)(?=\/[A-Za-z]|>>|$)/);
    tamanhos.push(vm ? vm[1].length : 0);
  }
  if (tamanhos.length < 2) return undefined; // sem atualização incremental duplicando esse campo

  const tamanhoVigente = tamanhos[tamanhos.length - 1];
  const maiorAnterior = Math.max(...tamanhos.slice(0, -1));
  if (maiorAnterior >= limiarCaracteres * 2 && maiorAnterior > tamanhoVigente) {
    return (
      `O campo "${nomeExibicao}" está vazio (ou quase) na versão mais recente deste PDF, mas o arquivo contém uma ` +
      `versão anterior do mesmo campo com bem mais conteúdo — sinal de que uma regravação/edição posterior do PDF ` +
      `pode ter apagado esse dado sem querer. A maioria dos visualizadores de PDF ainda mostra o conteúdo antigo na ` +
      `tela (por isso pode parecer normal ao abrir o arquivo), mas o dado que este app lê — e que vale oficialmente ` +
      `— está vazio. Confirmar o "${nomeExibicao}" manualmente antes de aprovar este RDE.`
    );
  }
  return undefined;
}
