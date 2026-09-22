import type { MaterialUtilizadoItem } from "../../types";
import type { Intervalo } from "./labelParser";

// Extração da tabela livre "Materiais Utilizados" do RDE. O template tem duas
// mini-tabelas lado a lado na mesma seção: uma pra resina/reforço ("Item Qtd.
// Descrição (Resina; F.Vidro; F.Carbono; etc)") e outra pra material auxiliar
// ("Item Qtd. Descrição (Fita; Peel Ply; Thinner; etc)").
//
// Tentativa inicial usava um regex pra separar item/qtd/descrição dentro da
// linha — descartada depois de um teste isolado mostrar que ela corrompe
// nomes de material com número embutido (ex. "RESIMAC 101" vira descrição
// "RESIMAC" + uma linha fantasma "101 ..."), porque o texto reconstruído do
// PDF não preserva os limites de coluna da tabela, só os de linha (cada linha
// visual do PDF já sai como uma linha própria em `fullText`, ver pdfText.ts).
// Sem um exemplar real dessa seção preenchida pra calibrar contra ambiguidade
// esse tipo, o mais seguro é NÃO fingir estrutura de coluna: cada linha vira
// um item com a descrição bruta, sem separar item/qtd. Menos "bonito", mas
// não inventa dado errado.
const FIM_TABELA = /^(Representante Team|Anota[cç][oõ]es gerais)/i;

export interface ResultadoMateriaisUtilizados {
  itens: MaterialUtilizadoItem[];
  /** Intervalo [inicio, fim) no `fullText` original cobrindo o cabeçalho + todas as linhas de item lidas — usado pra desenhar a caixa da tabela inteira na visualização (ver posicao.ts `mapaDeAreas`). */
  intervalo?: Intervalo;
}

export function extrairMateriaisUtilizados(fullText: string): ResultadoMateriaisUtilizados {
  const linhas = fullText.split("\n");
  const inicio = linhas.findIndex((l) => /Descri[cç][aã]o \(Fita;\s*Peel Ply;\s*Thinner;?\s*etc\)/i.test(l));
  if (inicio === -1) return { itens: [] };

  // Offset (em `fullText`) do início de cada linha — `split("\n")` descarta
  // essa informação, então reconstrói somando o tamanho de cada linha + 1
  // (o "\n" removido) conforme percorre.
  const offsetsLinha: number[] = [];
  let acumulado = 0;
  for (const l of linhas) {
    offsetsLinha.push(acumulado);
    acumulado += l.length + 1;
  }

  const itens: MaterialUtilizadoItem[] = [];
  let fimIndiceLinha = linhas.length - 1;
  for (let i = inicio + 1; i < linhas.length; i++) {
    const linha = linhas[i].replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (FIM_TABELA.test(linha)) {
      fimIndiceLinha = i - 1;
      break;
    }
    itens.push({ descricao: linha });
  }
  if (itens.length === 0) return { itens };

  const inicioOffset = offsetsLinha[inicio];
  const fimOffset = offsetsLinha[fimIndiceLinha] + linhas[fimIndiceLinha].length;
  return { itens, intervalo: { inicio: inicioOffset, fim: fimOffset } };
}

const VAZIO_OU_NA = /^(n\/?a|-|—|0)?$/i;

/** Sintetiza itens de "Materiais Utilizados" a partir dos campos dedicados de kit de resina (RESIMAC). */
export function itensDeKitsResina(kits: { resimac101?: string; resimac114?: string }): MaterialUtilizadoItem[] {
  const itens: MaterialUtilizadoItem[] = [];
  const v101 = kits.resimac101?.trim();
  const v114 = kits.resimac114?.trim();
  if (v101 && !VAZIO_OU_NA.test(v101)) {
    itens.push({ descricao: "RESIMAC 101 (kits)", qtd: v101 });
  }
  if (v114 && !VAZIO_OU_NA.test(v114)) {
    itens.push({ descricao: "RESIMAC 114 (kits)", qtd: v114 });
  }
  return itens;
}
