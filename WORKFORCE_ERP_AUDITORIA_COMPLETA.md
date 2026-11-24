# WORKFORCE ERP — AUDITORIA TÉCNICA E FUNCIONAL COMPLETA (v7.0.0-ERP)

**Data da Auditoria:** 28/10/2026  
**Escopo:** Auditoria estática e funcional do código-fonte efetivamente implementado, modelo de persistência, motor de cálculo de escalas, fluxos de interface e trilha de auditoria.  
**Restrição:** Nenhuma linha de código ou registro de banco foi modificado durante esta auditoria.

---

## 1. RESUMO EXECUTIVO

O **Workforce ERP (v7.0.0-ERP)** é uma Single-Page Application (SPA) em React 19 + Vite 8 estruturada em 6 módulos de interface (cobrindo os domínios A a H), um motor de domínio puro determinístico (`src/domain/scheduleEngine.js`), uma base inicial pré-carregada (`src/domain/seedLoja03.js`) e uma camada de persistência híbrida (`src/services/erpRepository.js`).

### Diagnóstico Global: O que é Comprovado vs. Onde Estão as Limitações Reais
1. **Motor de Domínio Comprovado (`src/domain/scheduleEngine.js`)**:
   - Os algoritmos de continuidade temporal entre meses (`5X1`, `5X2`, `6X1_DOM`, `6X1_FLEX`), vigência temporal de regras no meio do mês, cálculo de impacto futuro após edição manual e separação entre **Ocupação de Vaga** e **Disponibilidade Operacional** estão implementados e comprovados por 6 suítes de testes automatizados (`src/tests/scheduleEngine.test.js`).
2. **Persistência Híbrida (Gap entre Schema SQL e Persistência Efetiva)**:
   - Embora o arquivo `supabase/migrations/20261028_erp_complete_schema.sql` defina 18 tabelas relacionais normalizadas em PostgreSQL, a aplicação em execução **não realiza queries SQL relacionais individuais** nas 18 tabelas. Em vez disso, `ErpRepository.saveDatabase` (`src/services/erpRepository.js`, linhas 104–126) serializa todo o grafo relacional (`dbState`) em um único documento JSONB dentro da tabela legada `configuracoes` do Supabase (`unidade = "__ERP_RELATIONAL_CORE_V7__"`, `mes = "2026-ERP"`) com espelhamento em `localStorage` (`erp_relational_db_v7_cache`).
3. **Principais Gargalos Operacionais e de Usabilidade Confirmados no Código**:
   - **Grade Mensal (`src/modules/ScheduleGridModule.jsx`)**: A tabela possui `tableLayout: "fixed"` (linha 612) com até 42 colunas simultâneas (4 colunas fixas + 6 dias do mês anterior + 31 dias do mês atual + 1 coluna de projeção), sem congelamento (`position: sticky`) nas colunas de identificação e com edição manual restrita a um ciclo sequencial de cliques (`T → F → A → T`, linha 242), impedindo a seleção direta de `MEIO_EXP` ou `FECHADO` na célula e não oferecendo botão de **"Limpar Escala do Mês para Reconstrução Manual"**.
   - **Filtro de Unidade Incompleto entre Módulos**: `selectedUnitId` está no estado raiz (`src/App.jsx`, linha 219), mas **não está no cabeçalho/barra lateral global**, e o módulo de Colaboradores (`src/modules/EmployeesAndAvailabilityModule.jsx`, linhas 70–79) lista `db.employees` sem filtrar pela unidade selecionada (`selectedUnitId`), fazendo com que colaboradores da Loja 03 apareçam mesmo quando o usuário seleciona a Loja 01 ou Loja 02 em outros módulos.
   - **Ausência de Operações de Edição (Update) em Cadastros**: Vários cadastros possuem apenas `Create` (ou `Create + Delete`), sem botões/modais de `Update`: não há interface para editar o nome da Empresa, editar uma Jornada Contratual existente, editar uma Regra de Escala existente ou editar um dia já cadastrado no Calendário do Mercado (exigindo remover e recriar).
   - **Origem Confirmada do Usuário `gestao.loja03@uniaosupermercados.com.br` e da Empresa**: Ambos são dados hardcoded no código-fonte (`src/App.jsx`, linhas 181 e 229; `src/domain/seedLoja03.js`, linha 14), explicados com evidência exata nas Seções 5.1 e 15 deste documento.

---

## 2. ARQUITETURA EXISTENTE

### 2.1 Inventário Tecnológico
| Camada | Tecnologia Implementada | Evidência no Código |
|---|---|---|
| **Frontend Framework** | React 19.2.6 + React DOM 19.2.6 | `package.json` (linhas 15–16) |
| **Build Tool / Bundler** | Vite 8.0.12 (`@vitejs/plugin-react`) | `package.json` (linhas 23, 28) |
| **Estilização** | Inline Styles JS (`const ui = {...}`) + CSS Print media query | `src/App.jsx` (linhas 314–323) e objetos `ui` em cada módulo. Nota: `@tailwindcss/vite` está no `package.json`, mas não é utilizado nos componentes. |
| **Backend / BaaS** | Supabase (`@supabase/supabase-js` ^2.106.2) | `src/services/erpRepository.js` (linhas 6–13) |
| **Banco de Dados** | PostgreSQL (hospedado no Supabase) + Cache `localStorage` | `src/services/erpRepository.js` (linhas 65–126) |
| **Camada de Persistência** | `ErpRepository` (Documento JSONB na tabela `configuracoes`) | `src/services/erpRepository.js` (linhas 69–126) |
| **Autenticação** | Supabase Auth (`signInWithPassword` / `signUp`) + Bypass automático de sessão local | `src/App.jsx` (linhas 21–43, 224–238) |
| **Autorização (RBAC)** | Validação em memória via `assertPermission(roleProfile, permission)` | `src/services/erpRepository.js` (linhas 16–63) |
| **Testes Automatizados** | Node.js Native Test Runner (`node --test`) | `src/tests/scheduleEngine.test.js` (linhas 1–490) |

### 2.2 Árvore de Diretórios e Arquivos Relevantes
```text
d:\Coding\Projects\Escala de Folga Automatizada\
├── package.json                                      # Scripts (dev, build, test, lint) e dependências
├── vite.config.js                                    # Configuração padrão do Vite
├── escala_novembro_2026_loja3.csv                    # Arquivo CSV avulso gerado na etapa anterior
├── supabase/
│   └── migrations/
│       └── 20261028_erp_complete_schema.sql          # DDL PostgreSQL com 18 tabelas normalizadas (não aplicado via ORM)
└── src/
    ├── main.jsx                                      # Ponto de entrada React DOM
    ├── App.jsx                                       # Shell do ERP, Auth, Sidebar, Estado Global (db) e Dispatcher
    ├── App.css / index.css                           # Estilos residuais do template Vite
    ├── domain/
    │   ├── scheduleEngine.js                         # Motor puro: datas, postos, regras, geração contínua, impacto, conflitos e BI
    │   └── seedLoja03.js                             # Seed completo da Loja 03 (Outubro e Novembro/2026)
    ├── services/
    │   └── erpRepository.js                          # Cliente Supabase, matriz RBAC, load/save de estado e fábrica de logs
    ├── modules/
    │   ├── DashboardAndBiModule.jsx                  # Módulo G: KPIs, Tabela Estoque vs. Fluxo e 4 Consultas Analíticas
    │   ├── ScheduleGridModule.jsx                    # Módulo E: Grade mensal, edição, almoço 1..4, impacto futuro e troca
    │   ├── OrganizationAndPositionsModule.jsx        # Módulos B e A: Quadro de vagas, gerador 01..N, setores e funções
    │   ├── EmployeesAndAvailabilityModule.jsx        # Módulos C e F: Colaboradores, transferência histórica e férias/INSS
    │   ├── RulesShiftsAndCalendarModule.jsx          # Módulo D: Calendário de abertura, regras 5x1/5x2/6x1 e jornadas
    │   └── AdminAndAuditModule.jsx                   # Módulo H: Seletor de perfil RBAC, backup JSON, reset de seed e logs
    └── tests/
        └── scheduleEngine.test.js                    # 6 cenários de teste automatizados do motor de domínio
```

---

## 3. INVENTÁRIO DE FUNCIONALIDADES (IMPLEMENTADO vs. INCOMPLETO vs. AUSENTE)

| Funcionalidade | Status Atual | Localização no Código | Observação Técnica |
|---|---|---|---|
| **Geração automática de postos sequenciais (`01..N`)** | **Implementado e Comprovado** | `src/domain/scheduleEngine.js` (`createSequentialPositions`, L89–120) | Cria registros individuais com ID único e código `01..N` ou `RATEIO`. |
| **Edição/Exclusão individual de um Posto criado** | **Parcial / Incompleto** | `src/modules/OrganizationAndPositionsModule.jsx` (L133–164) | Permite alterar apenas `status` e `estimatedMonthlyCost`. Não permite editar título, setor, jornada padrão ou excluir posto criado por engano. |
| **Edição do Nome/CNPJ da Empresa e Unidades** | **Ausente na UI** | `src/domain/seedLoja03.js` (L13–45) | `companies` e `units` existem no banco em memória, mas não há formulário na UI para editá-los ou criar novas unidades. |
| **Admissão e Alocação de Colaborador em Vaga** | **Implementado** | `src/modules/EmployeesAndAvailabilityModule.jsx` (`handleHireEmployee`, L82–134) | Cria colaborador, cria `employee_allocation` e muda vaga para `FILLED`. |
| **Transferência com Histórico Funcional (SCD Tipo 2)** | **Implementado** | `src/modules/EmployeesAndAvailabilityModule.jsx` (`handleExecuteTransfer`, L137–184) | Encerra alocação anterior em `startDate - 1` e abre nova em `startDate` sem apagar histórico passado. |
| **Edição cadastral de Colaborador (nome, matrícula, admissão)** | **Ausente na UI** | `src/modules/EmployeesAndAvailabilityModule.jsx` | Não há botão "Editar dados cadastrais" ou "Desvincular/Demitir diretamente" sem passar por Aviso Prévio ou Transferência. |
| **Continuidade Histórica entre Meses (5x1, 5x2, 6x1)** | **Implementado e Comprovado** | `src/domain/scheduleEngine.js` (`generateEmployeeScheduleForMonth`, L211–486) | Validado pelos testes 1 e 6 em `src/tests/scheduleEngine.test.js`. |
| **Edição Manual Livre de Célula na Escala** | **Limitado** | `src/modules/ScheduleGridModule.jsx` (`handleToggleCellStatus`, L236–316) | Clique esquerdo cicla apenas `T → F → A → T`. Não abre seletor para escolher `MEIO_EXP`, `FECHADO` ou limpar célula. |
| **Limpeza / Reconstrução Manual Completa do Mês** | **Ausente na UI** | `src/modules/ScheduleGridModule.jsx` | Existia um "Modo Limpeza" no monolito antigo (v6), mas **não foi migrado** para `ScheduleGridModule.jsx` na v7.0. |
| **Detecção e Recálculo de Impacto Futuro** | **Implementado** | `src/domain/scheduleEngine.js` (`detectFutureScheduleImpact`, L491–545) | Detecta divergências no mês `M+1` ao editar `M` e oferece botão de recálculo preservando `MANUAL_OVERRIDE`. |
| **Bloqueio de Edição em Escala Publicada** | **Ausente (Falha de Governança)** | `src/modules/ScheduleGridModule.jsx` (L236–245) | Mesmo quando `currentMonthlySchedule.status === "PUBLISHED"`, `handleToggleCellStatus` permite alterar células livremente sem exigir reabertura. |

---

## 4. MAPA DE MÓDULOS E NAVEGAÇÃO

A navegação lateral (`NAV_ITEMS` em `src/App.jsx`, linhas 198–205) apresenta 6 itens principais:

1. `dashboard` (**📊 Dashboard & BI**): Renderiza `DashboardAndBiModule.jsx` (Módulo G).
2. `schedules` (**📅 Escalas Mensais** — *aba ativa inicial na linha 218*): Renderiza `ScheduleGridModule.jsx` (Módulo E).
3. `workforce` (**🏢 Quadro & Estrutura**): Renderiza `OrganizationAndPositionsModule.jsx`, que possui 2 sub-abas internas (linhas 197–208):
   - Sub-aba 1 (`positions`, ativa por padrão): **Módulo B — Quadro de Vagas e Postos de Trabalho**.
   - Sub-aba 2 (`structure`): **Módulo A — Estrutura Organizacional (Unidades, Setores, Categorias e Funções)**.
4. `employees` (**👥 Colaboradores & Férias**): Renderiza `EmployeesAndAvailabilityModule.jsx`, com 2 sub-abas:
   - Sub-aba 1 (`employees`): **Módulo C — Cadastro, Alocações e Histórico Funcional**.
   - Sub-aba 2 (`availability`): **Módulo F — Férias, Afastamentos, INSS e Aviso Prévio**.
5. `rules` (**⚙️ Regras & Mercado**): Renderiza `RulesShiftsAndCalendarModule.jsx` (Módulo D), com 3 sub-abas:
   - Sub-aba 1 (`calendar`): **Calendário de Abertura do Mercado**.
   - Sub-aba 2 (`rules`): **Motor de Regras de Escala e Vigências**.
   - Sub-aba 3 (`shifts`): **Jornadas Contratuais e Escala de Intervalos**.
6. `admin` (**🔐 Admin & Auditoria**): Renderiza `AdminAndAuditModule.jsx` (Módulo H).

### Por que o Módulo B aparece antes do Módulo A e por que os nomes técnicos causam atrito?
- Em `src/modules/OrganizationAndPositionsModule.jsx` (linha 18), o estado inicial foi definido como `const [subTab, setSubTab] = useState("positions")`, colocando a tela de Vagas ("Módulo B") antes da Estrutura Organizacional ("Módulo A"), embora a criação de um posto dependa previamente da existência do Setor e da Função (Módulo A).
- Além disso, os rótulos dos botões expõem a nomenclatura interna da especificação (`"Módulo B — ..."`, `"Módulo A — ..."`, `"Módulo C — ..."`, `"Módulo F — ..."`), o que confunde o operador administrativo. Reorganizar os menus e remover os prefixos `"Módulo X"` é puramente uma alteração de apresentação na camada React, sem qualquer impacto nas regras de negócio.

---

## 5. MODELAGEM DO BANCO DE DADOS E PERSISTÊNCIA REAL

> **Detalhamento completo disponível no arquivo complementar `WORKFORCE_ERP_MODELO_DE_DADOS.md`.**

### Como os Dados São Realmente Persistidos Hoje
- **Arquivo SQL (`supabase/migrations/20261028_erp_complete_schema.sql`)**: Contém a modelagem DDL PostgreSQL para 18 tabelas relacionais. **Status:** Documental / Preparatório (não executado diretamente pelo frontend).
- **Persistência Ativa (`src/services/erpRepository.js`, linhas 65–126)**:
  - Ao iniciar, `ErpRepository.loadDatabase()` faz `SELECT dados FROM configuracoes WHERE unidade = '__ERP_RELATIONAL_CORE_V7__' AND mes = '2026-ERP'`.
  - Se não encontrar, lê `localStorage.getItem("erp_relational_db_v7_cache")`.
  - Se ambos estiverem vazios, executa `buildInitialErpDatabase()` (`src/domain/seedLoja03.js`) e salva o objeto JSON completo na linha `configuracoes` do Supabase e no `localStorage`.
  - **Risco de Integridade**: Como todo o estado de todas as lojas e meses é salvo em um único registro JSONB (`dados`), não há bloqueio otimista por linha nem transações ACID no banco para edições simultâneas de dois usuários (o último a salvar sobrescreve o documento JSONB inteiro).

---

## 6. FLUXO DE FILTROS POR EMPRESA E UNIDADE (E ANÁLISE DO NOME DA EMPRESA)

### 6.1 Investigação do Nome da Empresa ("YUARA PRESTADORA SERVIÇOS LJ 03 LTDA" / "AR Prestadora de Serviços")
- **Onde está armazenado:** No arquivo `src/domain/seedLoja03.js` (linhas 13–19):
  ```js
  const companies = [
    {
      id: "comp_yuara_03",
      legalName: "YUARA PRESTADORA SERVIÇOS LJ 03 LTDA",
      tradeName: "União Supermercados — Loja 03",
      cnpj: "40.633.037/0001-71",
      active: true,
    },
  ];
  ```
- **Por que esse nome foi cadastrado?** Na primeira mensagem da conversa, a planilha CSV enviada continha na célula `B1` exatamente o texto: `EMPRESA: YUARA PRESTADORA SERVIÇOS LJ 03 LTDA - CNPJ: 40.633.037/0001-71`. Esse valor foi copiado literalmente para o seed.
- **Onde é exibido:** No topo da grade da Escala Mensal (`src/modules/ScheduleGridModule.jsx`, linha 600): `EMPRESA: {db.companies[0]?.legalName} — CNPJ: {db.companies[0]?.cnpj}`.
- **Existe interface para alterar?** **Não.** Não há nenhum campo ou modal na interface atual para editar `db.companies[0].legalName`, `tradeName` ou `cnpj`, nem para alternar entre múltiplas empresas.

