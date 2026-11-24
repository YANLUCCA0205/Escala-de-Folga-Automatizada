# WORKFORCE ERP — MAPA DE TELAS, COMPONENTES E FLUXOS (`WORKFORCE_ERP_MAPA_DE_TELAS.md`)

**Data da Auditoria:** 28/10/2026

---

## 1. ESTRUTURA DE NAVEGAÇÃO PRINCIPAL (`src/App.jsx`)

A aplicação não utiliza `react-router-dom`. O roteamento entre módulos é controlado pelo estado local `const [activeModule, setActiveModule] = useState("schedules")` (`src/App.jsx`, linha 218) através dos botões da barra lateral esquerda (`NAV_ITEMS`, linhas 198–205).

```text
[App.jsx — Shell Principal]
 ├── TelaLogin (exibida apenas se sessao === null)
 └── Layout ERP (Sidebar Esquerda 245px + Main Area Flex)
      ├── 1. "dashboard"  → <DashboardAndBiModule />
      ├── 2. "schedules"  → <ScheduleGridModule /> (Tela inicial padrão)
      ├── 3. "workforce"  → <OrganizationAndPositionsModule />
      │       ├── Sub-aba "positions" (Padrão) → Quadro de Vagas e Postos (Módulo B)
      │       └── Sub-aba "structure"          → Setores, Categorias e Funções (Módulo A)
      ├── 4. "employees"  → <EmployeesAndAvailabilityModule />
      │       ├── Sub-aba "employees" (Padrão) → Cadastro, Alocações e Transferências (Módulo C)
      │       └── Sub-aba "availability"       → Férias, Licenças, INSS e Aviso Prévio (Módulo F)
      ├── 5. "rules"      → <RulesShiftsAndCalendarModule />
      │       ├── Sub-aba "calendar" (Padrão)  → Calendário de Abertura do Mercado
      │       ├── Sub-aba "rules"              → Regras de Escala e Vigências Temporais (Módulo D)
      │       └── Sub-aba "shifts"             → Jornadas Contratuais (8 Colunas) e Almoço N01-N04
      └── 6. "admin"      → <AdminAndAuditModule /> (Módulo H)
```

---

## 2. INVENTÁRIO DETALHADO POR TELA E SUB-ABA

### TELA 1 — Dashboard & BI (`src/modules/DashboardAndBiModule.jsx`)
- **Estados Locais:** `referenceDate` (`YYYY-MM-DD`), `querySectorId`, `queryWeekNum` (`1..4`).
- **Filtros Superiores:**
  - `Unidade` (`selectedUnitId` global)
  - `Competência (Fluxo)` (`selectedYearMonth` global, input `type="month"`)
  - `Data de Referência (Estoque)` (`referenceDate`, input `type="date"`)
- **Componentes Visuais:**
  1. **6 Cards de KPIs Executivos (`<KpiCard />`)**: Postos Planejados, Postos Preenchidos, Postos Vagos, Disponíveis na Data, Escalados Trabalhando, Contratações Autorizadas.
  2. **Tabela "Quadro Quantitativo por Setor"**: 12 colunas comparando Estoque na data e Fluxo no mês, com linha de totalização no `<tfoot>` e botão `"Gerenciar Postos e Vagas →"` (que navega para `workforce`).
  3. **Seção "Inteligência Analítica — Consultas Operacionais Verificáveis"**: Seletor de Setor + Seletor de Semana (`1ª a 4ª Semana`) e 4 cards de resposta dinâmica.
- **Operações Ausentes nesta Tela:**
  - Não possui filtro de período personalizado (`dataInicio` a `dataFim`), quinzena ou mês completo nos cards de consulta analítica.
  - Não possui exportação da tabela de BI para CSV/Excel.

---

