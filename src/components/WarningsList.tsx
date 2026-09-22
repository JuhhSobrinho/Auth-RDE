import type { ExtracaoInfo } from "../types";

const METODO_LABEL: Record<ExtracaoInfo["metodo"], string> = {
  acroform: "formulário PDF (AcroForm) — extração confiável",
  "text-layout": "texto do PDF — extração por padrão de layout",
  nenhum: "nenhum texto ou formulário extraível — revisão manual necessária",
};

export function WarningsList({
  titulo,
  extracao,
}: {
  titulo: string;
  extracao: ExtracaoInfo;
}) {
  if (extracao.avisos.length === 0 && extracao.metodo !== "nenhum") return null;
  return (
    <div className="warnings-list">
      <div className="warnings-list__cabecalho">
        <strong>{titulo}</strong>
        <span className="warnings-list__metodo">Método: {METODO_LABEL[extracao.metodo]}</span>
      </div>
      {extracao.avisos.length > 0 && (
        <ul>
          {extracao.avisos.map((aviso, i) => (
            <li key={i}>{aviso}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