### 6.2 Como a Seleção de Unidade (`selectedUnitId`) Funciona Entre os Módulos
O estado `selectedUnitId` (valor inicial `"LOJA_03"`) reside no componente raiz `App` (`src/App.jsx`, linha 219) e é passado via props para os módulos. Contudo, seu comportamento é **inconsistente**:
1. **Dashboard & BI (`DashboardAndBiModule.jsx`)**: Possui `<select>` de unidade próprio (linha 197). Filtra corretamente `workPositions` e `monthEntries` por `selectedUnitId`.
2. **Escalas Mensais (`ScheduleGridModule.jsx`)**: Possui `<select>` de unidade próprio (linha 447). Filtra postos, calendário e lançamentos por `selectedUnitId`.
3. **Quadro & Estrutura (`OrganizationAndPositionsModule.jsx`)**:
   - Na sub-aba *Postos (`positions`)*: Possui `<select>` de unidade dentro do formulário de geração (linha 228) e filtra a tabela de postos por `selectedUnitId` (linha 73).
   - Na sub-aba *Estrutura (`structure`)*: **Não possui seletor de unidade** e na contagem de postos por setor/função (`db.workPositions.filter((p) => p.sectorId === s.id)`, linhas 477 e 542) **não filtra por `selectedUnitId`**, somando postos de todas as lojas.
4. **Colaboradores & Férias (`EmployeesAndAvailabilityModule.jsx`)**:
   - **Falha Crítica Confirmada**: Não possui seletor de unidade na tela. O dropdown de vagas disponíveis (`vacantPositions`, linha 64) filtra por `selectedUnitId`, mas a **Tabela Nominal de Colaboradores (`filteredEmployees`, linhas 70–79)** e a **Aba de Férias (`db.unavailabilityEvents`, linha 395)** **NÃO filtram por `selectedUnitId`**. Consequentemente, mesmo que o operador mude para `LOJA_01` no Dashboard, ao abrir a aba Colaboradores, todos os 60 colaboradores da `LOJA_03` continuam aparecendo.
5. **Regras & Mercado (`RulesShiftsAndCalendarModule.jsx`)**:
   - **Falha Confirmada**: Não possui `<select>` de unidade na tela. Ao salvar um dia no calendário (linha 47), grava em `selectedUnitId`, mas a tabela de datas cadastradas (linha 237: `db.marketCalendarDays.map(...)`) lista datas de **todas** as unidades sem filtrar por `selectedUnitId`.

**Impacto de mover o Seletor de Unidade para o Topo da Barra Lateral (`App.jsx`)**:
- Positivo e altamente recomendado: elimina a repetição de selects em 3 telas e torna o contexto da loja visível permanentemente, bastando adicionar o filtro `.filter(x => x.unitId === selectedUnitId)` nas listagens de `EmployeesAndAvailabilityModule.jsx` e `RulesShiftsAndCalendarModule.jsx`.

---

## 7. DASHBOARD E INTELIGÊNCIA ANALÍTICA (`src/modules/DashboardAndBiModule.jsx`)

### 3.1 Indicadores Executivos (KPI Cards — linhas 237–284)
Todos os indicadores são calculados pela função pura `computeWorkforceAnalytics` (`src/domain/scheduleEngine.js`, linhas 661–844):

| Indicador na Tela | Fórmula Matemática Exata no Código | Entidades Consultadas | Filtro Temporal Aplicado |
|---|---|---|---|
| **Postos Planejados (Quadro Próprio)** | $\sum p \in \text{workPositions}$ onde $p.\text{unitId} = U \land p.\text{status} \neq \text{'DEACTIVATED'} \land \neg p.\text{isSharedRateio}$ | `db.workPositions` | Atemporal (estado atual do cadastro do posto). |
| **Subtítulo: Postos de Rateio** | $\sum p \in \text{workPositions}$ onde $p.\text{isSharedRateio} = \text{true}$ | `db.workPositions`, `db.allocations` | Ocupação avaliada em `referenceDate`. |
| **Postos Preenchidos** | $\sum p$ (próprios) que possuem `allocation` ativa em `referenceDate` cujo `employee` não foi desligado até `referenceDate`. **Inclui colaboradores em férias.** | `db.workPositions`, `db.allocations`, `db.employees` | **Data de Referência (`referenceDate`)** |
| **Taxa de Ocupação (%)** | $\text{round}\left(\frac{\text{filledOwnPositions}}{\text{plannedOwnPositions}} \times 100, 1\right)$ | Derivado dos dois anteriores | **Data de Referência (`referenceDate`)** |
| **Postos Vagos (Sem Ocupante)** | $\text{plannedOwnPositions} - \text{filledOwnPositions}$ (subdividido em `OPEN_AUTHORIZED`, `FROZEN` e `OPEN_UNPLANNED`) | `db.workPositions`, `db.allocations` | **Data de Referência (`referenceDate`)** |
| **Disponíveis na Data** | Colaboradores ocupando posto próprio em `referenceDate` que **não** possuem evento em `unavailabilityEvents` (`VACATION`, `MATERNITY_LEAVE`, `MEDICAL_LEAVE`, `UNPAID_LEAVE`) cobrindo `referenceDate`. | `db.allocations`, `db.unavailabilityEvents` | **Data de Referência (`referenceDate`)** |
| **Escalados Trabalhando** | Colaboradores ocupando posto em `referenceDate` cujo lançamento em `monthEntries` na data `referenceDate` tem `status IN ('T', 'MEIO_EXP')`. | `db.dailyEntriesByMonth[yearMonth]` | **Data de Referência (`referenceDate`)** |
| **Contratações Autorizadas / Custo** | Soma de postos vagos com `status === 'OPEN_AUTHORIZED'`. Se `estimatedMonthlyCost` estiver vazio (`null`), exibe `"Orçamento salarial: não apurado (sem dados fictícios)"`. | `db.workPositions`, `db.roles` | Estado atual + `referenceDate` |

