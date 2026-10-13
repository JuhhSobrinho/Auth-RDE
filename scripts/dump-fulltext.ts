import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extrairTextoPdf } from "../src/lib/extraction/pdfText";
const [, , p] = process.argv;
const t = await extrairTextoPdf(pdfjsLib, new Uint8Array(fs.readFileSync(p)));
for (const pg of t.paginas) { console.log(`\n######## PÁGINA ${pg.pageIndex} ########`); console.log(pg.fullText); }
