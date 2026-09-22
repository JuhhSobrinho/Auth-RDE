# Catálogo de Regras de Comparação — RDE x Memorial de Cálculo

**Escopo:** RDE (Relatório de Execução de Serviço — Reparo por Compósito) x Memorial de Cálculo (Composite Repair Specification + Composite Design Assessment, base ISO 24817).

**Natureza da ferramenta:** verificação pontual e sem persistência. Cada execução compara um RDE contra o memorial de cálculo da mesma referência de engenharia e devolve um resultado — nada fica salvo entre execuções, e o sistema não tem conhecimento de outros RDEs da mesma obra a menos que sejam informados na mesma consulta.

**Escopo do MVP (decisão atual):** a extração de dados é feita **só por biblioteca** (leitura de AcroForm quando existir, com fallback pra parsing de texto/layout) — **sem API de IA**. Isso cobre todas as regras de A a F abaixo e a checagem de **presença** de foto (regra G). A **leitura assistida do conteúdo da imagem** (interpretar o que a foto mostra, ex. inferir geometria física a partir da foto) fica de fora do MVP e é tratada como Fase 2 — ver observação no fim do documento. RDEs sem nenhum texto extraível (PDF totalmente achatado em imagem) não são cobertos pelo MVP; a extração falha e o item fica marcado como **Não Verificável — revisão manual necessária**, sem chamar IA como fallback por enquanto.

---

## 1. Classificação das constatações

Toda regra abaixo resulta em um destes quatro status:

- **Consistente** — o campo do RDE bate com o memorial (dentro da tolerância definida) e não há informação faltando para essa checagem.
- **Ponto de Atenção** — a checagem passa tecnicamente (o valor está dentro do exigido/tolerado), mas existe uma informação incompleta, ambígua, ausente ou parcial que merece confirmação humana antes de dar o campo como 100% ok. Não é um erro — é algo "correto até certo ponto".
  - Exemplo: RDE marca só "Curva 90°" na geometria, e o número de camadas aplicado (4) atende tanto o requisito de trecho reto quanto de curva do memorial — a checagem numérica passa — mas a foto/relato indicam que o trecho reparado também tem um trecho reto, que não foi marcado. Tecnicamente não falhou (camadas corretas), mas a documentação da geometria está incompleta.
- **Inconsistência** — o campo do RDE realmente diverge do exigido pelo memorial, ou contradiz o próprio RDE. É um ponto errado, não apenas incompleto.
  - Exemplo: comprimento de reparo aplicado (1000 mm) muito abaixo do comprimento mínimo exigido pelo cálculo (8160 mm), sem nenhuma informação no RDE de que se trata de um trecho parcial de uma aplicação em múltiplas etapas.
- **Não Verificável** — o memorial não define parâmetro equivalente para aquele campo do RDE (ou vice-versa), então a checagem não pode ser feita. Não é nem consistente nem inconsistente — é fora do escopo do cálculo.

Regra geral de decisão: primeiro verifica-se se o dado necessário existe nos dois documentos. Se faltar em um dos dois → **Não Verificável**. Se existir nos dois: compara-se o valor. Se bate dentro da tolerância **e** a informação está completa → **Consistente**. Se bate dentro da tolerância **mas** há uma lacuna, ambiguidade ou dado parcial associado → **Ponto de Atenção**. Se não bate → **Inconsistência**.

---

## 2. Catálogo de regras

### A. Identificação e rastreabilidade

| Regra | Campo RDE | Campo Memorial | Lógica | Severidade se divergir |
|---|---|---|---|---|
| Cliente/Operador | Cliente | Operator | Igualdade (texto normalizado) | Inconsistência |
| Local/Unidade | Local | Location | Igualdade | Inconsistência |
| TAG da linha | TAG da Linha | Line Identity / Equipment ID | Igualdade (tolerar diferença de formatação, ex. aspas de polegada) | Inconsistência |
| OS / Projeto | OS Team | Project ID | Igualdade | Inconsistência |
| Referência de engenharia | Ref Engenharia (campo "Resumo das Atividades") | Repair Reference / Engineering ID | Igualdade | Inconsistência — sem essa referência batendo, a comparação inteira é inválida (deveria interromper a checagem com aviso) |

