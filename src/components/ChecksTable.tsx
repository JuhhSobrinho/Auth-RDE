import { useMemo, useState } from "react";
import type { ComparisonCheck, StatusChecagem } from "../types";
import { StatusBadge, StatusDot } from "./StatusBadge";

const TODOS_STATUS: StatusChecagem[] = ["Inconsistência", "Ponto de Atenção", "Não Verificável", "Consistente"];

// Por padrão só os pontos que precisam de atenção já vêm abertos — o resto
// (Consistente / Não Verificável) fica recolhido numa linha só, pra não
// precisar rolar a tela inteira pra achar o que importa.
const ABERTO_POR_PADRAO: Set<StatusChecagem> = new Set(["Inconsistência", "Ponto de Atenção"]);

export function ChecksTable({ checks }: { checks: ComparisonCheck[] }) {
  const [filtro, setFiltro] = useState<Set<StatusChecagem>>(new Set(TODOS_STATUS));
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(checks.filter((c) => ABERTO_POR_PADRAO.has(c.status)).map((c) => c.id)));

  function alternarFiltro(status: StatusChecagem) {
    setFiltro((atual) => {
      const novo = new Set(atual);
      if (novo.has(status)) novo.delete(status);
      else novo.add(status);
      return novo;
    });
  }

  function alternarAberto(id: string) {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const categorias = useMemo(() => {
    const mapa = new Map<string, ComparisonCheck[]>();
    for (const c of checks) {
      if (!filtro.has(c.status)) continue;
      if (!mapa.has(c.categoria)) mapa.set(c.categoria, []);
      mapa.get(c.categoria)!.push(c);
    }
    return mapa;
  }, [checks, filtro]);

  const idsVisiveis = useMemo(() => [...categorias.values()].flat().map((c) => c.id), [categorias]);
  const todosAbertos = idsVisiveis.length > 0 && idsVisiveis.every((id) => abertos.has(id));

  function alternarTodos() {
    setAbertos((atual) => {
      if (todosAbertos) {
        const novo = new Set(atual);
        for (const id of idsVisiveis) novo.delete(id);
        return novo;
      }
      return new Set([...atual, ...idsVisiveis]);
    });
  }

  return (
    <div className="checks">
      <div className="checks__filtros">
        <span className="checks__filtros-label">Mostrar:</span>
        {TODOS_STATUS.map((status) => (
          <button
            key={status}
            type="button"
            className={`checks__filtro-btn${filtro.has(status) ? " ativo" : ""}`}
            onClick={() => alternarFiltro(status)}
          >
            <StatusBadge status={status} />
          </button>
        ))}
        <button type="button" className="checks__alternar-todos" onClick={alternarTodos}>
          {todosAbertos ? "Recolher tudo" : "Expandir tudo"}
        </button>
      </div>

      {categorias.size === 0 && <p className="checks__vazio">Nenhum item para os filtros selecionados.</p>}

      {[...categorias.entries()].map(([categoria, items]) => (
        <section key={categoria} className="checks__categoria">
          <h3>{categoria}</h3>
          <div className="checks__lista">
            {items.map((c) => {
              const aberto = abertos.has(c.id);
              return (
                <article key={c.id} className={`check-row check-row--${slug(c.status)}${aberto ? " check-row--aberto" : ""}`}>
                  <button type="button" className="check-row__cabecalho" onClick={() => alternarAberto(c.id)} aria-expanded={aberto}>
                    <StatusDot status={c.status} />
                    <span className="check-row__descricao">{c.descricao}</span>
                    {!aberto && (
                      <span className="check-row__resumo">
                        {c.valorRde || "—"} <span className="check-row__seta">→</span> {c.valorMemorial || "—"}
                      </span>
                    )}
                    <span className="check-row__chevron">{aberto ? "▾" : "▸"}</span>
                  </button>
                  {aberto && (
                    <div className="check-row__detalhe">
                      <div className="check-card__valores">
                        <div>
                          <span className="check-card__rotulo">RDE</span>
                          <span className="check-card__valor">{c.valorRde || "—"}</span>
                        </div>
                        <div>
                          <span className="check-card__rotulo">Memorial</span>
                          <span className="check-card__valor">{c.valorMemorial || "—"}</span>
                        </div>
                      </div>
                      {c.explicacao && <p className="check-card__explicacao">{c.explicacao}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function slug(status: StatusChecagem): string {
  return status
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}
