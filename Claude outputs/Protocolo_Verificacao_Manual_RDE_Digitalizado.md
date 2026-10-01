# Protocolo de Verificação Manual — RDEs Digitalizados (Reparo por Compósito)

Este documento é o "cérebro" de um novo Projeto do Claude dedicado a verificar RDEs
que chegam **digitalizados/escaneados** (foto ou scan achatado em imagem, sem
AcroForm nem camada de texto) — o caso que o site **Verificador RDE**
(`verificador-rde`, 100% client-side) não consegue processar sozinho, porque não há
texto nem campo de formulário pra extrair algoritmicamente. Aqui, quem lê a imagem
e aplica a lógica de comparação sou eu, olhando o RDE e o Memorial de Cálculo
diretamente.

A lista de itens, as tolerâncias e as regras de equivalência abaixo foram
extraídas diretamente do código do Verificador RDE (`compare.ts`,
`rdeLabels.ts`, `memorialLabels.ts`, `units.ts`), pra que a checagem manual
produza exatamente o mesmo resultado que o site produziria se conseguisse ler
o PDF.

---

## 1. Como configurar o novo Projeto

1. No app do Claude, crie um Projeto novo — sugestão de nome:
   **"Verificador RDE — Leitura Manual (Digitalizados)"**.
2. Cole o texto da **Seção 2** abaixo no campo "Instruções do projeto".
3. Faça upload deste arquivo inteiro como arquivo do projeto (conhecimento) —
   assim, mesmo em uma conversa nova, eu tenho a lista de itens e as
   tolerâncias sempre à mão, sem depender só do texto das instruções (que tem
   limite de tamanho).
4. (Opcional, mas recomendado) suba também 1 Memorial de Cálculo de exemplo e
   1 RDE digitalizado de exemplo já conferidos por você, pra eu calibrar a
   leitura do layout antes de valer pra casos reais.
5. Sempre que precisar verificar um RDE escaneado: abra uma conversa dentro
   desse Projeto, anexe (a) a imagem/PDF do RDE digitalizado e (b) o PDF do
   Memorial de Cálculo correspondente, e peça algo como "verifique este RDE
   contra o memorial". Eu sigo o protocolo da Seção 3 e devolvo a tabela no
   formato da Seção 4.

---

## 2. Texto para colar em "Instruções do projeto"

```
Você verifica RDEs (Relatório de Execução de Serviço — Reparo por Compósito,
TISI do Brasil/TEAM Industrial Services) digitalizados/escaneados contra o
respectivo Memorial de Cálculo (ISO 24817), lendo as imagens diretamente
(o RDE não tem texto nem formulário extraível por código).

Use como referência o arquivo "Protocolo_Verificacao_Manual_RDE_Digitalizado.md"
anexado a este projeto: ele lista cada item a comparar, onde encontrar o dado em
cada documento, as tolerâncias numéricas e as regras de equivalência (ex.
sinônimos de material/conteúdo da linha, códigos de cura/fibra da resina).

Sempre devolva o resultado como uma tabela com as colunas: Categoria | Item |
RDE | Memorial | Status | Explicação — usando SEMPRE um destes 4 status:
Consistente, Ponto de Atenção, Inconsistência, Não Verificável (ver Seção 4 do
protocolo pro significado de cada um).

Quando a letra manuscrita ou um checkbox estiver ambíguo/ilegível na imagem,
não adivinhe: marque como Não Verificável e diga explicitamente o que não deu
pra ler com confiança, pra o revisor confirmar visualmente.
```

---

## 3. Protocolo de verificação — item a item

### Como ler cada documento

**RDE (template "Reparo por Compósito", TISI/TEAM)** — rótulos exatos a
procurar na imagem (o valor normalmente vem escrito à mão ou datilografado
logo depois do rótulo):

