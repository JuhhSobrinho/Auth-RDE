import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib } from "../lib/pdfjsSetup";
import type { CampoPosicao, ComparisonCheck, StatusChecagem } from "../types";
import { COR_SOLIDA } from "../lib/statusColors";
import { camposParaCheck, areaParaCheck, type LadoDocumento } from "../lib/overlayMapping";

const ESCALA_RENDER = 1.3;

// Renderizar TODAS as páginas de um PDF de uma vez (cada uma decodifica +
// desenha um canvas em alta resolução) sobrecarrega o worker do pdfjs — em
// memoriais com dezenas de páginas isso trava a aba e, sob carga, pode até
// fazer alguma chamada `getPage`/`render` falhar. Uma fila simples limita
// quantas páginas renderizam ao mesmo tempo; as demais entram na fila e
// começam assim que uma vaga libera — mais suave both pro navegador do
// usuário e mais previsível de testar.
function criarFilaConcorrencia(maxConcorrente: number) {
  let emExecucao = 0;
  const espera: (() => void)[] = [];
  function tentarProximo() {
    if (emExecucao >= maxConcorrente) return;
    const rodar = espera.shift();
    if (!rodar) return;
    emExecucao++;
    rodar();
  }
  return function executar<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      espera.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            emExecucao--;
            tentarProximo();
          });
      });
      tentarProximo();
    });
  };
}

const filaRenderPdf = criarFilaConcorrencia(2);

// Serializa os `getDocument()` do RDE e do memorial — os dois carregam ao
// mesmo tempo por padrão (as duas colunas aparecem lado a lado, sem esperar
// uma pela outra), mas iniciar as DUAS cargas de documento pdfjs
// simultaneamente, nesse ambiente, se mostrou capaz
// de embaralhar as respostas entre os dois documentos (uma chamada
// `getPage()` de um deles retornando "Invalid page request" — como se
// tivesse sido roteada pro documento errado). Carregar um documento por vez
// (mesmo que isso adie o início do carregamento do memorial em alguns
// milissegundos) evitou o problema nos testes — ver histórico desta seção
// se voltar a acontecer mesmo com isso.
const filaCarregarDocumento = criarFilaConcorrencia(1);

interface Marcador extends CampoPosicao {
  cor: string;
  titulo: string;
}

// Ordem de severidade (pior primeiro) usada pra agregar o status de VÁRIAS
// checagens que apontam pra uma mesma área de bloco (ver `areas` abaixo) —
// se qualquer uma delas for "Inconsistência", a área inteira fica vermelha,
// mesmo que outras checagens da mesma área estejam "Consistente".
const SEVERIDADE: StatusChecagem[] = ["Inconsistência", "Ponto de Atenção", "Não Verificável", "Consistente"];

function piorStatus(status: StatusChecagem[]): StatusChecagem {
  for (const s of SEVERIDADE) if (status.includes(s)) return s;
  return "Não Verificável";
}

function construirMarcadores(
  lado: LadoDocumento,
  posicoes: Record<string, CampoPosicao> | undefined,
  checks: ComparisonCheck[]
): Marcador[] {
  if (!posicoes) return [];
  const marcadores: Marcador[] = [];
  for (const c of checks) {
    for (const chave of camposParaCheck(c.descricao, lado)) {
      const pos = posicoes[chave];
      if (!pos) continue;
      marcadores.push({ ...pos, cor: COR_SOLIDA[c.status], titulo: `${c.descricao} — ${c.status}` });
    }
  }
  return marcadores;
}

