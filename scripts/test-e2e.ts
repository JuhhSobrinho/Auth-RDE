import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractRde } from "../src/lib/extraction/extractRde";
import { extractMemorial } from "../src/lib/extraction/extractMemorial";
import { comparar } from "../src/lib/comparison/compare";

const [, , rdePath, memPath] = process.argv;

async function main() {
  const rdeBytes = new Uint8Array(fs.readFileSync(rdePath));
  const memBytes = new Uint8Array(fs.readFileSync(memPath));

  const rde = await extractRde(pdfjsLib, rdeBytes);
  const memorial = await extractMemorial(pdfjsLib, memBytes);

  console.log("\n=== RDE extraído ===");
  console.log(JSON.stringify(rde, null, 2));

  console.log("\n=== Memorial extraído ===");
  console.log(JSON.stringify(memorial, null, 2));

  const resultado = comparar(rde, memorial);
  console.log("\n=== Resultado da comparação ===");
  for (const c of resultado.checks) {
    console.log(`[${c.status}] ${c.categoria} — ${c.descricao} :: RDE="${c.valorRde}" MEM="${c.valorMemorial}" — ${c.explicacao}`);
  }
  console.log("\nResumo:", resultado.resumo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