### 3.2 Competência (`yearMonth`) vs. Data de Referência do Estoque (`referenceDate`)
- **Significado de Competência (`selectedYearMonth`, ex.: `2026-11`)**: Define o mês-calendário analisado para indicadores de **Fluxo** (ocorrências acumuladas ao longo de todo o mês, como a coluna *"Férias no Mês (Fluxo)"*, linhas 775–784 de `scheduleEngine.js`, que conta quantos colaboradores tiveram ao menos 1 dia de férias entre `01/11` e `30/11`).
- **Significado de Data de Referência do Estoque (`referenceDate`, ex.: `2026-11-10`)**: No vocabulário de Economia e Recursos Humanos, *"variável de estoque"* significa a **fotografia instantânea do quadro de pessoal em um dia específico** (em oposição a *"fluxo"*). Não tem relação com estoque de mercadorias do supermercado.
- **Avaliação da Nomenclatura**: Em um ERP para supermercados, o termo **"Estoque"** causa ambiguidade imediata com o setor de **Estoque de Mercadorias** (`SEC_ESTOQUE`). A substituição do rótulo para **"Posição do Quadro em (Data-Base)"** e **"Acumulado no Mês"** é fortemente recomendada.

### 3.3 Inteligência Analítica e Limitações de Período (`linhas 72–157`)
- **O que está implementado:** Existem 4 cards fixos de perguntas e respostas (`analyticalAnswers`):
  1. Disponibilidade e escalados por dia em uma **semana fixa** (`1ª Semana: dias 01–07`, `2ª Semana: dias 08–14`, `3ª Semana: dias 15–21`, `4ª Semana: dias 22–28`) para um setor escolhido.
  2. Setor com maior déficit de vagas no mês.
  3. Colaboradores em férias/afastamento simultaneamente na `referenceDate`.
  4. Distribuição das faixas de almoço (`N 01` a `N 04`) no próximo domingo a partir de `referenceDate`.
- **Limitações confirmadas:**
  - Não permite consultar os dias **29, 30 e 31** na consulta semanal (pois o cálculo `startIdx = (queryWeekNum - 1) * 7` na linha 74 vai apenas até o índice 28).
  - Não suporta filtro por **quinzena**, **intervalo de datas personalizado (`dataInicial` a `dataFinal` cruzando meses)**, **mês completo** ou **função específica** (ex.: apenas `Açougueiros` dentro do setor `Açougue`).

---

## 8. AUDITORIA CRÍTICA DA ESCALA MENSAL (`src/modules/ScheduleGridModule.jsx`)

> **Detalhamento algorítmico completo disponível em `WORKFORCE_ERP_MOTOR_ESCALAS.md`.**

### 4.1 Estrutura Visual e Motivos da Dificuldade de Leitura
- A grade renderiza uma `<table>` para cada setor (`linhas 607–845`) com `tableLayout: "fixed"` e `width: "100%"` (linha 612).
- **Quantidade de colunas simultâneas:**
  - 4 colunas iniciais (`Nº`, `SETOR/POSTO`, `HORÁRIO`, `REGRA`)
  - 6 colunas dos últimos dias do mês anterior (`showPrevMonthTail`)
  - 1 coluna central para `COLABORADOR / VAGA` (posicionada **entre** os 6 dias do mês anterior e o dia 1º do mês atual, imitando o layout da planilha Excel original!)
  - 30 ou 31 colunas dos dias do mês atual
  - 1 coluna final (`PRÓX. MÊS`)
  - **Total:** **42 a 43 colunas** espremidas em `width: "100%"` com `tableLayout: "fixed"`.
- **Por que está difícil de visualizar e navegar:**
  1. Como `tableLayout: "fixed"` com `width: "100%"` força todas as 43 colunas a caberem na largura da tela (sem definir um `minWidth` na tabela), em monitores de 1366px ou 1920px as colunas de dias encolhem e os textos (`MEIO_EXP`, `FECH`, nomes) sofrem truncamento.
  2. Nenhuma coluna possui `position: sticky; left: 0`, e o nome do colaborador fica no **meio** da tabela (após as 6 colunas do mês anterior), dificultando acompanhar a linha horizontalmente.

