import { useRef, useState } from "react";

interface Props {
  titulo: string;
  descricao: string;
  arquivo: File | null;
  onArquivo: (file: File | null) => void;
}

export function FileDropInput({ titulo, descricao, arquivo, onArquivo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function aceitarArquivo(file: File | undefined | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Selecione um arquivo PDF.");
      return;
    }
    onArquivo(file);
  }

  return (
    <div
      className={`file-drop${arrastando ? " file-drop--ativo" : ""}${arquivo ? " file-drop--preenchido" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        aceitarArquivo(e.dataTransfer.files?.[0]);
      }}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => aceitarArquivo(e.target.files?.[0])}
      />
      <div className="file-drop__titulo">{titulo}</div>
      {arquivo ? (
        <div className="file-drop__arquivo">
          <span className="file-drop__nome" title={arquivo.name}>
            📄 {arquivo.name}
          </span>
          <span className="file-drop__tamanho">{(arquivo.size / 1024).toFixed(0)} KB</span>
          <button
            type="button"
            className="file-drop__remover"
            onClick={(e) => {
              e.stopPropagation();
              onArquivo(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remover
          </button>
        </div>
      ) : (
        <>
          <div className="file-drop__descricao">{descricao}</div>
          <div className="file-drop__dica">Arraste o PDF aqui ou clique para selecionar</div>
        </>
      )}
    </div>
  );
}
