import type { StatusChecagem } from "../types";
import { COR_BADGE, COR_SOLIDA } from "../lib/statusColors";

export function StatusBadge({ status }: { status: StatusChecagem }) {
  const cor = COR_BADGE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: cor.bg,
        color: cor.fg,
        border: `1px solid ${cor.borda}`,
      }}
    >
      {status}
    </span>
  );
}

export function StatusDot({ status }: { status: StatusChecagem }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: COR_SOLIDA[status],
        flexShrink: 0,
      }}
    />
  );
}