### 4.2 Tabela Completa de Códigos e Estados da Escala
| Código no Banco (`status` / `lunchSlot`) | Texto Exibido na Célula | Significado Operacional Exato | Como é Calculado / Gerado | Editável na Célula? | Efeito no Ciclo (`consecutiveWorkDays`) |
|---|---|---|---|---|---|
| `status: "T"` (sem `lunchSlot`) | *(Célula branca vazia)* | Dia normal de trabalho integral. | Gerado por padrão quando não é dia de folga, férias, afastamento ou feriado fechado/meio dia. | Sim (clique esq. muda para `F`). | Incrementa `+1` dia trabalhado consecutivo (`scheduleEngine.js`, L188, L446). |
| `status: "T"` + `lunchSlot: "1" \| "2" \| "3" \| "4"` | `1`, `2`, `3` ou `4` (fundo verde claro `#dcfce7`) | Trabalhando em Domingo ou Feriado com horário de almoço escalado: `1`=09h–10h (`N 01`), `2`=10h–11h (`N 02`), `3`=11h–12h (`N 03`), `4`=12h–13h (`N 04`). | Atribuído em domingos/feriados trabalhados via fórmula `((employeeRotationRank + Math.floor(idx / 7)) % 4) + 1` (`L469`). | Sim: clique sobre o número cicla `1 → 2 → 3 → 4 → 1` (`handleCycleLunchSlot`, L319). Clique fora do número muda status para `F`. | Incrementa `+1` dia trabalhado consecutivo e `+1` em `sundaysWorkedStreak`. |
| `status: "F"` | `F` (fundo preto `#0f172a`, texto branco) | Folga semanal regular do ciclo (`5x1`, `5x2`, `6x1`). | Gerado quando `consecutiveWork >= 5` (no `5X1`), ou no dia da semana permitido (`5X2`, `6X1_DOM`, `6X1_FLEX`). | Sim: clique esq. muda para `A`; clique dir. abre modal de troca. | **Zera** `consecutiveWorkDays = 0` e atualiza `lastRestDate = workDate` (`L183–185`, `L441–443`). |
| `status: "A"` | `A` (fundo cinza `#64748b`, texto branco) | Folga Adicional / Abono / Compensação manual concedida além do ciclo automático. | Nunca é gerado automaticamente pelo motor; só surge por clique manual do operador (`F → A`). | Sim: clique esq. muda para `T`; clique dir. abre modal de troca. | **Zera** `consecutiveWorkDays = 0` e atualiza `lastRestDate = workDate` (mesmo efeito de descanso que `F`, `L183`). |
| `status: "MEIO_EXP"` | `½` ou `1·½` (fundo amarelo `#fef3c7`) | Trabalho em regime de Meio Expediente em dia configurado no Calendário do Mercado como `HALF_DAY` (Meio Dia). | Gerado automaticamente quando o colaborador trabalha (`!isRestDay`) e `marketDay.openingMode === "HALF_DAY"` (`L448–450`). | Clique esq. muda para `F`, mas **não é possível voltar manualmente para `MEIO_EXP`** pelo clique na célula (só regerando o mês). | Incrementa `+1` dia trabalhado consecutivo (`L187`, `L446`). |
| `status: "FECHADO"` | `FECH` (fundo vermelho claro `#fee2e2`) | Mercado Fechado (feriado/domingo configurado como `CLOSED`). | Gerado automaticamente para todos os colaboradores ativos quando `marketDay.openingMode === "CLOSED"` (`L381–399`). | Clique esq. muda para `T`, mas **não é possível selecionar `FECHADO` manualmente** na célula individual. | Se `rule.closedMarketCountsAsRest !== false`, zera `consecutiveWork = 0`; nas regras `5X1` e `6X1_FLEX` do seed (`closedMarketCountsAsRest: false`), **pausa** a contagem sem zerar e sem incrementar (`L382–385`). |
| `status: "V"` | `FÉR` (fundo verde escuro `#166534`, texto branco) | Férias regulamentares. | Gerado quando há evento `VACATION` em `unavailabilityEvents` cobrindo a data (`L335–357`). | Bloqueado na grade (`if (["V","LM","INSS","ADM","DEM"].includes(curStatus)) return;` na `L239`). Editável apenas na aba Férias. | Zera `consecutiveWork = 0` durante as férias (`L355`). |
| `status: "LM"` / `"INSS"` | `LM` / `INSS` (fundo roxo `#7c3aed`) | Licença Maternidade / Afastamento Previdenciário INSS. | Gerado a partir de `unavailabilityEvents` (`MATERNITY_LEAVE` / `MEDICAL_LEAVE`). | Bloqueado na grade; editável na aba Férias/Afastamentos. | Zera `consecutiveWork = 0`. |
| `status: "ADM"` / `"DEM"` | `ADM` / `DEM` (fundo cinza claro `#cbd5e1`) | Dias anteriores à data de admissão (`hireDate`) ou posteriores ao término do aviso/demissão (`terminationDate`). | Gerado quando `isoDate < employee.hireDate` (`L288`) ou `isoDate > terminationDate` (`L306`). | Bloqueado na grade; controlado pelas datas do cadastro do colaborador. | Zera `consecutiveWork = 0`. |

### 4.3 Por que a Edição Manual é Limitada?
Na função `handleToggleCellStatus` (`src/modules/ScheduleGridModule.jsx`, linhas 236–243):
```js
const curEntry = entriesByEmpDate[emp.id]?.[isoDate];
const curStatus = curEntry?.status || "T";
if (["V", "LM", "INSS", "ADM", "DEM"].includes(curStatus)) return;

const seq = { T: "F", MEIO_EXP: "F", F: "A", A: "T", FECHADO: "T" };
const nextStatus = seq[curStatus] || "F";
```
- **Causa Exata**: A edição foi codificada como uma máquina de estados circular de 3 passos (`T → F → A → T`). Quando uma célula está em `MEIO_EXP` ou `FECHADO` e o operador clica nela, ela vai para `F` ou `T` e **nunca mais retorna a `MEIO_EXP` ou `FECHADO`** por clique, pois esses estados não são destinos no mapa `seq`. Além disso, em domingos/feriados, como o número do almoço (`<span>` nas linhas 795–807) ocupa `width: "100%"` e intercepta o `onClick` com `ev.stopPropagation()` (linha 320), **clicar sobre o número `1..4` no domingo apenas troca o horário de almoço (`1→2→3→4`), tornando difícil transformar um domingo trabalhado em folga (`F`)** a menos que o usuário clique na borda externa de 2px da célula!

### 4.4 Avaliação Técnica: Limpeza e Reconstrução Manual como Referência Futura
- **É possível hoje?** Não há botão na UI para limpar um mês em edição.
- **A arquitetura do motor suporta isso?** **Sim, 100%.** Em `src/domain/scheduleEngine.js`, a função `generateEmployeeScheduleForMonth` recebe `previousMonthEntries` (linha 220) e chama `computeCycleStateFromEntries` (linha 230), que lê **qualquer array de lançamentos do mês anterior** (sejam eles `AUTO_GENERATED`, `MANUAL_OVERRIDE` ou `VALIDATED`) para descobrir a data da última folga (`lastRestDate`) e quantos dias seguidos o colaborador trabalhou no final do mês (`consecutiveWorkDays`).
- **O que falta para viabilizar o fluxo completo (Limpar → Montar Manualmente → Validar → Gerar Próximo Mês):**
  1. Um botão **"Limpar Folgas do Mês / Iniciar Montagem Manual"** em `ScheduleGridModule.jsx` que defina todos os dias úteis dos colaboradores ativos como `"T"` (com `origin: "MANUAL_OVERRIDE"`), preservando apenas `V`, `LM`, `INSS`, `ADM`, `DEM`.
  2. Um popover/seletor rápido ou paleta de pincel na grade permitindo marcar diretamente `F`, `A`, `T`, `MEIO_EXP`, `FECHADO` e os horários `1..4` (sem conflito de clique entre o número de almoço e o status de folga).
  3. Ao clicar em **"Validar Escala"**, recalcular e gravar o snapshot `cycleStates` do mês (`computeCycleStateFromEntries`) para que o mês seguinte use essa escala manual validada como sua única verdade histórica.