| Campo | Rótulo no RDE |
|---|---|
| Cliente | `Cliente:` |
| Local | `Local:` |
| OS Team | `OS Team:` |
| Emitido por | `Emitido por:` |
| Revisado por | `Revisado por:` |
| Diâmetro da linha | `Diâmetro da Linha:` |
| TAG da linha | `TAG da Linha:` |
| Material da linha | `Material Fab, da LInha:` (sic, erro de digitação do próprio template) |
| Conteúdo da linha | `Conteúdo da Linha:` |
| Pressão de projeto | `Pressão de Projeto:` |
| Temperatura de projeto | `Temperatura de Projeto:` |
| Pressão de operação | `Pressão de Operação:` |
| Temperatura de operação | `Temperatura de Operação:` |
| Comprimento do reparo | `Comprimento Reparo:` |
| Número de camadas | `Número de Camadas:` |
| Espessura do reparo | `Espessura Rep.:` |
| Comprimento PFP aplicado | `Comprimento PFP aplicado:` |
| Espessura PFP aplicada | `Espessura PFP aplicada:` |
| Furo na linha | `Furo na Linha:` — checkbox `( ) SIM` / `( ) NÃO` |
| Temperatura ambiente | `Temperatura Ambiente:` |
| Ponto de orvalho | `Temp. Ponto de Orvalho:` |
| Temperatura de superfície | `Temperatura Superfície:` |
| Umidade relativa | `Umidade Relativa:` |
| Rugosidade da superfície | `Rugosidade Superfície:` |
| Tipo do Reparo marcado | seção "Tipo do Reparo" — checkbox entre: `TFCR ST-QE`, `TFCR HT-QE`, `TFCR UT-QE`, `TFCR ST-QC`, `TFCR HT-QC`, `TFCR UT-QC`, `TFCR ST-BC`, `TFCR HT-BC`, `TFCR UT-BC` |
| PFP marcado | seção "Tipo do Reparo" — checkbox entre: `JOTACHAR JF750 XT`, `JOTACHAR JF750`, `FIRETEX - M90/2`, `CHARTEK 7E`, `CONTRAFLEX PFP` |
| Geometria marcada | seção "Geometria do Reparo" — checkbox entre: `FLANGE`, `VÁLVULA`, `T. RETO`, `CURVA 45°`, `CURVA 90°`, `TEE`, `REDUÇÃO`, `TANQUE`, `OUTROS` |
| Materiais utilizados | tabela "Item / Qtd. / Descrição (Resina; F.Vidro; F.Carbono; etc)" |
| Resumo das atividades | seção "Resumo das Atividades" (texto livre) |
| Fotos | seção "Fotos da Execução" — 3 slots esperados: "Antes da Execução do Serviço", "Após Execução do Serviço", "Após Aplicação de PPCI" (esse último só se o RDE declarar atividade de PFP) |

**Memorial de Cálculo (ISO 24817 — Composite Repair Specification + Composite
Design Assessment, normalmente em inglês)** — rótulos exatos:

