import type { StatusChecagem } from "../types";

// Paleta única de cor por status, usada em todo canto que precisa representar
// status visualmente — bolinha/badge na lista de checagens, borda do card, e
// os quadrados sobre o PDF na visualização de documento. Mantida em sync "no
// olho" com as cores de borda em App.css (.check-card--*); se mudar aqui,
// mudar lá também.
export const COR_SOLIDA: Record<StatusChecagem, string> = {
  "Inconsistência": "#d9534f",
  "Ponto de Atenção": "#e0a800",
  "Não Verificável": "#9aa3af",
  "Consistente": "#3fa564",
};

export const COR_BADGE: Record<StatusChecagem, { bg: string; fg: string; borda: string }> = {
  "Consistente": { bg: "#e7f6ec", fg: "#186a3b", borda: "#a6dfb8" },
  "Ponto de Atenção": { bg: "#fff6e0", fg: "#8a5a00", borda: "#f0d48a" },
  "Inconsistência": { bg: "#fdecec", fg: "#a11e1e", borda: "#f2b8b8" },
  "Não Verificável": { bg: "#eef0f3", fg: "#4a5568", borda: "#d3d8e0" },
};