---

## 9. AUDITORIA DO QUADRO DE POSTOS, VAGAS E MOVIMENTAÇÕES (SEÇÕES 6 E 7)

### Resposta às Duas Investigacões Específicas da Seção 6:
1. **"Como alterar a função de um colaborador que atualmente ocupa o posto de Gerente para Supervisor Operacional?"**
   - **Fluxo atualmente implementado:** O sistema separa estritamente **Posto de Trabalho** (`workPositions`) de **Colaborador** (`employees`). A função (`roleId`) pertence ao Posto e à Alocação (`employee_allocations`). Portanto, para que o colaborador passe de `GERENTE` (Posto `01`) para `SUPERVISOR OPERACIONAL` (Posto `RATEIO-01`, que está vago), o operador deve ir em **Colaboradores & Férias → clicar em `🔄 Transferir` na linha do colaborador (`ANDRÉ LUIZ`) → selecionar o posto vago `[RATEIO-01] SUPERVISOR OPERACIONAL` → informar a Data de Vigência e confirmar** (`EmployeesAndAvailabilityModule.jsx`, linhas 137–184).
   - **Limitação de Usabilidade:** Se o posto de destino (`Supervisor Operacional`) ainda não existir como vaga aberta, o operador precisa primeiro ir em **Quadro & Estrutura**, gerar 1 posto de `Supervisor Operacional`, e só depois voltar em **Colaboradores** para transferir. Não há opção de *"Alterar Função/Posto no mesmo modal"*.
2. **"Como mudar a regra de escala de um gerente de 6x1 para 5x2, com data de vigência definida?"**
   - **Fluxo atualmente implementado:** Isso é feito em uma relação histórica dedicada (`db.ruleAssignments`), acessível em **Regras & Mercado → sub-aba `⚙️ Motor de Regras de Escala` → seção `"📅 Mudança de Regra de Escala durante o Mês (Vigência Temporal por Colaborador)"`** (`src/modules/RulesShiftsAndCalendarModule.jsx`, linhas 396–456). O operador seleciona o colaborador (`ANDRÉ LUIZ`), escolhe a regra `5X2 (SAB/DOM)` e define `Início da Vigência` (ex.: `2026-11-16`). Ao regerar a escala na grade, `getEffectiveRuleForDate` (`scheduleEngine.js`, linhas 134–155) aplica `6X1 (DOM)` até `15/11` e `5X2` a partir de `16/11`.
   - **Limitação de Usabilidade:** Essa funcionalidade está escondida no final da sub-aba de Regras, distante do cadastro do colaborador e da grade de escala, e não possui botão para excluir/editar uma vigência após cadastrada.

### Tratamento de Colaboradores de Rateio (Compartilhados entre Lojas)
- Na modelagem atual (`workPositions.isSharedRateio = true`), o flag de rateio é apenas um atributo booleano do posto na `LOJA_03` que o separa da contagem do "Quadro Próprio" no Dashboard e BI (`scheduleEngine.js`, linhas 679–680).
- **Limitação Confirmada:** Um colaborador alocado em um posto `RATEIO` na `LOJA_03` **não aparece automaticamente nas escalas da `LOJA_01` ou `LOJA_02`**, nem existe controle de quais dias da semana ele atua em cada unidade para evitar conflito de horário entre lojas.

---

## 10. AUDITORIA DE JORNADAS, HORÁRIOS E CALENDÁRIO OPERACIONAL (SEÇÃO 8)

### 8.1 As 8 Colunas de Horário da Planilha Original
Na planilha original da Loja 03, sob o título mesclado `HORÁRIO DE TRABALHO` e `C.H`, existem 8 colunas de tempo para cada posto (ex.: linha 4, `AÇOUGUEIRO 01`: `06:40:00 | 11:30:00 | 13:00:00 | 15:30:00 | 07:20:00 | 01:40:00 | 17:10:00 | 07:20:00`). Elas foram mapeadas na entidade `workShifts` (`src/domain/seedLoja03.js`, linhas 70–239) da seguinte forma:
1. `entryTime` (`06:40`): Entrada no turno.
2. `breakStart` (`11:30`): Início do intervalo intrajornada (almoço).
3. `breakEnd` (`13:00`): Fim do intervalo intrajornada.
4. `exitBaseTime` (`15:30`): Horário de saída da jornada contratual base.
5. `baseWorkload` (`07:20`): Soma das horas trabalhadas até a saída base (`(11:30 - 06:40) + (15:30 - 13:00) = 4h50 + 2h30 = 7h20`).
6. `extensionWorkload` (`01:40`): Tempo de prorrogação/complemento operacional diário.
7. `effectiveExitTime` (`17:10`): Horário real de saída (`15:30 + 01:40 = 17:10`).
8. `contractDailyWorkload` (`07:20`): Carga horária diária contratual de referência (44h semanais / 6 dias = 7h20).

- **Quais cálculos dependem delas hoje?** Atualmente, `shiftPeriod` (`MANHÃ` ou `TARDE`) é usado no filtro de turno da escala, e `${entryTime}–${effectiveExitTime}` é exibido visualmente nas tabelas. **Nenhum algoritmo do motor calcula horas trabalhadas no mês ou interjornada mínima de 11h (Art. 66 CLT) usando esses campos ainda.**
- **São editáveis?** **Não.** Em `RulesShiftsAndCalendarModule.jsx` (linhas 488–546), a sub-aba `⏰ Jornadas Contratuais` apenas renderiza uma tabela estática de leitura (`db.workShifts.map`), sem formulário para criar, editar ou excluir horários.