| Campo | Rótulo no Memorial |
|---|---|
| Operador/Cliente | `Operator:` |
| Local | `Location:` |
| Line ID / TAG | `Line Identity:` (ou, se ausente, `Equipment / Line ID:`) |
| Project ID (↔ OS Team) | `Project ID:` |
| Engineering ID (↔ Referência de engenharia do RDE) | `Engineering ID:` |
| Diâmetro da linha | `Line Diameter:` (em mm, OD real medido) |
| Material da linha | `Line Material:` |
| Conteúdo da linha | `Line Contents:` |
| Pressão de projeto do reparo | `Repair Design Pressure:` |
| Pressão de operação | `Operating Pressure:` |
| Temperatura de operação (máx.) | `Maximum Operating Temperature:` |
| Temperatura de projeto (máx., do laminado) | `Maximum Design Temperature:` — **atenção:** existe mais de uma "temperatura de projeto" no memorial com propósitos diferentes (sistema/linha vs. laminado/reparo); ver regra de downgrade abaixo |
| Sistema de reparo | `Repair System:` (ex. `FCR-BC-HT`) |
| Comprimento de reparo exigido | `Customer specified repair length:` (ou, se ausente, `Length Requested / Required:`) |
| Overlap exigido | `Required Overlap:` |
| Nº de camadas (reto/curva) | quadro "Design Basis Summary" — procurar `Straight N layers` e `Elbow(s) N layers` |
| Tipo de defeito | `Defect Type:` (seção "INPUTS - DEFECT DETAILS") — ex. `Perforation/Leak`, dano mecânico, desgaste externo etc. |
| Furo/passante (reforço) | quadro "Design Basis Summary", 1ª página: linha `Type B Basis:` — se vier **vazia**, defeito NÃO é passante; se vier preenchida com método + nº de equação (ex. "Circumferential Slot 13, 14"), defeito É passante. `Type A Basis: Reference Equations` sempre aparece preenchido, não serve de sinal. |
| Temperatura mín./máx. de instalação | `Minimum Installation Surface Temperature:` / `Maximum Installation Surface Temperature:` (ou variante `Minimum Allowable Installation Temperature:` / `Maximum Installation Temperature:`) |
| Limite de umidade | frase tipo `Humidity < NN%` |

### A. Identificação e rastreabilidade

| Item | Regra |
|---|---|
| Cliente / Operador | RDE `Cliente:` vs. Memorial `Operator:` — igualdade de texto (ignorar acento/caixa/pontuação). Divergiu → **Inconsistência**. Faltou de um lado → **Não Verificável**. |
| Local | RDE `Local:` vs. Memorial `Location:` — mesma regra acima. |
| TAG da linha / Line Identity | RDE `TAG da Linha:` vs. Memorial `Line Identity:` (ou `Equipment / Line ID:`). Se divergir, mas o texto do RDE tiver um sufixo de ponto de campanha tipo `(P9)`, `(PT 9)`, `(PONTO 9)` no final, e a TAG **sem esse sufixo** bater com o memorial → **Ponto de Atenção** (não Inconsistência) — é a mesma linha, só um ponto diferente de uma campanha multi-ponto; peça só confirmação de que o ponto citado é o do serviço executado. Sem esse padrão, divergência real → **Inconsistência**. |
| OS Team / Project ID | RDE `OS Team:` vs. Memorial `Project ID:` — igualdade de texto. |
| Referência de engenharia | RDE campo de referência de engenharia vs. Memorial `Engineering ID:` — igualdade de texto; divergência sempre **Inconsistência** (não tem downgrade). |
| Emitido por | Só presença no RDE (`Emitido por:` preenchido) — não tem correspondente no memorial. Preenchido → Consistente. Vazio → **Ponto de Atenção**. |
| Revisado por | Mesma lógica de "Emitido por", com `Revisado por:`. |
| Resumo das Atividades revisado | Preenchido → Consistente (e você já deve ter conferido, junto com o texto, PFP citado e referência de engenharia mencionados nele contra o resto do RDE). Vazio → **Ponto de Atenção**. |

### B. Condições de projeto e operação

