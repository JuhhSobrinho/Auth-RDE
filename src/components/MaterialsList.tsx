import type { MaterialUtilizadoItem } from "../types";

/**
 * Lista informativa dos materiais lidos na seção "Materiais Utilizados" do
 * RDE. Não é uma checagem (não há requisito equivalente no memorial pra
 * cruzar item a item) — é só visibilidade do que foi extraído, já que a
 * extração dessa tabela livre é best-effort (ver src/lib/extraction/materiais.ts).
 */
export function MaterialsList({ itens }: { itens: MaterialUtilizadoItem[] }) {
  if (itens.length === 0) return null;
  return (
    <section className="materials-list">
      <h3>Materiais utilizados (RDE)</h3>
      <ul>
        {itens.map((it, i) => (
          <li key={i}>
            {it.qtd && <strong>{it.qtd}× </strong>}
            {it.descricao}
          </li>
        ))}
      </ul>
      <p className="materials-list__nota">
        Extração best-effort dessa tabela livre — ainda não validada contra um RDE real com essa seção preenchida.
        Confirmar visualmente se houver dúvida.
      </p>
    </section>
  );
}
