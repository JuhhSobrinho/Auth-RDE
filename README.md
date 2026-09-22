# Verificador RDE

Ferramenta web para conferência automática entre o **RDE** (Relatório de Execução de Serviço, formulário "Reparo por Compósito" da TISI/TEAM) e o **Memorial de Cálculo** (Composite Repair Specification / Composite Design Assessment, base ISO 24817), usado no reparo compósito de tubulações.

## O que faz

1. Você seleciona os dois PDFs: o RDE (versão nativa do formulário, antes da digitalização/assinatura) e o Memorial de Cálculo.
2. O app extrai os dados de cada documento **usando bibliotecas de leitura de PDF** (`pdf-lib` para campos de formulário/AcroForm, `pdfjs-dist` para texto/layout) — sem IA, sem upload para servidor.
3. Um motor de regras compara os dois conjuntos de dados e classifica cada ponto em:
   - **Consistente** — os valores batem e a informação está completa.
   - **Ponto de Atenção** — tecnicamente passa, mas a informação está incompleta ou ambígua (ex: geometria compatível mas parcialmente divergente).
   - **Inconsistência** — os valores realmente divergem.
   - **Não Verificável** — falta dado em um dos dois documentos para comparar.
4. O resultado é mostrado na tela, agrupado por categoria (identificação, condições de projeto, sistema de reparo, geometria, comprimento, condições de aplicação, evidência fotográfica).

Tudo roda no navegador — nada é enviado a um servidor nem persistido. Cada verificação é independente (não há histórico salvo nesta fase).

O catálogo completo de regras de comparação, com o racional de cada uma, está em [`docs/regras-de-comparacao.md`](./docs/regras-de-comparacao.md).

## Escopo atual (MVP) vs. próximos passos

- A extração é 100% via biblioteca. Leitura assistida por IA do *conteúdo* das fotos anexadas ao RDE (ex.: confirmar visualmente a geometria da linha) é uma evolução de Fase 2, deliberadamente fora deste MVP.
- A checagem fotográfica hoje é de **presença** (existe uma foto grande o suficiente no slot esperado?), não de conteúdo.
- A tabela "Materiais Utilizados" do RDE ainda não é extraída linha a linha.
- Persistência (Supabase ou similar) foi deixada de fora de propósito — o foco agora é verificação pontual, não histórico/auditoria de quem revisou.

## Rodando localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## Testando a extração/comparação isoladamente

`scripts/test-e2e.ts` roda o pipeline completo (extração do RDE + extração do memorial + comparação) fora do navegador, útil para depurar regras ou parsers com um PDF de exemplo:

```bash
npx tsx scripts/test-e2e.ts caminho/do/rde.pdf caminho/do/memorial.pdf
```

Nunca commitar PDFs reais de cliente neste repositório — use arquivos de exemplo fora do controle de versão para esse teste.