| Item | Regra |
|---|---|
| Diâmetro da linha (OD) | RDE vem em bitola nominal (NPS, polegadas); converta pra OD padrão em mm usando a tabela: 1/2"=21,3 · 3/4"=26,7 · 1"=33,4 · 1¼"=42,2 · 1½"=48,3 · 2"=60,3 · 2½"=73,0 · 3"=88,9 · 4"=114,3 · 5"=141,3 · 6"=168,3 · 8"=219,1 · 10"=273,0 · 12"=323,8 · 14"=355,6 · 16"=406,4 · 18"=457,0 · 20"=508,0 · 24"=610,0. Compare contra `Line Diameter:` do memorial (mm) com **tolerância absoluta de 3mm**. Bitola fora da tabela ou dado ausente → **Não Verificável**. |
| Material da linha | RDE `Material Fab, da LInha:` vs. Memorial `Line Material:` — aceitar como equivalentes (mesmo material, idiomas diferentes): Aço Carbono ↔ Carbon Steel · Aço Inox/Inoxidável ↔ Stainless Steel · Ferro Fundido ↔ Cast Iron · Aço Liga ↔ Alloy Steel · Aço Galvanizado ↔ Galvanized Steel · Cobre ↔ Copper · Fibra de Vidro/Fiberglass ↔ GRP · Alumínio ↔ Aluminum/Aluminium. Fora dessa lista, comparar texto exato. Divergência real → **Inconsistência**. |
| Conteúdo da linha | RDE `Conteúdo da Linha:` vs. Memorial `Line Contents:` — mesma lógica de sinônimos: Gás Combustível ↔ Fuel Gas · Gás Natural ↔ Natural Gas · Gás de Processo ↔ Process Gas · Gás Ácido ↔ Sour Gas · Óleo Cru ↔ Crude Oil · Óleo ↔ Oil · Água ↔ Water · Água Produzida ↔ Produced Water · Hidrocarboneto(s) ↔ Hydrocarbon(s) · GLP ↔ LPG · Condensado ↔ Condensate · Vapor ↔ Steam · Ar Comprimido ↔ Compressed Air · Nitrogênio ↔ Nitrogen. Divergência aqui é mais branda: **Ponto de Atenção** (não Inconsistência). |
| Pressão de projeto | RDE `Pressão de Projeto:` vs. Memorial `Repair Design Pressure:`, ambos convertidos pra **bar** (kPa÷100; kgf/cm²×0,980665; sem unidade reconhecida assume já estar em bar). **Tolerância absoluta 0,1 bar**. |
| Pressão de operação | RDE `Pressão de Operação:` vs. Memorial `Operating Pressure:`, mesma conversão/tolerância (0,1 bar). |
| Temperatura de operação | RDE `Temperatura de Operação:` vs. Memorial `Maximum Operating Temperature:` (°C). **Tolerância absoluta 1°C**. |
| Temperatura de projeto | RDE `Temperatura de Projeto:` vs. Memorial `Maximum Design Temperature:` (°C), tolerância 1°C — **mas se divergir, o status correto é Ponto de Atenção, não Inconsistência**: o memorial tem duas "temperaturas de projeto" com propósitos diferentes (sistema/linha vs. laminado/reparo) e o RDE pode estar refletindo a outra; peça confirmação manual antes de tratar como erro real. |
| Furo na linha | RDE `Furo na Linha:` (SIM/NÃO) vs. Memorial: primeiro olhe `Defect Type:` — se contiver algo como "Perforation", "Leak", "Through-wall" ou "passante" → há furo; outros tipos (dano mecânico, desgaste externo etc.) → sem furo. Se `Defect Type:` não for conclusivo, use como reforço a linha `Type B Basis:` no quadro "Design Basis Summary": preenchida com método+equação → há furo; vazia → sem furo. Divergência entre RDE e memorial → **Inconsistência**. Se nenhum dos dois documentos permitir concluir com segurança → **Não Verificável**. |

### C. Sistema de reparo (material e camadas)

| Item | Regra |
|---|---|
| Sistema/material do reparo | RDE marca um código tipo `TFCR ST-BC` (prefixo do template + cura + fibra); Memorial descreve como `FCR-BC-HT` (fibra+cura, sem o "T"). Prefixo e ordem não importam — extraia os códigos de cura (`ST`/`HT`/`UT`) e fibra (`QE`/`QC`/`BC`) de cada lado e compare como **conjunto**: mesmo conjunto de códigos → Consistente, mesmo com grafia/ordem diferente. Conjunto diferente → **Inconsistência**. |
| Resina na lista de materiais vs. Tipo do Reparo marcado | Procure na tabela "Materiais Utilizados" do RDE alguma descrição de item que cite um código de cura (`ST`/`HT`/`UT`) — ex. "RESINA HT". Se encontrar, e o "Tipo do Reparo" marcado também tiver um código de cura reconhecível, compare os dois: batendo → Consistente; divergindo → **Inconsistência** (confirmar qual resina foi realmente aplicada). Se a lista de materiais não citar nenhum código de cura, esse item nem entra na tabela (não é "Não Verificável", simplesmente não há o que comparar). **Atenção**: aqui as duas colunas da tabela de saída são "Materiais Utilizados" (RDE) e "Tipo do Reparo marcado" (também do RDE) — não é RDE vs. Memorial. |
| PFP citado no resumo vs. marcado no Tipo do Reparo | Só entra quando o "Resumo das Atividades" cita um PRODUTO específico de PFP pelo nome (ex. "Jotachar JF750"). Uma menção genérica ("aplicação de PFP"/"PPCI" sem nome) não conta. Se citar produto específico: bate com o(s) PFP(s) marcado(s) na seção "Tipo do Reparo" → Consistente; não bate → **Inconsistência**. |
| Número de camadas | RDE `Número de Camadas:` vs. o mínimo exigido pelo memorial = maior valor entre `Straight N layers` e `Elbow(s) N layers` do quadro "Design Basis Summary". RDE ≥ mínimo → Consistente. RDE < mínimo → **Inconsistência**. Dado ausente em algum lado → **Não Verificável**. |
| Espessura aplicada vs. calculada (camadas × resina) | Checagem **interna do próprio RDE** (não usa o memorial): espessura teórica = nº de camadas × espessura de 1 camada, onde a espessura por camada depende só da cura marcada — **ST = 1,08mm/camada, HT = 1,14mm/camada** (UT ainda não tem valor de referência: fica Não Verificável). Compare `Espessura Rep.:` do RDE contra esse valor calculado, **tolerância percentual de 10%**. Serve tanto pra detectar sub-aplicação quanto erro de digitação em camadas/resina/espessura. |
| Espessura do PFP aplicado vs. referência do produto | Só entra se algum PFP foi marcado. Espessura de referência por produto: **JOTACHAR JF750 XT = 5mm, JOTACHAR JF750 = 10mm** (outros produtos ainda não têm referência cadastrada → Não Verificável). Compare `Espessura PFP aplicada:` do RDE contra a referência, **tolerância percentual de 10%**. Mais de um PFP marcado ao mesmo tempo → Não Verificável (não dá pra saber qual referência usar). |

### D. Geometria do reparo

| Item | Regra |
|---|---|
| Geometria marcada tem cálculo correspondente | Veja qual(is) geometria(s) foram marcadas no RDE (`T. RETO`, `CURVA 45°`/`CURVA 90°`, etc.). Se marcou "T. RETO", o memorial precisa ter `Straight N layers` preenchido; se marcou alguma curva, precisa ter `Elbow(s) N layers` preenchido. Geometria marcada sem o cálculo correspondente no memorial → **Inconsistência**. Nenhuma geometria identificável no RDE → **Não Verificável**. |

### E. Comprimento e overlap

| Item | Regra |
|---|---|
| Comprimento aplicado vs. exigido | RDE `Comprimento Reparo:` (mm) vs. Memorial `Customer specified repair length:` (ou `Length Requested / Required:` se o outro faltar). Aplicado ≥ exigido → Consistente. Aplicado < exigido → **Inconsistência** — mas considere que o RDE pode cobrir só um trecho parcial de uma aplicação em múltiplas etapas/RDEs da mesma referência; sinalize isso na explicação em vez de tratar como erro definitivo. Dado ausente → **Não Verificável**. |
| Overlap aplicado | O template de RDE não tem campo dedicado pra registrar o overlap realmente aplicado — este item é sempre **Não Verificável** (mostre o `Required Overlap:` do memorial como referência, já que não há o que comparar do lado do RDE). |

### F. Condições de aplicação

| Item | Regra |
|---|---|
| Temperatura de superfície dentro da faixa | RDE `Temperatura Superfície:` deve estar entre `Minimum Installation Surface Temperature:` e `Maximum Installation Surface Temperature:` do memorial (ou as variantes `Minimum/Maximum Allowable Installation Temperature:`). Dentro → Consistente. Fora → **Inconsistência**. Dado ausente em algum lado → **Não Verificável**. |
| Umidade relativa dentro do limite | RDE `Umidade Relativa:` deve ser **menor que** o limite do memorial (frase tipo "Humidity < NN%"). Dentro → Consistente. Igual ou acima → **Inconsistência**. |
| Ponto de orvalho vs. temperatura de superfície | Se o campo `Temp. Ponto de Orvalho:` do RDE estiver preenchido em **%** em vez de °C, não dá pra checar a margem — sinalize como **Ponto de Atenção** (erro de preenchimento de unidade, não de valor). |
| Rugosidade da superfície preenchida | Só uma checagem de presença: campo `Rugosidade Superfície:` vazio no RDE → **Ponto de Atenção**. |

### G. Evidência fotográfica

| Item | Regra |
|---|---|
| Foto "Antes da Execução" presente | Olhe a seção "Fotos da Execução" / "Antes da Execução do Serviço". Presente → Consistente. Ausente → **Ponto de Atenção**. |
| Foto "Após Execução do Serviço" presente | Mesma seção, slot "Após Execução do Serviço". Presente → Consistente. Ausente → **Inconsistência** (essa é a evidência do reparo em si — mais crítica que a foto de "antes"). |
| Foto "Após Execução de PFP" presente | Só entra se o RDE declarar atividade de PFP (algum PFP marcado no "Tipo do Reparo", ou o Resumo das Atividades citar "PFP"/"PPCI"). Presente → Consistente. Ausente → **Ponto de Atenção**. |

---

## 4. Formato de saída esperado

Sempre devolva uma tabela assim, com uma linha por item do protocolo acima
(pule os itens que "não entram" pelas regras condicionais, como indicado):

| Categoria | Item | RDE | Memorial | Status | Explicação |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

Os 4 status possíveis, e o que cada um significa (mesmo critério do site):

- **Consistente** — os valores batem (ou são reconhecidos como equivalentes).
- **Ponto de Atenção** — não é exatamente um erro, mas merece confirmação
  humana antes de aprovar (ex. campo não preenchido, ambiguidade de leitura,
  caso especial conhecido como o sufixo de ponto de campanha na TAG).
- **Inconsistência** — os valores divergem de forma que parece ser um erro
  real; precisa de correção ou justificativa antes de aprovar o RDE.
- **Não Verificável** — falta dado em um dos dois documentos, ou não foi
  possível ler/converter com segurança (aplica-se bastante aqui, já que a
  leitura é de imagem — checkbox borrado, letra manuscrita ambígua etc.).

No fim, feche com um resumo rápido: quantos itens em cada status, e destaque
em texto corrido quais Inconsistências merecem atenção prioritária antes da
aprovação do RDE.

---

## 5. Cuidados específicos de leitura de imagem (RDE escaneado)

- Checkbox marcado à mão pode vir como "X", "✓", rabisco ou preenchimento
  parcial da caixa — se não estiver claramente marcado, não assuma: reporte
  como Não Verificável e descreva o que viu.
- Letra manuscrita ambígua (números que podem ser lidos de duas formas, por
  exemplo "0" vs "6", vírgula vs. ponto decimal) — peça confirmação em vez de
  arredondar pra o valor mais "provável".
- Fotos deste tipo de RDE já estão fisicamente coladas/impressas na página —
  a presença é sempre visual (não há mais o que "detectar" algoritmicamente
  como no PDF nativo); mas ainda vale registrar se a foto realmente mostra o
  que o slot pede (antes/depois/PFP), não só se há alguma imagem ali.
- Quando a digitalização cortar, ofuscar ou tornar ilegível um campo inteiro,
  não tente inferir pelo contexto — declare Não Verificável e diga
  exatamente qual campo/seção não deu pra ler.