### TELA 2 — Escalas Mensais (`src/modules/ScheduleGridModule.jsx`)
- **Estados Locais:** `filterSectorId`, `filterShiftPeriod`, `searchEmp`, `showVacantPositions` (`true`), `showPrevMonthTail` (`true`), `impactReport` (`null | object`), `swapTarget` (`null | { emp, pos, isoDate }`).
- **Filtros e Ações na Barra Superior:**
  - Filtros: `Unidade`, `Competência (Mês/Ano)`, `Setor`, `Turno` (`Manhã`/`Tarde`), `Buscar Colaborador / Posto`.
  - Checkboxes: `Exibir últimos 6 dias do mês anterior`, `Exibir Postos Vagos / Congelados na Grade`.
  - Botões de Ação:
    - `🔄 Gerar c/ Continuidade de [Mês Anterior]` (`handleGenerateMonthSchedule(true)`)
    - `✓ Validar Escala` (`handleUpdateScheduleLifecycle("VALIDATED")`)
    - `📢 Publicar Escala` (`handleUpdateScheduleLifecycle("PUBLISHED")`)
    - `🖨️ Imprimir Paisagem` (`window.print()`)
- **Interações na Grade Mensal:**
  - **Clique esquerdo na célula de dia útil/sábado**: Alterna circularmente `T → F → A → T` (`handleToggleCellStatus`).
  - **Clique esquerdo sobre o número (`1..4`) em domingo/feriado trabalhado**: Alterna o horário de almoço `1 → 2 → 3 → 4 → 1` (`handleCycleLunchSlot`).
  - **Clique direito (`onContextMenu`) em uma célula de folga (`F` ou `A`)**: Abre o modal `"🔄 Sugestão de Troca Bilateral de Folga"` listando colegas do mesmo setor que trabalham nesse dia e possuem uma folga em outro dia do mês para permutar (`handleExecuteSwap`).
- **Operações Ausentes / Limitadas nesta Tela:**
  - Não há seletor direto (popover ou pincel) para atribuir `MEIO_EXP`, `FECHADO`, `F`, `A` ou `T` sem passar pelo ciclo de cliques.
  - Em domingos trabalhados, clicar no centro da célula aciona o `span` do horário de almoço (`ev.stopPropagation()`), dificultando mudar o domingo de `T` para `F`.
  - Não há botão para **Limpar Escala do Mês** para construir uma escala 100% manual do zero.
  - Não há trava impedindo clique de edição quando a escala está com status `PUBLISHED`.

---

### TELA 3 — Quadro & Estrutura (`src/modules/OrganizationAndPositionsModule.jsx`)

#### Sub-aba 3.1: `📋 Módulo B — Quadro de Vagas e Postos de Trabalho`
- **Ações Disponíveis:**
  - **Formulário "Criação Automática de Postos de Trabalho por Quantidade"**: Seleciona Unidade, Setor, Função, Jornada Padrão, Regra Padrão, Quantidade (`1..50`), Situação Inicial (`OPEN_AUTHORIZED`, `OPEN_UNPLANNED`, `FROZEN`), Custo Estimado e checkbox `Posto RATEIO`. Ao submeter (`handleCreateBatchPositions`), gera os postos numerados (`01..N`).
  - **Na Tabela de Postos**:
    - Alterar o `<select>` de **Situação da Vaga** (habilitado apenas quando o posto **não** possui ocupante ativo; desabilitado quando `FILLED`).
    - Editar o campo numérico de **Custo Est. (R$)** no evento `onBlur` (`handleUpdatePositionCost`).
- **Operações Ausentes:**
  - Não permite editar o título do posto, trocar a jornada/regra padrão de um posto já existente, editar o campo de observações (`notes`) ou excluir fisicamente um posto cadastrado por engano.

#### Sub-aba 3.2: `🏢 Módulo A — Estrutura Organizacional`
- **Ações Disponíveis:**
  - Criar novo Setor (`+ Setor` via `handleCreateSector`).
  - Criar nova Função (`+ Cadastrar Função` via `handleCreateRole`).
- **Operações Ausentes:**
  - Não permite editar nem excluir Setores, Categorias Funcionais ou Funções já existentes.
  - Não possui seção para editar o cadastro da **Empresa** (`legalName`, `cnpj`) ou criar/editar **Unidades** (`LOJA 01`, `LOJA 02`, `LOJA 03`).

---

### TELA 4 — Colaboradores & Férias (`src/modules/EmployeesAndAvailabilityModule.jsx`)

