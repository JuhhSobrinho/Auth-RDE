// Configuração do pdfjs-dist pro build de navegador (Vite). O worker precisa
// ser resolvido como URL de asset — sem isso, pdfjs tenta buscar o worker
// relativo à origem e falha silenciosamente (ou trava) no browser.

// A partir da v5.5, `pdfjs-dist` passou a usar internamente
// `Map.prototype.getOrInsertComputed` — um método bem recente (proposta TC39
// ainda em estágio inicial) que só chegou aos motores JS em versões de
// navegador bem novas. Num ambiente corporativo (Chrome/Edge gerenciado, sem
// atualização automática — como no caso de uso deste app) é bem provável que
// o usuário esteja numa versão sem esse método — nesse caso QUALQUER
// `page.render()` (usado na visualização em PDF) quebra com
// "getOrInsertComputed is not a function", mesmo a extração de texto
// continuando a funcionar normalmente (ela não usa esse método). Por isso o
// `package.json` fixa `pdfjs-dist` em `5.4.624` (a última versão antes dessa
// dependência) — NÃO trocar por `^5.4.624`/atualizar sem checar de novo se a
// versão nova introduziu esse método (ver histórico desta seção). O polyfill
// abaixo é uma segunda camada de proteção pro código que roda na thread
// principal, caso uma dependência futura (ou uma versão nova do pdfjs, se
// alguém atualizar sem notar este comentário) volte a usar esse método —
// não cobre o Worker do pdfjs (contexto isolado, não tem acesso a este
// polyfill), então NÃO substitui o pin de versão acima.
if (typeof Map !== "undefined" && !(Map.prototype as { getOrInsertComputed?: unknown }).getOrInsertComputed) {
  Object.defineProperty(Map.prototype, "getOrInsertComputed", {
    value: function (this: Map<unknown, unknown>, key: unknown, callback: (key: unknown) => unknown) {
      if (this.has(key)) return this.get(key);
      const valor = callback(key);
      this.set(key, valor);
      return valor;
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };
