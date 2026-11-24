# Análise Arquitetural e Estática do Sistema — Workforce ERP v8.0.0-ERP

> **Documento gerado na Etapa 1 (Fase A — Análise Estática)**
> **Projeto**: Sistema Corporativo de Gestão de Quadro, Alocação e Escalas Operacionais (`escala-de-folga-automatiazda`)
> **Versão no Código-Fonte**: `8.0.0-ERP` (Workforce Management & Scale ERP)
> **Status da Verificação**: Análise estática integral concluída sobre 100% do código-fonte + execução da suíte de testes unitários em memória (`40/40 PASS`). Nenhuma modificação foi realizada no código de produção ou no banco de dados.

---

## 1. Stack Tecnológica, Estrutura do Projeto e Comandos de Execução

### 1.1 Stack Tecnológica
| Camada | Tecnologia / Biblioteca | Versão Declarada (`package.json`) | Observações Técnicas de Uso Real no Código |
| :--- | :--- | :--- | :--- |
| **Runtime / Bundler** | Vite + `@vitejs/plugin-react` | `^8.0.8` / `^6.0.1` | Servidor de desenvolvimento HMR e build estático SPA. |
| **UI Framework** | React + React DOM | `^19.2.4` | Arquitetura SPA baseada em componentes funcionais e hooks (`useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`). |
| **Estilização** | CSS-in-JS Inline + `@media print` | Nativo (Objetos JS `const ui = {...}`) | Embora `tailwindcss` (`^4.2.2`) e `@tailwindcss/vite` estejam instalados em `package.json` e registrados em `vite.config.js`, 100% das telas em `src/modules/` utilizam objetos de estilo inline e folha de impressão dedicada em `src/App.jsx` (`@page { size: landscape; margin: 7mm; }`). |
| **Persistência / BaaS** | `@supabase/supabase-js` + Web Storage | `^2.103.3` | Persistência híbrida: partições JSONB na tabela `configuracoes` do Supabase (`__ERP_PARTITIONED_CORE_V8__` e `__ERP_SCHED_V8__<unitId>`), cache secundário em `localStorage` (`erp_relational_db_v8_cache`) e sessão em `sessionStorage` (`erp_v8_verified_operator_session`). |
| **Roteamento** | Estado React (`activeModule`) | Nativo (`src/App.jsx`) | **Não utiliza** `react-router-dom`. A navegação ocorre em URL única (`/`) controlada pelo estado `activeModule` e sub-abas internas (`subTab` / `centralTab`) de cada módulo. |
| **Testes Automatizados** | Node.js Test Runner (`node:test` + `node:assert/strict`) | Nativo do Node.js | Suíte de testes automatizados em `src/tests/scheduleEngine.test.js` com **40 cenários** (`40 pass, 0 fail`). |
| **Qualidade / Linter** | ESLint (`eslint.config.js`) | `^9.39.4` | Configurado com `eslint-plugin-react-hooks` e `eslint-plugin-react-refresh`. |

### 1.2 Estrutura de Diretórios e Arquivos do Projeto
```text
d:\Coding\Projects\Escala de Folga Automatizada\
├── index.html                                      # Ponto de entrada HTML ("União Supermercados | Gestão de Escalas")
├── package.json                                    # Manifesto NPM, scripts e dependências
├── vite.config.js                                  # Configuração Vite (React + Tailwind plugin)
├── eslint.config.js                                # Regras de linting JS/JSX
├── escala_novembro_2026_loja3.csv                  # Planilha CSV de referência da Loja 03
├── src/
│   ├── main.jsx                                    # Bootstrap React (<StrictMode><App /></StrictMode>)
│   ├── App.jsx                                     # Shell corporativo, Login (TelaLogin), Sidebar, Topbar, Estado Global e Mutator RBAC
│   ├── domain/
│   │   ├── scheduleEngine.js                       # Motor algorítmico puro (1.814 linhas): jornadas 8 colunas, gerador 5x1/5x2/6x1, validador 10 níveis, BI e rateio
│   │   └── seedLoja03.js                           # Seed oficial da Loja 03 (847 linhas): 74 postos (70 próprios + 4 rateio), 13 setores, 31 funções, Outubro e Novembro/2026
│   ├── services/
│   │   └── erpRepository.js                        # Camada de persistência híbrida (515 linhas): Supabase + LocalStorage, migração v7->v8, RBAC e merge concorrente
│   ├── modules/
│   │   ├── DashboardAndBiModule.jsx                # Módulo 1 (945 linhas): Posição do Quadro na Data (Fotografia) e Inteligência Analítica por Período Flexível
│   │   ├── ScheduleGridModule.jsx                  # Módulo 2 (2.557 linhas): Grade Mensal, Modo Pincel, Popover Contextual, Undo/Redo, Validação 10 Níveis e Publicação
│   │   ├── OrganizationAndPositionsModule.jsx      # Módulos 3 e 4 (1.302 linhas): Empresa, Unidades, Setores, Funções e Gestão Completa de Postos/Vagas
│   │   ├── EmployeesAndAvailabilityModule.jsx      # Módulos 5 e 6 (1.555 linhas): Colaboradores, Central do Colaborador (Promoção, Rateio, Histórico) e Férias/Afastamentos
│   │   ├── RulesShiftsAndCalendarModule.jsx        # Módulos 7 e 8 (1.479 linhas): Regras (Simples/Avançado), Jornadas Contratuais (8 Colunas) e Calendário Operacional
│   │   └── AdminAndAuditModule.jsx                 # Módulo 9 (533 linhas): Operadores Autorizados, Simulador RBAC, Backup JSON, Restauração Seed e Trilha de Auditoria
│   └── tests/
│       └── scheduleEngine.test.js                  # Suíte automatizada (1.624 linhas) com 40 cenários cobrindo motor de escalas, RBAC, concorrência e regressões v8
├── supabase/
│   └── migrations/
│       └── 20261028_erp_complete_schema.sql        # DDL PostgreSQL com 18 tabelas normalizadas (documental; o runtime atual usa partições JSONB em `configuracoes`)
├── backups/
│   └── backup_pre_v8_20261028.json                 # Snapshot de segurança pré-migração v8
├── docs/
│   └── ai-tutorials/                               # Entregáveis desta Etapa 1 (Diagnóstico e Planejamento de Vídeos Tutoriais)
└── WORKFORCE_ERP_*.md                              # 5 documentos técnicos de auditoria e especificação do ERP
```

### 1.3 Comandos de Execução Disponíveis
| Comando | Script Executado | Finalidade | Impacto em Dados |
| :--- | :--- | :--- | :--- |
| `npm run dev` | `vite` | Inicia o servidor local de desenvolvimento (porta padrão `5173`). | No primeiro carregamento sem dados remotos, `loadDatabase()` pode inicializar o seed; mutações na UI gravam em `localStorage` e no Supabase (`configuracoes`). |
| `npm run build` | `vite build` | Compila o bundle estático de produção em `dist/`. | Somente leitura/build local. |
| `npm run preview` | `vite preview` | Serve o bundle compilado localmente para homologação. | Igual ao `dev` ao interagir na UI. |
| `npm test` | `node --test src/tests/scheduleEngine.test.js` | Executa os 40 cenários de teste automatizados em memória. | **100% seguro (somente memória)** — não realiza chamadas de escrita nem leituras no Supabase. |
| `npm run lint` | `eslint .` | Analisa conformidade estática do código JS/JSX. | Somente leitura. |

---

## 2. Rotas, Páginas e Navegação (Arquitetura State-Driven SPA)

> [!IMPORTANT]
> **Ausência de Rotas por URL**: O sistema não utiliza `react-router-dom`, `pathname` ou `hash` (`#/`). Toda a aplicação é servida na rota única `/` e controlada pelo estado `activeModule` em [`src/App.jsx`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/App.jsx#L361-L378). Para o futuro robô gerador de vídeos tutoriais, toda transição de tela deve ocorrer via clique nos botões do menu lateral (`aside.no-print`) ou botões de navegação interna (`onNavigate`).

### 2.1 Tela de Autenticação (`TelaLogin` — `src/App.jsx`, linhas 23–358)
Exibida quando `sessao === null` (sem sessão em `sessionStorage` nem sessão ativa no Supabase Auth). Oferece 3 abas (`modo`):
1. **`identificado` ("Acesso Operador Identificado")**: Autenticação nominal rápida com validação de:
   - Nome completo do operador (`nomeOperador.trim().length >= 3`).
   - E-mail corporativo válido (bloqueia explicitamente o e-mail genérico legado `gestao.loja03@uniaosupermercados.com.br`).
   - Perfil de acesso inicial (`roleProfile`: `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`).
   - Persiste em `sessionStorage` sob a chave `erp_v8_verified_operator_session` com `authVerificationStatus: "VERIFIED_OPERATOR_SESSION"`.
2. **`supabase_login` ("Login Senha")**: Autenticação via `sb.auth.signInWithPassword({ email, password })`, definindo `authVerificationStatus: "VERIFIED_SUPABASE_AUTH"`.
3. **`supabase_cadastro` ("Criar Conta")**: Criação de conta via `sb.auth.signUp({ email, password })` (mínimo 6 caracteres).

### 2.2 Seletores Globais de Contexto (Sidebar + Topbar — `src/App.jsx`, linhas 630–815)
Sempre visíveis após o login e determinam o contexto global de todos os módulos:
- **Unidade / Filial Ativa (`selectedUnitId`)**: `<select>` na Sidebar filtrando as unidades ativas autorizadas para o operador (`LOJA_03`, `LOJA_01`, `LOJA_02`).
- **Competência Mensal Ativa (`selectedYearMonth`)**: `<input type="month">` na Sidebar e na Topbar (padrão `"2026-11"`), com indicador se a escala está `PUBLISHED` ou `DRAFT`.
- **Atalhos Rápidos na Topbar**: Indicador de sincronização (`Sincronizado v8.0`, `Salvando partição...`, `Salvo com segurança`), badge do operador e perfil RBAC, e botão `Sair`.

### 2.3 Mapa das 9 Telas Principais (`NAV_ITEMS` em `src/App.jsx`)
| Ordem | ID (`activeModule`) | Rótulo no Menu Lateral | Componente Renderizado | Prop `initialTab` | Sub-abas / Modais Internos |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `dashboard` | `📊 Dashboard e Indicadores` | `DashboardAndBiModule` | — | Seletor de Fotografia na Data (`referenceDate`) + 5 Modos de Período (`DAY`, `WEEK`, `FORTNIGHT`, `MONTH`, `CUSTOM`) + Drilldown |
| 2 | `schedules` *(Padrão)* | `📅 Escalas Mensais` | `ScheduleGridModule` | — | Barra de Pincéis (`BRUSH_TOOLS`), Popover Contextual de Célula, Modais de Construção Manual, Limpar Mês, Checklist de Validação, Impacto Futuro e Reabertura |
| 3 | `organization` | `🏛️ Estrutura Organizacional` | `OrganizationAndPositionsModule` | `"structure"` | Sub-aba `structure` ("🏛️ Empresa, Unidades, Setores e Funções") e `positions` ("🪑 Quadro de Postos e Vagas") |
| 4 | `positions` | `🪑 Quadro de Postos e Vagas` | `OrganizationAndPositionsModule` | `"positions"` | Mesmas sub-abas acima, iniciando em `positions` + Modal de Edição Completa de Posto (`editingPos`) |
| 5 | `employees` | `👥 Colaboradores` | `EmployeesAndAvailabilityModule` | `"employees"` | Sub-aba `employees` + **Central de Gestão do Colaborador** (4 abas internas: `profile`, `movement`, `rateio`, `history`) |
| 6 | `vacations` | `🏖️ Férias e Afastamentos` | `EmployeesAndAvailabilityModule` | `"unavailability"` | Sub-aba `availability` ("🏖️ Férias, Licença Maternidade, INSS e Aviso Prévio") |
| 7 | `rules_shifts` | `⏱️ Jornadas e Regras` | `RulesShiftsAndCalendarModule` | `"rules"` | Sub-aba `rules` (Jornadas de 8 Colunas + Motor de Regras Simples/Avançado + Vigência Temporal) e `calendar` |
| 8 | `calendar` | `🗓️ Calendário Operacional` | `RulesShiftsAndCalendarModule` | `"calendar"` | Sub-aba `calendar` ("🗓️ Calendário Operacional do Mercado — Feriados, Domingos e Meio Expediente") |
| 9 | `admin` | `🔐 Administração e Auditoria` | `AdminAndAuditModule` | — | Simulador RBAC, Cadastro de Operadores Autorizados (`userProfiles`), Backup/Seed e Trilha de Auditoria Verificada |

---

## 3. Componentes, Menus, Formulários e Ações Importantes por Módulo

### 3.1 `DashboardAndBiModule.jsx` (Dashboard Executivo, Fotografia na Data e BI de Período Flexível)
- **Seção 1 — Posição do Quadro na Data (Fotografia em `referenceDate` vs Fluxo de `selectedYearMonth`)**:
  - Seletor `Competência Base` (`<input type="month">`) e `📸 Posição do Quadro na Data` (`<input type="date">`).
  - **7 KPIs Executivos**:
    1. `Postos Planejados (Quadro Próprio)` (+ postos de Rateio e preenchidos).
    2. `Vagas Preenchidas (Ocupação)` (% de ocupação + vagas abertas).
    3. `Vagas em Aberto (Autorizadas)` (incluindo não planejadas e congeladas).
    4. `Férias na Data (Fotografia)` (mostra em subtítulo quantos tiveram férias no fluxo do mês inteiro, separando fotografia diária de fluxo mensal).
    5. `Licença Maternidade / INSS na Data`.
    6. `Disponíveis para Operação na Data` (aptos a trabalhar na data selecionada).
    7. `Trabalhando na Data (Escalados T / 1/2)`.
- **Seção 2 — Inteligência Analítica por Período Flexível (`computeFlexiblePeriodAnalytics`)**:
  - **5 Botões de Modo de Período (`periodMode`)**:
    - `📅 Dia Específico` (`DAY`)
    - `📆 Semana do Mês (1ª a 5ª)` (`WEEK` — inclui a 5ª semana cobrindo os dias 29 a 31!)
    - `🌗 Quinzena (1ª ou 2ª)` (`FORTNIGHT` — 01 a 15 ou 16 ao fim do mês)
    - `🗓️ Mês Completo` (`MONTH`)
    - `🔍 Intervalo Personalizado` (`CUSTOM` — permite cruzar fronteira de meses, ex.: `2026-10-25` a `2026-11-05`)
  - **Filtros Dimensionais**: Setor (`querySectorId`), Função (`queryRoleId`) e Turno (`queryShiftPeriod`: `ALL`, `MANHÃ`, `INTERMEDIÁRIO`, `TARDE`, `NOITE`).
  - **Métricas Duplas no Período**: Separa claramente **Colaboradores Únicos** (`uniqueEmployees`) de **Pessoas-Dia Acumuladas** (`personDays`) para Trabalhando, Meio Expediente, Folgando (`F`/`A`), Em Férias (`V`) e Afastados (`LM`/`INSS`), além de alertas de **Dias/Setores com Cobertura Insuficiente**.
  - **Linha do Tempo Diária do Período (`dailyTimeline`)**: Tabela dia a dia com status de cobertura e botão para expandir/recolher o **Drilldown Nominal de Lançamentos (`showDrilldownRecords`)**.
- **Seção 3 — Mapa Analítico de Lotação por Setor (`sectorBreakdown`)** e **Distribuição de Almoço no Domingo (`sundayLunchStats`)**:
  - Exibe lotação setor a setor (Postos Próprios, Rateio, Preenchidos, Vagas Abertas, Férias na Data, Férias no Mês, Disponíveis, Escalados) e equilíbrio das 4 faixas de almoço (`N 01` a `N 04`).

### 3.2 `ScheduleGridModule.jsx` (Grade Mensal de Escalas — Core Operacional)
- **Cabeçalho de Governança e Ciclo de Vida**:
  - Exibe status atual (`DRAFT`, `VALIDATED`, `PUBLISHED`), versão da escala (`v1`, `v2`...) e contadores do Checklist (`blockingErrors` críticos vs `operationalWarnings` avisos).
  - **Botões Principais de Ação**:
    - `⚡ Gerar / Recalcular com Continuidade` (`handleGenerateMonthSchedule(true)` — gera/atualiza a escala lendo os últimos dias do mês anterior e preservando `MANUAL_OVERRIDE`).
    - `🛠️ Construir / Iniciar Escala Manual` (`setManualBuildModalOpen(true)` — abre modal com 3 opções: (A) Iniciar grade em branco `EMPTY` para preenchimento 100% manual, (B) Copiar estrutura de outro mês como `2026-10`, ou (C) Gerar sugestão automática integral).
    - `🧹 Limpar Mês` (`setClearMonthModalOpen(true)` — limpa apenas células automáticas ou 100% das células do mês).
    - `🍽️ Equilibrar Almoços Dom.` (`handleAutoBalanceSundayLunch` — redistribui automaticamente as faixas `1..4` nos domingos/feriados por setor e turno).
    - `↩️ Desfazer` (`handleUndo`) e `↪️ Refazer` (`handleRedo`) com pilha de 25 snapshots de sessão.
    - `✅ Validar Checklist (10 Níveis)` (`setValidationModalData` / `handleValidateSchedule`).
    - `🔒 Publicar Escala Oficial` (`handlePublishSchedule` — bloqueado caso existam erros impeditivos `blockingErrors.length > 0`).
    - `🔓 Reabrir Escala Publicada` (`setReopenModalOpen(true)` — exige justificativa formal de no mínimo 5 caracteres, incrementa `versionNumber` e grava histórico em `versionHistory`).
    - `🖨️ Imprimir Escala (Paisagem)` (`window.print()`).
- **Barra de Ferramentas de Edição Rápida — Modo Pincel (`BRUSH_TOOLS`)**:
  - Permite alternar entre `🖱️ Clique Contextual (Menu)` (`NONE`) e 9 pincéis de pintura rápida por clique ou arraste (`isMousePainting`):
    - `🖌️ Pincel: Trabalhando (T)`
    - `🖌️ Pincel: Folga Normal (F)`
    - `🖌️ Pincel: Folga Adicional (A)`
    - `🖌️ Pincel: Meio Expediente (1/2)`
    - `🍽️ Almoço 1 (09-10h)` a `🍽️ Almoço 4 (12-13h)`
    - `🧹 Borracha (Restaurar Automático)` (`AUTO_RESTORE`)
- **Filtros e Controles de Exibição da Grade**:
  - Busca por colaborador/posto (`searchEmp`), Filtro por Setor (`filterSectorId`), Turno (`filterShiftPeriod`), Status da Vaga (`filterStatus`), checkboxes `Mostrar Vagas em Aberto` (`showVacantPositions`), `Mostrar Últimos 6 Dias do Mês Anterior` (`showPrevMonthTail` — exibe a cauda do mês anterior na mesma linha para visualizar a continuidade!) e alternador de densidade (`Compacta` vs `Detalhada`).
- **Grade Matricial com Colunas Fixas (`position: sticky`)**:
  - Colunas fixas à esquerda: Posto/Código, Setor/Função, Colaborador Titular (com atalho para abrir ou admitir colaborador), Horário/Jornada, Regra de Escala, Última Folga Âncora, Resumo de Carga Mensal (`calculateEmployeeMonthlyWorkload`) e Status.
  - Colunas de Cauda do Mês Anterior (6 últimos dias em tom cinza) + Colunas do Mês Atual (`01..30/31`) + Resumo Individual (`T`, `F`, `Dom`, `Horas`).
  - Rodapé Diário Consolidado por Dia: Total Trabalhando (`T`), Folgas (`F`/`A`), Férias/Ausências e alertas de déficit diário.
- **Popover Contextual de Célula (`cellPopover`)**:
  - Ao clicar numa célula no modo `NONE`, abre menu flutuante permitindo:
    1. Definir Status do Dia (`T`, `F`, `A`, `MEIO_EXP`, `FECHADO`, `V`, `LM`, `INSS`, `EMPTY`) sem sobrescrever acidentalmente a faixa de almoço.
    2. Definir ou limpar a Faixa de Almoço de Domingo/Feriado (`1 (09h-10h)`, `2 (10h-11h)`, `3 (11h-12h)`, `4 (12h-13h)`) mantendo o status `T`.
    3. Iniciar **Troca de Folga entre Colaboradores (`swapTarget`)** no mesmo setor.
    4. Restaurar célula para cálculo automático (`origin: "AUTO_GENERATED"`).
- **Detector de Impacto em Escala Futura (`detectFutureScheduleImpact`)**:
  - Quando uma edição nos últimos 7 dias do mês (ex.: fim de Outubro) altera o estado de ciclo (`lastRestDate` / `consecutiveWorkDays`) e existe escala gerada no mês seguinte (Novembro), exibe banner amarelo/laranja de **Impacto Detectado na Escala do Mês Seguinte**, permitindo recalcular o mês seguinte preservando as edições manuais (`MANUAL_OVERRIDE`).

### 3.3 `OrganizationAndPositionsModule.jsx` (Estrutura Organizacional e Quadro de Postos)
- **Sub-aba 1 (`structure` — Empresa, Unidades, Setores e Funções)**:
  - **Cadastro da Empresa Principal (`handleSaveCompany`)**: Edição de Razão Social (`legalName`), Nome Fantasia (`tradeName`) e CNPJ (`cnpj`).
  - **Unidades / Lojas (`handleSaveUnit`, `handleToggleDeactivateUnit`)**: Criar, editar e desativar/reativar filiais (`LOJA_03`, `LOJA_01`, `LOJA_02`).
  - **Setores Operacionais (`handleSaveSector`, `handleToggleDeactivateSector`)**: Criar, editar cobertura mínima em dia útil (`minDailyCoverage`) e aos domingos (`minSundayCoverage`), e desativar/reativar setores.
  - **Funções / Cargos (`handleSaveRole`, `handleToggleDeactivateRole`)**: Criar, editar categoria funcional (`CAT_GESTAO`, `CAT_PERECIVEIS`, etc.), setor padrão, custo mensal projetado (`projectedMonthlyCost`) e desativar/reativar funções.
- **Sub-aba 2 (`positions` — Quadro de Postos e Vagas)**:
  - **Gerador Automático de Postos em Lote (`handleGenerateSequentialPositions`)**: Cria múltiplos postos sequenciais numerados (`createSequentialPositions`) definindo setor, função, jornada, regra de escala, quantidade, flag de Rateio (`isSharedRateio`), status inicial (`OPEN_AUTHORIZED`, `OPEN_UNPLANNED`, `FROZEN`) e custo estimado.
  - **Tabela do Quadro de Postos (74 postos na Loja 03)**: Filtros por setor, status da vaga (`FILLED`, `OPEN_AUTHORIZED`, `OPEN_UNPLANNED`, `FROZEN`, `DEACTIVATED`) e busca textual.
  - **Modal de Edição Completa de Posto (`editingPos` -> `handleSaveEditedPosition`)**: Permite editar código, título, setor, função, jornada padrão, regra de escala, status da vaga, flag de Rateio compartilhado, custo mensal estimado, orçamento autorizado e observações, além de **propagação automática** da nova jornada/regra para a alocação ativa do ocupante atual.
  - **Desativação / Exclusão Segura de Posto (`handleDeactivateOrDeletePosition`)**: Impede exclusão se houver colaborador ativo alocado; desativa preservando histórico ou remove caso nunca tenha tido vínculo.

### 3.4 `EmployeesAndAvailabilityModule.jsx` (Colaboradores, Central Unificada e Férias/Afastamentos)
- **Sub-aba 1 (`employees` — Quadro de Colaboradores e Central do Colaborador)**:
  - **Formulário Rápido de Admissão em Vaga Aberta (`handleHireEmployee`)**: Nome completo, matrícula (`MAT-XXXX`), data de admissão, seleção de posto vago (`vacantPositions`) e data da última folga âncora (`anchorLastRestDate`). Preenche automaticamente a vaga (`status = "FILLED"`) e cria a alocação inicial.
  - **Listagem de Colaboradores**: Filtro por unidade ativa ou checkbox `Mostrar Colaboradores de Todas as Unidades (Visão Corporativa)`, busca por nome/matrícula, badges dinâmicos de status (`ACTIVE`, `ON_VACATION`, `MEDICAL_LEAVE`, `MATERNITY_LEAVE`, `NOTICE_PERIOD`, `TERMINATED`) calculados por `computeDynamicEmploymentStatus`.
  - **Modal/Painel: Central de Gestão do Colaborador (`openCentralForEmployee`)** com 4 abas internas (`centralTab`):
    1. **`profile` ("1. Dados Cadastrais e Ciclo")**: Edição de nome, matrícula, admissão, data de desligamento (`terminationDate`), fim de aviso prévio (`noticePeriodEndDate`), última folga âncora (`anchorLastRestDate`) e observações (`handleSaveEmployeeProfileAndRateio`).
    2. **`movement` ("2. Promoção, Transferência e Mudança de Horário/Posto")**: Fluxo guiado (`handleExecuteGuidedMovement`) com 3 modalidades (`movType`):
       - `PROMOTION_TRANSFER`: Transferir ou promover para outra vaga aberta existente (na mesma loja ou em outra filial), liberando o posto antigo (`OPEN_UNPLANNED`) e preenchendo o novo (`FILLED`).
       - `SAME_POS_SHIFT_RULE`: Alterar apenas a Jornada de Horário e/ou Regra de Escala mantendo o mesmo posto.
       - `CREATE_NEW_POS`: Criar uma nova vaga/posto *inline* no ato da promoção e já alocar o colaborador nela sem precisar sair da tela!
    3. **`rateio` ("3. Rateio Multiunidade (Agenda Semanal)")**: Ativa `isSharedRateio`, seleciona as unidades autorizadas (`LOJA_03`, `LOJA_01`, `LOJA_02`) e configura a agenda semanal por dia da semana (`rateioScheduleByDow` de Segunda a Domingo: qual loja ou `FOLGA`, e período `INTEGRAL`, `MANHÃ`, `TARDE`).
    4. **`history` ("4. Histórico de Alocações e Eventos")**: Exibe toda a linha do tempo de cargos/postos ocupados pelo colaborador e seus eventos de férias/afastamentos, além do botão de **Desligamento / Exclusão Segura (`handleDeactivateOrDeleteEmployee`)**.
- **Sub-aba 2 (`availability` — Férias, Licença Maternidade, INSS e Aviso Prévio)**:
  - **Formulário de Registro e Edição de Evento (`handleSaveUnavailability`)**: Permite criar ou **editar** (`editingUnavId`) eventos do tipo `VACATION` (Férias), `MATERNITY_LEAVE` (Licença Maternidade), `MEDICAL_LEAVE` (Afastamento INSS / Médico), `NOTICE_PERIOD` (Aviso Prévio Trabalhado) e `UNPAID_LEAVE` (Licença Não Remunerada), definindo período (`startDate` a `endDate`) e comportamento do ciclo no retorno (`RESET_ON_RETURN` ou `PRESERVE_PHASE`).
  - Ao salvar, **recalcula dinamicamente** o `employmentStatus` do colaborador e **atualiza automaticamente** os lançamentos diários das escalas mensais afetadas (`V`, `LM`, `INSS`).
  - **Exclusão de Evento (`handleDeleteUnavailability`)**: Remove o evento, restaura o status `ACTIVE` do colaborador e regenera automaticamente os dias afetados na escala mensal!

### 3.5 `RulesShiftsAndCalendarModule.jsx` (Jornadas de 8 Colunas, Regras em 2 Níveis e Calendário)
- **Sub-aba 1 (`rules` — Jornadas Contratuais + Motor de Regras)**:
  - **Catálogo e Formulário CRUD de Jornadas Contratuais de 8 Colunas (`handleSaveShift`)**:
    - Campos das 8 colunas: (1) Entrada (`entryTime`), (2) Início Intervalo (`breakStart`), (3) Fim Intervalo (`breakEnd`), (4) Saída Base s/ Hora Extra (`exitBaseTime`), (5) Carga Horária Base (`baseWorkload`), (6) Prorrogação/Complemento (`extensionWorkload`), (7) Saída Efetiva Real (`effectiveExitTime`), (8) Carga Contratual Diária (`contractDailyWorkload`).
    - **Validador Aritmético em Tempo Real (`liveShiftMetrics` via `calculateShiftMetrics`)**: Calcula duração do intervalo, carga base derivada, prorrogação derivada (incluindo turnos que cruzam meia-noite `00:00`), aponta divergências aritméticas e violações de intrajornada CLT (< 1h para jornada > 6h), e possui botão `⚡ Auto-Calcular Cargas Horárias`.
    - Ações na tabela de jornadas: `Editar`, `Duplicar` (`loadShiftIntoForm(sh, true)`) e `Desativar/Reativar` (`handleToggleDeactivateShift`).
  - **Motor de Regras de Escala em 2 Níveis (`handleSaveRule`)**:
    - **Modo Simples (`ruleConfigMode === "simple"`)**: Seleção de 7 templates prontos (`SIMPLE_RULE_TEMPLATES`: `5x1 Contínuo`, `5x2 Fim de Semana Fixo`, `5x2 Corrido Rotativo`, `6x1 Folga Fixa no Domingo`, `6x1 Revezamento Dom/Seg`, `6x1 Revezamento Sáb/Dom`, `6x1 Revezamento Sáb/Dom/Seg`) com **Simulador Visual de 14 Dias (`preview`)**.
    - **Modo Avançado (`ruleConfigMode === "advanced"`)**: Parametrização técnica completa (`workDaysInCycle`, `restDaysInCycle`, `maxConsecutiveWorkDays`, checkboxes de dias da semana permitidos para folga `allowedRestDows`, `fixedWeekdays`, `requiresSundayLunchSlot`, `closedMarketCountsAsRest`).
  - **Exceção / Mudança de Regra com Vigência Temporal (`handleCreateRuleOverride`, `handleDeleteRuleOverride`)**:
    - Permite vincular uma regra temporária (`ruleAssignments`) a um colaborador específico com data de início (`effectiveFrom`) e fim opcional (`effectiveTo`).
- **Sub-aba 2 (`calendar` — Calendário Operacional do Mercado)**:
  - **Formulário de Feriados e Funcionamento (`handleSaveCalendarDay`)**: Configura para a unidade ativa (`selectedUnitId`) a data (`calendarDate`), tipo (`HOLIDAY`, `OPTIONAL_HOLIDAY`, `SPECIAL_OPERATION`, `SUNDAY`), modo de abertura (`FULL_DAY` Dia Inteiro, `HALF_DAY` Meio Expediente com horário de fechamento ex.: `13:00`, ou `CLOSED` Mercado Fechado) e se exige escala de almoço `N01-N04` (`requiresLunchScale`).
  - **Propagação Automática para a Escala**: Se já existir escala gerada no mês da data configurada, pergunta ou propaga automaticamente o status `FECHADO` ou `MEIO_EXP` para os colaboradores daquela loja naquela data!
  - Ações de `Editar` (`handleEditCalendarDay`) e `Remover` (`handleDeleteCalendarDay` — que também reverte células `FECHADO`/`MEIO_EXP` para o cálculo automático).

### 3.6 `AdminAndAuditModule.jsx` (Administração, Operadores, RBAC e Auditoria)
- **Painel de Controle de Acesso, Simulação RBAC e Backup**:
  - Exibe operador autenticado, e-mail e revisão atual do banco (`#schemaRevision`).
  - **Simulador RBAC**: Quando `simulationUnlocked` está ativo (padrão para `ADMIN` ou desbloqueável via botão `"Habilitar Simulador RBAC"`), exibe `<select>` permitindo alternar `currentUserRole` entre `ADMIN`, `MANAGER`, `OPERATOR` e `VIEWER`, atualizando os badges de permissões ativas.
  - Botão `💾 Exportar Backup Completo (JSON)` (`handleExportFullBackup`).
  - Botão `🔄 Restaurar Base Oficial Loja 03` (`onResetToSeed(buildInitialErpDatabase())`).
- **Cadastro de Operadores e Autorização por Unidade (`userProfiles` -> `handleSaveOperatorProfile`)**:
  - Permite cadastrar/editar operadores nominais, definir seu perfil RBAC (`ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) e marcar em quais lojas (`LOJA_03`, `LOJA_01`, `LOJA_02`) possuem permissão de acesso (`authorizedUnits`), além de ativar/desativar operadores.
- **Trilha de Auditoria Verificada (`db.auditLogs`)**:
  - Filtros por Módulo e por Status de Verificação de Autoria (`ALL`, `VERIFIED_SUPABASE_AUTH`, `VERIFIED_OPERATOR_SESSION`, `SYSTEM_SEED`, `AUTORIA_NAO_VERIFICADA_LEGADO`).
  - Distingue visualmente ações humanas verificadas de seeds de sistema e de registros legados da v7 (`gestao.loja03@uniaosupermercados.com.br`).

---

## 4. Serviços, APIs e Regras de Negócio

### 4.1 Persistência Particionada e Merge Concorrente (`src/services/erpRepository.js`)
1. **Particionamento no Supabase (`tabela configuracoes`)**:
   - **Partição Core v8**: `unidade = "__ERP_PARTITIONED_CORE_V8__"`, `mes = "2026-ERP"`.
   - **Partições de Escala por Unidade e Competência**: `unidade = "__ERP_SCHED_V8__<unitId>"`, `mes = "<YYYY-MM>"`.
   - **Backup Legado Intacto**: O registro `unidade = "__ERP_RELATIONAL_CORE_V7__"` nunca é sobrescrito, servindo como ponto de recuperação caso necessário.
   - **Cache Local**: Espelhado em `localStorage` sob a chave `erp_relational_db_v8_cache`.
2. **Merge Concorrente por Entidade e Unidade (`mergeConcurrentDatabaseStates`)**:
   - Incrementa `schemaRevision`.
   - Mescla `dailyEntriesByMonth[yearMonth]` isolando as entradas por `unitId` (para que a edição da escala da `LOJA_01` não sobrescreva a escala da `LOJA_03` no mesmo mês).
   - Faz merge por `id` (ou chave composta) nas 17 coleções cadastrais (`companies`, `units`, `sectors`, `unitSectors`, `functionalCategories`, `roles`, `workShifts`, `scheduleRules`, `ruleAssignments`, `workPositions`, `employees`, `allocations`, `unavailabilityEvents`, `marketCalendarDays`, `monthlySchedules`, `cycleStates`, `userProfiles`), respeitando criações, edições e exclusões concorrentes.

### 4.2 Motor Algorítmico de Escalas (`src/domain/scheduleEngine.js`)
1. **Cálculo de Jornadas de 8 Colunas (`calculateShiftMetrics` e `checkInterjornadaRest`)**:
   - Converte horários `HH:MM` tratando virada de meia-noite (`00:00`) tanto na jornada base quanto no intervalo intrajornada e na prorrogação (`effectiveExitTime`).
   - Verifica descanso interjornada mínimo de 11h (`660` minutos, Art. 66 CLT) entre a saída efetiva de um dia e a entrada do dia seguinte (inclusive quando a saída do dia anterior ocorreu após `00:00` ou quando o dia anterior foi `MEIO_EXP` fechando às `13:00`).
2. **Geração Mensal com Âncora e Continuidade (`generateEmployeeScheduleForMonth`)**:
   - **Continuidade Exata**: Calcula o estado inicial do mês a partir de `previousMonthEntries` (via `computeCycleStateFromEntries`) ou `previousCycleState` / `anchorLastRestDate`.
   - **Regras Suportadas**:
     - `5X1`: Trabalha exatamente 5 dias e folga 1 dia em ciclo contínuo entre meses.
     - `5X2`: Suporta modo fixo (`fixedWeekdays: true` -> folga Sáb/Dom) e modo rotativo contínuo (`fixedWeekdays: false` -> 5 dias trabalhados seguidos de 2 dias de folga consecutivos, inclusive cruzando de 31/10 para 01/11).
     - `6X1_DOM`: Trabalha de segunda a sábado e folga todos os domingos.
     - `6X1_FLEX` (`DOM/SEG`, `SAB/DOM`, `SAB/DOM/SEG`): Revezamento automático da folga dentro da janela permitida (`allowedRestDows`), garantindo espaçamento mínimo de 5 dias trabalhados entre folgas e respeitando `maxConsecutiveWorkDays` (6 ou 7 dias).
   - **Comportamento de Férias/Afastamentos (`cycleBehavior`)**: Suporta `RESET_ON_RETURN` (reinicia contagem do ciclo a partir do 1º dia de retorno ao trabalho) e `PRESERVE_PHASE` (preserva a fase acumulada antes do afastamento).
   - **Equilíbrio de Faixas de Almoço aos Domingos/Feriados (`balanceSectorSundayLunchSlots`)**: Distribui equitativamente as faixas `1` (`09h-10h`), `2` (`10h-11h`), `3` (`11h-12h`) e `4` (`12h-13h`) agrupadas por `sectorId` e `shiftPeriod`.
3. **Validação de Conflitos em 10 Níveis (`verifyScheduleConflicts` e `validateMonthlyScheduleChecklist`)**:
   - `UNFILLED_MANDATORY_DAY` (`CRITICAL`, bloqueante): Dia obrigatório com célula `EMPTY` para colaborador ativo.
   - `WORK_OUTSIDE_CONTRACT_DATES` (`CRITICAL`, bloqueante): Escalado antes de `hireDate` ou após `terminationDate`/`noticePeriodEndDate`.
   - `WORK_DURING_UNAVAILABILITY` (`CRITICAL`, bloqueante): Escalado como `T` ou `MEIO_EXP` durante Férias (`VACATION`), Licença Maternidade ou Afastamento INSS.
   - `WORK_ON_CLOSED_MARKET` (`CRITICAL`, bloqueante): Escalado trabalhando em dia com `openingMode === "CLOSED"`.
   - `RATEIO_UNIT_TIME_CONFLICT` (`CRITICAL`, bloqueante): Colaborador de rateio escalado simultaneamente em duas lojas no mesmo dia OU escalado em loja divergente da sua agenda semanal (`rateioScheduleByDow`).
   - `INTERJORNADA_REST_VIOLATION` (`HIGH`, aviso operacional): Descanso entre turnos consecutivos inferior a 11h.
   - `EXCESS_CONSECUTIVE_DAYS` (`HIGH`, aviso operacional): Sequência de dias trabalhados maior que `maxConsecutiveWorkDays` da regra.
   - `MINIMUM_COVERAGE_BREACH` (`CRITICAL`, aviso operacional): Total trabalhando no setor/dia abaixo de `minDailyCoverage` (ou `minSundayCoverage` aos domingos).
   - `MISSING_SUNDAY_LUNCH_SLOT` (`MEDIUM`, aviso operacional): Trabalho em domingo/feriado sem faixa de almoço (`1..4`).
   - `LUNCH_SLOT_SECTOR_IMBALANCE` (`MEDIUM`, aviso operacional): Desequilíbrio >= 2 colaboradores entre faixas de almoço do mesmo setor/turno no domingo.

---

## 5. Perfis de Usuário e Permissões Existentes (RBAC)

Definidos em [`src/services/erpRepository.js`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/services/erpRepository.js#L18-L76):

| Permissão (`permission`) | `ADMIN` | `MANAGER` | `OPERATOR` | `VIEWER` | Escopo Funcional |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `MANAGE_STRUCTURE` | ✅ | ❌ | ❌ | ❌ | Editar Empresa, Unidades, Setores, Funções e Restaurar Seed (`OrganizationAndPositionsModule` / `App.jsx`) |
| `CREATE_POSITIONS` | ✅ | ✅ | ❌ | ❌ | Gerar postos em lote, editar vagas e desativar/excluir postos (`OrganizationAndPositionsModule`) |
| `MANAGE_EMPLOYEES` | ✅ | ✅ | ✅ | ❌ | Admitir colaborador, editar cadastro/rateio e desligar colaborador (`EmployeesAndAvailabilityModule`) |
| `TRANSFER_EMPLOYEES` | ✅ | ✅ | ❌ | ❌ | Executar promoção/transferência/mudança de posto na Central do Colaborador (`EmployeesAndAvailabilityModule`) |
| `MANAGE_UNAVAILABILITY` | ✅ | ✅ | ✅ | ❌ | Cadastrar, editar e remover Férias, LM, INSS e Aviso Prévio (`EmployeesAndAvailabilityModule`) |
| `MANAGE_RULES_SHIFTS` | ✅ | ❌ | ❌ | ❌ | Criar/editar Jornadas de 8 Colunas, Regras de Escala e Vigências Temporais (`RulesShiftsAndCalendarModule`) |
| `MANAGE_MARKET_CALENDAR` | ✅ | ✅ | ❌ | ❌ | Configurar feriados, meio expediente e fechamento no Calendário Operacional (`RulesShiftsAndCalendarModule`) |
| `EDIT_SCHEDULE` | ✅ | ✅ | ✅ | ❌ | Pintar células (Pincel/Popover), trocar folgas, construir escala manual, limpar mês, Undo/Redo (`ScheduleGridModule`) |
| `VALIDATE_PUBLISH_SCHEDULE` | ✅ | ✅ | ❌ | ❌ | Validar checklist, publicar escala (`PUBLISHED`) e reabrir escala publicada (`ScheduleGridModule`) |
| `RECALCULATE_PROJECTIONS` | ✅ | ✅ | ✅ | ❌ | Gerar/recalcular escala com continuidade e equilibrar faixas de almoço (`ScheduleGridModule`) |
| `VIEW_BI` | ✅ | ✅ | ✅ | ✅ | Visualizar Dashboard Executivo e BI por Períodos Flexíveis (`DashboardAndBiModule`) |
| `MANAGE_USERS` | ✅ | ❌ | ❌ | ❌ | Cadastrar/editar operadores autorizados e unidades (`AdminAndAuditModule`) |

Además das permissões por perfil, `assertUnitAccess(userProfile, unitId)` restringe operadores não-`ADMIN` às unidades listadas em `userProfile.authorizedUnits`.

---

## 6. Testes Automatizados e Documentação Existente

### 6.1 Execução Verificada da Suíte de Testes (`src/tests/scheduleEngine.test.js`)
A execução do comando `node --test src/tests/scheduleEngine.test.js` validou **40 cenários automatizados com 100% de aprovação (`40 pass, 0 fail`)**:
- **Cenários 01 a 06**: Continuidade 5x1 entre meses, 5x2 fixo (Sáb/Dom), 6x1_DOM e revezamentos 6x1 (`DOM/SEG`, `SÁB/DOM`, `SÁB/DOM/SEG`).
- **Cenários 07 a 11**: Bloqueio de publicação com células `EMPTY`, independência entre status `T` e faixa de almoço `1..4`, âncora manual Outubro->Novembro, detector de impacto futuro (`detectFutureScheduleImpact`) preservando `MANUAL_OVERRIDE` e bloqueio/reabertura auditada de escala `PUBLISHED`.
- **Cenários 12 a 15**: Aritmética das 8 colunas de jornada (`calculateShiftMetrics`), violação intrajornada, descanso interjornada de 11h (`checkInterjornadaRest`), totalizador de carga mensal (`calculateEmployeeMonthlyWorkload`) e filtro de calendário por unidade.
- **Cenários 16 a 23**: Status dinâmico de férias (`computeDynamicEmploymentStatus`), INSS/Licença Maternidade/Aviso Prévio, criação de vaga inline na promoção, rateio multiunidade (conflito simultâneo em duas lojas), gerador sequencial de postos e vigência temporal de regras.
- **Cenários 24 a 26**: Inteligência Analítica na 5ª semana (dias 29–31), intervalo personalizado cruzando meses (25/10 a 05/11) e fotografia da Posição do Quadro na Data vs fluxo mensal.
- **Cenários 27 a 32**: Migração `upgradeDatabaseToV8`, merge concorrente (`mergeConcurrentDatabaseStates`), RBAC (`assertUnitAccess` / `assertPermission`), edição da Empresa, base real da Loja 03 (74 postos) e detecção de conflitos em 10 níveis.
- **Cenários 33 a 40 (Regressões v8 `BUG-001` a `BUG-008`)**: Espaçamento mínimo na `6X1_FLEX`, ciclo `5x2` rotativo na virada de mês, equilíbrio de almoço por setor/turno (`LUNCH_SLOT_SECTOR_IMBALANCE`), `RESET_ON_RETURN` vs `PRESERVE_PHASE` em férias, merge por ID sem perda de cadastros remotos, turnos/intervalos cruzando meia-noite (`00:00`), conflito de agenda semanal de rateio (`rateioScheduleByDow`) e avaliação dinâmica de datas de referência em `2027+`.

### 6.2 Documentação Legada vs Estado Atual do Código
Os 5 documentos `WORKFORCE_ERP_*.md` na raiz descrevem a auditoria realizada sobre a versão v7.0 e a especificação da v8.0. Todos os pontos ali listados — incluindo os cenários 33 a 40 de regressão — encontram-se implementados e passando nos testes no código atual (`v8.0.0-ERP`).