### B. Condições de projeto e operação

| Regra | Campo RDE | Campo Memorial | Lógica | Severidade se divergir |
|---|---|---|---|---|
| Diâmetro da linha | Diâmetro da Linha (pol.) | Line Diameter (mm) | Converter polegada nominal → OD padrão e comparar | Inconsistência |
| Material da linha | Material Fab. da Linha | Line Material | Igualdade semântica (ex. "Aço Carbono" = "Carbon Steel") | Inconsistência |
| Conteúdo da linha | Conteúdo da Linha | Line Contents | Igualdade semântica | Ponto de Atenção (informativo, raramente crítico por si só) |
| Pressão de projeto | Pressão de Projeto | Design Pressure / Internal Design Pressure | Igualdade com tolerância de arredondamento (±0,05 bar) | Inconsistência |
| Pressão de operação | Pressão de Operação | Operating Pressure | Igualdade com tolerância (±0,05 bar) | Inconsistência |
| Temperatura de operação | Temperatura de Operação | Maximum Operating Temperature | Igualdade | Inconsistência |
| Temperatura de projeto | Temperatura de Projeto | Maximum Design Temperature (dado de sistema, **não** a Repair Design Temperature do laminado) | Igualdade | Ponto de Atenção se não bater exatamente, já que são dois "temperatura de projeto" com propósitos diferentes no memorial — vale checar qual o RDE realmente deveria refletir |

### C. Sistema de reparo (material e camadas)

| Regra | Campo RDE | Campo Memorial | Lógica | Severidade se divergir |
|---|---|---|---|---|
| Sistema/material do reparo | Checkbox "Tipo do Reparo" (ex. TFCR HT-BC) | Material System (ex. FCR-BC-HT) | Mapear código do checkbox → material system e comparar | Inconsistência |
| Número de camadas aplicado | Número de Camadas | Layer Count Overview (considerando a geometria aplicável — reto ou curva) | Aplicado ≥ mínimo exigido pelo memorial para a geometria em questão | Inconsistência se menor que o exigido; Ponto de Atenção se maior que o exigido sem justificativa |
| Espessura do reparo | Espessura Rep. | Final Calculated Thickness | Aplicado ≥ calculado, com tolerância de processo | Inconsistência se menor; Consistente se igual/maior dentro de tolerância razoável |
| Materiais utilizados batem com o sistema especificado | Tabela "Materiais Utilizados" | Material System | Cada item deve ser coerente com o sistema especificado (ex. fibra de carbono + resina HT para sistema FCR-BC-HT) | Ponto de Atenção para itens não previstos em quantidade pequena (podem ser uso auxiliar); Inconsistência para item central do sistema ausente ou trocado |

### D. Geometria do reparo

| Regra | Campo RDE | Campo Memorial | Lógica | Severidade se divergir |
|---|---|---|---|---|
| Geometria marcada existe no memorial | Checkbox "Geometria do Reparo" | Layer Count Overview (categorias: Straight, Elbows, Tees, etc.) | A(s) geometria(s) marcada(s) devem ter dimensionamento correspondente no memorial | Inconsistência se a geometria marcada não tiver cálculo correspondente |
| Cobertura completa da geometria física *(Fase 2 — depende de leitura de imagem, fora do MVP)* | Checkbox(es) marcados | Evidência fotográfica / relato | Se a foto ou descrição sugere mais de um tipo de geometria no trecho reparado (ex. reto + curva) e só uma foi marcada | Ponto de Atenção (mesmo que a checagem numérica de camadas passe) |

### E. Comprimento e overlap

| Regra | Campo RDE | Campo Memorial | Lógica | Severidade se divergir |
|---|---|---|---|---|
| Comprimento aplicado vs. exigido | Comprimento Reparo | Customer specified repair length / Length Requested-Required | Aplicado ≥ exigido | **Inconsistência** por padrão. Rebaixar para **Ponto de Atenção** somente se o RDE indicar explicitamente que é um trecho parcial de uma aplicação em múltiplas etapas (hoje o sistema não agrega múltiplos RDEs — então sempre pedir confirmação humana quando aplicado < exigido) |
| Overlap aplicado | *(não há campo dedicado no RDE hoje)* | Required Overlap / Available Overlap | — | Não Verificável — sinalizar como melhoria de formulário (adicionar campo de overlap no RDE) |

### F. Condições de aplicação (ambiente)

| Regra | Campo RDE | Campo Memorial | Lógica | Severidade se divergir |
|---|---|---|---|---|
| Temperatura de superfície | Temperatura Superfície | Min/Max Installation Surface Temperature | Dentro da faixa | Inconsistência se fora da faixa |
| Umidade relativa | Umidade Relativa | Humidity (limite, ex. <85%) | Dentro do limite | Inconsistência se acima do limite |
| Ponto de orvalho vs. temperatura de superfície | Temp. Ponto de Orvalho | *(regra de boas práticas, não necessariamente explícita no memorial)* | Superfície deve estar acima do ponto de orvalho com margem seaunciada de norma | Ponto de Atenção — hoje o campo do RDE tem inconsistência de unidade (registrado em % em vez de °C), impedindo essa checagem |
| Rugosidade da superfície | Rugosidade Superfície | *(se o memorial especificar)* | Preenchido e dentro do especificado | Ponto de Atenção se campo em branco; Inconsistência se preenchido e fora do especificado |

### G. Evidência fotográfica

Checagem só de **presença** de imagem embutida no PDF (existe um objeto de imagem naquela célula/região?) — não interpreta o conteúdo. Isso é 100% biblioteca (ex. contar objetos de imagem por página/região), sem IA, e está dentro do escopo do MVP.

| Regra | Lógica | Severidade se ausente |
|---|---|---|
| Foto "Antes da Execução" presente | Obrigatória sempre | Ponto de Atenção se ausente |
| Foto "Após Execução do Serviço" presente | Obrigatória sempre | Inconsistência se ausente (não há evidência do reparo em si) |
| Foto "Após Execução de PFP" presente | Obrigatória **somente se** o RDE relatar atividade de PFP (campo "Resumo das Atividades" e/ou materiais de PFP preenchidos) | Ponto de Atenção — falta de evidência de uma atividade que o próprio RDE declara ter sido executada |

---

## 3. Estratégia de extração (MVP — só biblioteca)

1. **Tentar ler como AcroForm** (ex. `pypdf`/`pdf-lib`) — PDFs editados no Acrobat trazem campos nomeados com valor direto (`'CURVA 90' -> '/On'`), sem ambiguidade nenhuma.
2. **Se não houver AcroForm, extrair por texto/layout** (ex. `pdfjs-dist`/`pdfplumber`) e casar pares "Rótulo: Valor" por regex — cobre RDEs gerados via Word→PDF (checkboxes vêm como ☐/☒ Unicode) e o memorial de cálculo (texto nativo limpo).
3. **Se não sobrar texto nenhum** (PDF achatado em imagem) — a extração automática falha. O item entra como **Não Verificável — revisão manual necessária**. Não há fallback de IA no MVP.

## 4. Observações para evolução do catálogo

- Este catálogo cobre hoje apenas RDE de **Reparo por Compósito**. Outros tipos de RDE (solda/END, por exemplo) precisam de catálogos próprios, seguindo a mesma estrutura de 4 status.
- Regras marcadas como "Não Verificável" são candidatas a virar campos novos no formulário do RDE (ex. overlap aplicado), não bugs do verificador.
- **Fase 2 (fora do MVP atual):** leitura assistida por IA do conteúdo das fotos (ex. inferir geometria física, avaliar qualidade visual do acabamento) e fallback de extração via IA para PDFs sem texto. Quando implementada, deve sempre gerar **Ponto de Atenção**, nunca **Inconsistência** direta — é sugestão para revisão humana, não veredito automático, dado o caráter de documentação de engenharia estrutural.
- Tolerâncias numéricas (ex. ±0,05 bar) são um ponto de partida e devem ser validadas/ajustadas por você antes de virar regra final no sistema.