### 8.4 Por que o Calendário Operacional Permite Excluir e Recriar, mas Não Editar?
- Em `src/modules/RulesShiftsAndCalendarModule.jsx` (linhas 40–71), a função `handleSaveCalendarDay` faz um *upsert* baseado na data (`draft.marketCalendarDays = draft.marketCalendarDays.filter(c => !(c.unitId === selectedUnitId && c.calendarDate === calDate))`).
- Porém, na tabela de listagem (linhas 237–266), a coluna `Ações` possui apenas o botão `Remover` (`handleRemoveCalendarDay`). Não foi implementado um botão `✏️ Editar` que carregue os dados da linha (`calendarDate`, `dayType`, `openingMode`, `description`) de volta para os estados `calDate`, `calType`, `calMode`, `calDesc` do formulário superior.

---

## 11. AUDITORIA DE AUTENTICAÇÃO, AUTORIZAÇÃO E RASTREABILIDADE (SEÇÃO 9)

### Investigação Forense do Registro `gestao.loja03@uniaosupermercados.com.br`
- **Evidência Comprovada no Código (`src/App.jsx`, linhas 179–184 e 225–231)**:
  ```js
  // src/App.jsx, linhas 225-231:
  sb.auth.getSession().then(({ data }) => {
    if (data?.session) {
      setSessao(data.session);
    } else {
      // Permite inicialização direta autenticada com a sessão operacional padrão
      setSessao({ user: { email: "gestao.loja03@uniaosupermercados.com.br" } });
    }
    setAuthCarregando(false);
  });
  ```
- **Conclusão Técnica Comprovada:**
  1. `gestao.loja03@uniaosupermercados.com.br` **NÃO é uma pessoa real nem um acesso externo indevido**. É uma **string hardcoded de sessão padrão (fallback)** inserida em `src/App.jsx` (linha 229) para que a aplicação abrisse diretamente em `localhost:5173` sem bloquear o usuário na tela de login caso não houvesse uma sessão ativa do Supabase Auth no navegador.
  2. Como `handleMutateDb` (`src/App.jsx`, linha 263) registra nos logs de auditoria `actorEmail: sessao?.user?.email`, **toda ação realizada pelo próprio operador enquanto estava nessa sessão automática foi gravada no log com o e-mail `gestao.loja03@uniaosupermercados.com.br`**.
  3. Além disso, o registro inicial de auditoria `LOG_INIT_01` com o e-mail `arquitetura@uniaosupermercados.com.br` foi criado estaticamente pelo seed em `src/domain/seedLoja03.js` (linhas 456–467).
- **Segurança e Autorização (RBAC)**:
  - Atualmente, o seletor de perfil (`ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) em `AdminAndAuditModule.jsx` (linhas 48–56) altera apenas uma variável de estado React (`currentUserRole` em `src/App.jsx`, linha 221). A validação `assertPermission` ocorre no frontend antes de chamar `ErpRepository.saveDatabase`. Não há validação de perfil via Row Level Security (RLS) no backend Supabase.

---

## 12. PROBLEMAS CONFIRMADOS, LIMITAÇÕES, RISCOS E RECOMENDAÇÕES (SEÇÕES 16 A 20)

> **A matriz completa classificada por severidade, impacto e localização exata encontra-se no documento complementar `WORKFORCE_ERP_BACKLOG_TECNICO.md`.**

### Síntese das Recomendações Técnicas (Para o Plano de Reestruturação Futura)
1. **Grade de Escala Mensal (`ScheduleGridModule.jsx`)**:
   - Remover a compressão das 43 colunas (`minWidth` adequado + rolagem horizontal fluida com `position: sticky` nas colunas de código/posto/colaborador à esquerda).
   - Substituir o clique cíclico cego (`T → F → A → T`) por uma **Barra de Ferramentas / Pincel de Edição Rápida** (ou popover de célula) que permita aplicar diretamente `Trabalho (T)`, `Folga (F)`, `Folga Adicional (A)`, `Meio Expediente (½)`, `Mercado Fechado (FECH)` e `Almoço 1..4` sem conflito de clique no domingo.
   - Adicionar a função **"Limpar / Construir Escala Manual do Mês"** e **"Bloquear Edição em Escala Publicada (exigir Reabertura)"**.
2. **Seletor Global de Empresa e Unidade (`App.jsx`)**:
   - Mover o seletor de Unidade para o topo da Sidebar em `App.jsx` e aplicar o filtro de `selectedUnitId` em **todos** os módulos (especialmente `EmployeesAndAvailabilityModule.jsx` e `RulesShiftsAndCalendarModule.jsx`).
   - Adicionar tela/modal para editar os dados da Empresa (`legalName`, `tradeName`, `cnpj`) e Unidades.
3. **Fluxo Unificado de Movimentação e CRUD Completo**:
   - Permitir editar dados cadastrais de Colaboradores, Postos, Jornadas Contratuais (`workShifts`), Regras (`scheduleRules`) e itens do Calendário Operacional (`marketCalendarDays`).
   - Unificar em um único modal do Colaborador a alteração de Posto/Função, Jornada e Regra de Escala com data de vigência.
4. **Consultas Analíticas com Períodos Flexíveis (`DashboardAndBiModule.jsx`)**:
   - Substituir o seletor restrito a 4 semanas fixas por um seletor de período flexível: **Dia Específico, Semana, Quinzena (1ª/2ª), Mês Completo e Intervalo Personalizado (`De` → `Até`)**, renomeando *"Estoque"* para *"Posição do Quadro na Data"*.
5. **Autenticação Real sem Identidade Simulada**:
   - Remover o fallback automático `gestao.loja03@uniaosupermercados.com.br` de `src/App.jsx` (linha 229), exigindo login real ou identificando explicitamente quando estiver em `"Modo Demonstração Local"`.
