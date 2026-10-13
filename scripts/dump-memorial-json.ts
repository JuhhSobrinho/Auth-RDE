import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractMemorial } from "../src/lib/extraction/extractMemorial";

const [, , memPath] = process.argv;
async function main() {
  const bytes = new Uint8Array(fs.readFileSync(memPath));
  const mem = await extractMemorial(pdfjsLib, bytes);
  const { posicoesCampos, ...resto } = mem as any;
  console.log(JSON.stringify(resto, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
