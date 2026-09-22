import { useState } from "react";
import pkg from "../package.json";
import { FileDropInput } from "./components/FileDropInput";
import { SummaryBar } from "./components/SummaryBar";
import { ChecksTable } from "./components/ChecksTable";
import { WarningsList } from "./components/WarningsList";
import { MaterialsList } from "./components/MaterialsList";
import { PdfOverlayViewer } from "./components/PdfOverlayViewer";
import { verificar, type ResultadoVerificacao } from "./lib/runVerificacao";
import "./App.css";

type Estado = "ocioso" | "processando" | "concluido" | "erro";
type ModoVisualizacao = "resumo" | "documentos";

function App() {
  const [rdeFile, setRdeFile] = useState<File | null>(null);
  const [memFile, setMemFile] = useState<File | null>(null);
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null);
  const [modo, setModo] = useState<ModoVisualizacao>("resumo");

  const podeVerificar = rdeFile !== null && memFile !== null && estado !== "processando";

  async function handleVerificar() {
    if (!rdeFile || !memFile) return;
    setEstado("processando");
    setErro(null);
    try {
      const r = await verificar(rdeFile, memFile);
      setResultado(r);
      setEstado("concluido");
    } catch (e) {
      console.error(e);
      setErro(
        e instanceof Error
          ? `Falha ao processar os PDFs: ${e.message}`
          : "Falha ao processar os PDFs. Verifique se os arquivos não estão corrompidos."
      );
      setEstado("erro");
    }
  }

  function handleNovaVerificacao() {
    setRdeFile(null);
    setMemFile(null);
    setResultado(null);
    setErro(null);
    setEstado("ocioso");
    setModo("resumo");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>
          Verificador RDE <span className="app-header__versao">v{pkg.version}</span>
        </h1>
        <p>
          Conferência automática entre o RDE (Relatório de Execução de Serviço) e o Memorial de Cálculo de reparo
          compósito — geometria, camadas, resina, comprimento, condições de aplicação e evidência fotográfica.
        </p>
      </header>

      {estado !== "concluido" && (
        <section className="upload-section">
          <div className="upload-grid">
            <FileDropInput
              titulo="RDE (Relatório de Execução)"
              descricao="PDF nativo do formulário (Acrobat ou Word→PDF), antes da digitalização/assinatura."
              arquivo={rdeFile}
              onArquivo={setRdeFile}
            />
            <FileDropInput
              titulo="Memorial de Cálculo"
              descricao="Composite Repair Specification / Composite Design Assessment (ISO 24817)."
              arquivo={memFile}
              onArquivo={setMemFile}
            />
          </div>

          <button type="button" className="btn-primario" disabled={!podeVerificar} onClick={handleVerificar}>
            {estado === "processando" ? "Verificando…" : "Verificar consistência"}
          </button>

          {erro && <p className="erro-msg">{erro}</p>}

          <p className="upload-section__nota">
            Nada é enviado a servidores nem salvo — a extração e a comparação rodam inteiramente no seu navegador.
          </p>
        </section>
      )}

      {estado === "concluido" && resultado && (
        <section className="resultado-section">
          <div className="resultado-section__topo">
            <SummaryBar resumo={resultado.comparacao.resumo} />
            <div className="resultado-section__acoes">
              <div className="modo-switch" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={modo === "resumo"}
                  className={`modo-switch__btn${modo === "resumo" ? " ativo" : ""}`}
                  onClick={() => setModo("resumo")}
                >
                  Resumo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={modo === "documentos"}
                  className={`modo-switch__btn${modo === "documentos" ? " ativo" : ""}`}
                  onClick={() => setModo("documentos")}
                >
                  Visualização
                </button>
              </div>
              <button type="button" className="btn-secundario" onClick={handleNovaVerificacao}>
                Nova verificação
              </button>
            </div>
          </div>

          {modo === "resumo" && (
            <>
              <WarningsList titulo="Avisos de extração — RDE" extracao={resultado.rde.extracao} />
              <WarningsList titulo="Avisos de extração — Memorial" extracao={resultado.memorial.extracao} />

              <MaterialsList itens={resultado.rde.materiaisUtilizados} />

              <ChecksTable checks={resultado.comparacao.checks} />
            </>
          )}

          {modo === "documentos" && rdeFile && memFile && (
            <PdfOverlayViewer
              rdeFile={rdeFile}
              memFile={memFile}
              posicoesRde={resultado.rde.posicoesCampos}
              posicoesMemorial={resultado.memorial.posicoesCampos}
              areasRde={resultado.rde.posicoesAreas}
              checks={resultado.comparacao.checks}
            />
          )}
        </section>
      )}
    </div>
  );
}

export default App;