// Marcadores de ÁREA (caixa envolvente de um campo de bloco, ex. "Resumo das
// Atividades", "Materiais Utilizados") — diferente de `construirMarcadores`,
// que marca um trecho pontual por checagem, aqui várias checagens podem
// apontar pra MESMA área (ex. hoje só uma cada, mas o mapeamento suporta
// mais no futuro): a caixa é desenhada UMA vez por área, colorida pelo PIOR
// status entre todas as checagens associadas a ela.
function construirMarcadoresDeArea(areas: Record<string, CampoPosicao[]> | undefined, checks: ComparisonCheck[]): Marcador[] {
  if (!areas) return [];
  const porArea = new Map<string, ComparisonCheck[]>();
  for (const c of checks) {
    const chaveArea = areaParaCheck(c.descricao);
    if (!chaveArea) continue;
    const lista = porArea.get(chaveArea) ?? [];
    lista.push(c);
    porArea.set(chaveArea, lista);
  }
  const marcadores: Marcador[] = [];
  for (const [chaveArea, checksDaArea] of porArea) {
    const caixas = areas[chaveArea];
    if (!caixas || caixas.length === 0) continue;
    const agregado = piorStatus(checksDaArea.map((c) => c.status));
    const titulo = checksDaArea.map((c) => `${c.descricao} — ${c.status}`).join(" · ");
    for (const caixa of caixas) {
      marcadores.push({ ...caixa, cor: COR_SOLIDA[agregado], titulo });
    }
  }
  return marcadores;
}

interface Retangulo {
  left: number;
  top: number;
  width: number;
  height: number;
  cor: string;
  titulo: string;
}

function PaginaComMarcadores({
  doc,
  numeroPagina,
  marcadores,
}: {
  doc: PDFDocumentProxy;
  numeroPagina: number;
  marcadores: Marcador[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tamanho, setTamanho] = useState<{ largura: number; altura: number } | null>(null);
  const [retangulos, setRetangulos] = useState<Retangulo[]>([]);

  useEffect(() => {
    let cancelado = false;
    // Guarda a task de render em andamento pra poder cancelar no cleanup —
    // sem isso, se o efeito rodar de novo antes do render anterior terminar
    // (ex. `marcadores` mudou de identidade por causa de um re-render do pai
    // enquanto o PDF ainda carregava), o pdfjs recusa o 2º `render()` no
    // mesmo <canvas> com "Cannot use the same canvas during multiple render()
    // operations".
    let taskEmAndamento: { cancel: () => void } | null = null;
    filaRenderPdf(async () => {
      if (cancelado) return;
      const page = await doc.getPage(numeroPagina);
      if (cancelado) return;
      const viewport = page.getViewport({ scale: ESCALA_RENDER });
      const canvas = canvasRef.current;
      if (!canvas || cancelado) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = page.render({ canvasContext: ctx, viewport, canvas });
      taskEmAndamento = task;
      try {
        await task.promise;
      } catch (e) {
        // Cancelamento esperado (efeito desmontado/re-executado) não é erro real.
        if (cancelado) return;
        throw e;
      }
      taskEmAndamento = null;
      if (cancelado) return;
      setTamanho({ largura: viewport.width, altura: viewport.height });

      const rets = marcadores
        .filter((m) => m.pagina === numeroPagina)
        .map((m): Retangulo => {
          const [x1, y1] = viewport.convertToViewportPoint(m.x, m.y);
          const [x2, y2] = viewport.convertToViewportPoint(m.x + m.largura, m.y + m.altura);
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          return { left, top, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), cor: m.cor, titulo: m.titulo };
        });
      setRetangulos(rets);
    }).catch((e) => {
      if (!cancelado) console.error("Falha ao renderizar página do PDF:", e);
    });
    return () => {
      cancelado = true;
      taskEmAndamento?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, numeroPagina, marcadores]);

  return (
    <div className="pdf-overlay__pagina" style={tamanho ? { width: tamanho.largura, height: tamanho.altura } : undefined}>
      <canvas ref={canvasRef} className="pdf-overlay__canvas" />
      {retangulos.map((r, i) => (
        <div
          key={i}
          className="pdf-overlay__marcador"
          title={r.titulo}
          style={{
            left: r.left - 3,
            top: r.top - 3,
            width: r.width + 6,
            height: r.height + 6,
            borderColor: r.cor,
            boxShadow: `0 0 0 1px ${r.cor}55`,
          }}
        />
      ))}
    </div>
  );
}

const LEGENDA: { status: StatusChecagem }[] = [
  { status: "Consistente" },
  { status: "Ponto de Atenção" },
  { status: "Inconsistência" },
  { status: "Não Verificável" },
];

function useDocumentoPdf(arquivo: File | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!arquivo) {
      setDoc(null);
      return;
    }
    let cancelado = false;
    setDoc(null);
    setErro(null);
    filaCarregarDocumento(async () => {
      if (cancelado) return;
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      if (cancelado) return;
      const carregado = await pdfjsLib.getDocument({ data: bytes }).promise;
      if (!cancelado) setDoc(carregado);
    }).catch((e) => {
      console.error(e);
      if (!cancelado) setErro("Não foi possível carregar esse PDF pra visualização.");
    });
    return () => {
      cancelado = true;
    };
  }, [arquivo]);

  return { doc, erro };
}

function ColunaDocumento({
  titulo,
  doc,
  erro,
  marcadores,
  lado,
}: {
  titulo: string;
  doc: PDFDocumentProxy | null;
  erro: string | null;
  marcadores: Marcador[];
  lado: LadoDocumento;
}) {
  return (
    <div className="pdf-overlay__coluna">
      <h3 className="pdf-overlay__coluna-titulo">{titulo}</h3>
      {erro && <p className="erro-msg">{erro}</p>}
      {!doc && !erro && <p className="pdf-overlay__carregando">Carregando PDF…</p>}
      {doc && (
        <div className="pdf-overlay__paginas">
          {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((p) => (
            <PaginaComMarcadores key={`${lado}-${p}`} doc={doc} numeroPagina={p} marcadores={marcadores} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PdfOverlayViewer({
  rdeFile,
  memFile,
  posicoesRde,
  posicoesMemorial,
  areasRde,
  checks,
}: {
  rdeFile: File;
  memFile: File;
  posicoesRde: Record<string, CampoPosicao> | undefined;
  posicoesMemorial: Record<string, CampoPosicao> | undefined;
  areasRde: Record<string, CampoPosicao[]> | undefined;
  checks: ComparisonCheck[];
}) {
  const { doc: rdeDoc, erro: rdeErro } = useDocumentoPdf(rdeFile);
  const { doc: memDoc, erro: memErro } = useDocumentoPdf(memFile);

  // Memoizados pra manter a MESMA referência de array entre re-renders que
  // não mudaram checks/posições — sem isso, cada render do pai recria os
  // arrays e reaciona o efeito de render em CADA página (ver
  // PaginaComMarcadores), arriscando 2 `render()` concorrentes no mesmo canvas.
  const marcadoresRde = useMemo(() => {
    return [...construirMarcadores("rde", posicoesRde, checks), ...construirMarcadoresDeArea(areasRde, checks)];
  }, [posicoesRde, areasRde, checks]);
  const marcadoresMemorial = useMemo(() => construirMarcadores("memorial", posicoesMemorial, checks), [posicoesMemorial, checks]);

  return (
    <div className="pdf-overlay">
      <div className="pdf-overlay__barra">
        <div className="pdf-overlay__legenda">
          {LEGENDA.map((it) => (
            <span key={it.status} className="pdf-overlay__legenda-item">
              <span className="pdf-overlay__legenda-dot" style={{ background: COR_SOLIDA[it.status] }} />
              {it.status}
            </span>
          ))}
        </div>
      </div>

      <div className="pdf-overlay__colunas">
        <ColunaDocumento titulo="RDE" doc={rdeDoc} erro={rdeErro} marcadores={marcadoresRde} lado="rde" />
        <ColunaDocumento titulo="Memorial de Cálculo" doc={memDoc} erro={memErro} marcadores={marcadoresMemorial} lado="memorial" />
      </div>
    </div>
  );
}
