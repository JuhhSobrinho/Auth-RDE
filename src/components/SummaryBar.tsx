import type { StatusChecagem } from "../types";
import { StatusBadge } from "./StatusBadge";

const ORDEM: StatusChecagem[] = ["Inconsistência", "Ponto de Atenção", "Não Verificável", "Consistente"];

export function SummaryBar({ resumo }: { resumo: Record<StatusChecagem, number> }) {
  return (
    <div className="summary-bar">
      {ORDEM.map((status) => (
        <div key={status} className="summary-bar__item">
          <StatusBadge status={status} />
          <span className="summary-bar__contador">{resumo[status] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