#### Sub-aba 4.1: `👥 Módulo C — Cadastro, Alocações e Histórico Funcional`
- **Ações Disponíveis:**
  - **Formulário "Admitir / Vincular Colaborador a um Posto de Trabalho Vago"** (`handleHireEmployee`): Cria colaborador e aloca em uma vaga aberta.
  - **Botão `🔄 Transferir`** em cada linha da tabela: Abre modal para transferir o colaborador para outro posto vago a partir de uma `Data de Início da Nova Alocação`, preservando o histórico anterior (`handleExecuteTransfer`).
  - **Botão `📜 Histórico (N)`** em cada linha: Abre modal exibindo a linha do tempo de todas as alocações passadas e atuais do colaborador.
- **Operações Ausentes:**
  - Não filtra a tabela de colaboradores pela Unidade selecionada (`selectedUnitId`).
  - Não permite editar nome, matrícula, data de admissão ou data-âncora de última folga de um colaborador já cadastrado.
  - Não permite alterar apenas a Jornada ou a Regra do colaborador no próprio posto atual sem transferi-lo para outro posto vago.

#### Sub-aba 4.2: `🌴 Módulo F — Férias, Afastamentos, INSS e Aviso Prévio`
- **Ações Disponíveis:**
  - **Formulário de Registro de Evento** (`handleRegisterUnavailability`): Cadastra `VACATION` (Férias), `MATERNITY_LEAVE` (Licença Maternidade), `MEDICAL_LEAVE` (Afastamento INSS) ou `NOTICE_PERIOD` (Aviso Prévio / Desligamento).
  - **Botão `Remover`** na tabela de eventos (`handleRemoveUnavailability`).
- **Operações Ausentes:**
  - Não possui botão `Editar` para alterar datas de um evento já lançado (exige remover e lançar novamente).
  - Ao remover um evento de férias/INSS, `handleRemoveUnavailability` (linhas 225–237) remove o registro de `unavailabilityEvents`, mas **não reverte automaticamente** `employee.employmentStatus` de `"ON_VACATION"` de volta para `"ACTIVE"`.

---

### TELA 5 — Regras & Mercado (`src/modules/RulesShiftsAndCalendarModule.jsx`)

#### Sub-aba 5.1: `🗓️ Calendário de Abertura do Mercado`
- **Ações Disponíveis:**
  - Cadastrar/sobrescrever data no calendário (`handleSaveCalendarDay`) com tipo (`HOLIDAY`, `OPTIONAL_HOLIDAY`, `SUNDAY`, `CRITICAL_OFFER`, `PAYDAY`) e modo de abertura (`FULL_DAY`, `HALF_DAY`, `CLOSED`).
  - Remover data (`handleRemoveCalendarDay`).
- **Operações Ausentes:**
  - Não possui botão `Editar` na linha da tabela para carregar a data de volta no formulário.
  - Não filtra a tabela por `selectedUnitId`.

#### Sub-aba 5.2: `⚙️ Motor de Regras de Escala`
- **Ações Disponíveis:**
  - Criar nova regra parametrizada (`handleCreateRule`).
  - Cadastrar vigência temporal de regra para um colaborador (`handleAddRuleAssignment`).
- **Operações Ausentes:**
  - Não permite editar nem excluir regras existentes ou vigências temporais (`ruleAssignments`) já cadastradas.

#### Sub-aba 5.3: `⏰ Jornadas Contratuais & Escala de Intervalos`
- **Ações Disponíveis:** Somente leitura (exibe os 4 cards de `N 01` a `N 04` e a tabela de 14 jornadas contratuais).
- **Operações Ausentes:** Não possui formulário para criar, editar ou excluir jornadas (`workShifts`).

---

### TELA 6 — Admin & Auditoria (`src/modules/AdminAndAuditModule.jsx`)
- **Ações Disponíveis:**
  - Alternar perfil RBAC ativo (`ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`).
  - Exportar backup completo da base em JSON (`handleExportFullBackup`).
  - Restaurar base oficial da Loja 03 (`onResetToSeed`).
  - Filtrar tabela de logs de auditoria por módulo.
- **Operações Ausentes:**
  - Não possui importação de arquivo JSON de backup.
  - Não possui gerenciamento real de contas de usuários no Supabase Auth.
