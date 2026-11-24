# Análise de Segurança, Governança de Dados e Guardrails de Automação

> **Documento gerado na Etapa 1 (Fase A.7 e Restrições de Segurança)**
> **Objetivo**: Mapear todas as operações que alteram, excluem ou expõem dados no **Workforce ERP v8.0.0-ERP**, avaliar vulnerabilidades arquiteturais e estabelecer os protocolos de isolamento obrigatórios para a gravação autônoma de vídeos tutoriais.

---

## 1. Inventário de Operações Sensíveis (Mutação, Exclusão e Exposição)

### 1.1 Operações que Alteram Dados (`MUTATES_STATE_AND_DB`)
Todas as alterações de estado passam pelo dispatcher central [`handleMutateDb`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/App.jsx#L489-L558), que:
1. Valida permissão em cliente (`assertPermission` e `assertUnitAccess`).
2. Clona e atualiza o objeto `db` em memória.
3. Gera registro nominal em `db.auditLogs` (`ErpRepository.createAuditEntry`).
4. Enfileira gravação assíncrona em `saveQueueRef` chamando [`ErpRepository.saveDatabase`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/services/erpRepository.js#L412-L479), que executa `upsert` no Supabase (tabela `configuracoes`) e sobrescreve o `localStorage` (`erp_relational_db_v8_cache`).

| Módulo | Operação / Função | Entidade Afetada | Nível de Impacto |
| :--- | :--- | :--- | :--- |
| `ScheduleGridModule` | `applyCellModification` (Pincel ou Popover) | `dailyEntriesByMonth[ym]` | **Médio** — Altera status (`T`, `F`, `A`, `MEIO_EXP`, etc.) ou almoço (`1..4`) de um dia. |
| `ScheduleGridModule` | `handleExecuteSwap` | `dailyEntriesByMonth[ym]` | **Médio** — Inverte dias de trabalho/folga entre dois colaboradores. |
| `ScheduleGridModule` | `handleGenerateMonthSchedule(true)` | `dailyEntriesByMonth[ym]`, `cycleStates` | **Alto** — Recalcula todas as células não manuais do mês/unidade ativa. |
| `ScheduleGridModule` | `handleAutoBalanceSundayLunch` | `dailyEntriesByMonth[ym]` | **Médio** — Redistribui faixas de almoço `1..4` nos domingos/feriados. |
| `ScheduleGridModule` | `handleValidateSchedule` / `handlePublishSchedule` | `monthlySchedules` | **Alto** — Altera governança para `VALIDATED` ou `PUBLISHED` (congelando edições). |
| `ScheduleGridModule` | `handleConfirmReopenSchedule` | `monthlySchedules` | **Alto** — Reabre escala publicada para `DRAFT` e incrementa versão (`v2`, `v3`...). |
| `OrganizationAndPositionsModule` | `handleSaveCompany`, `handleSaveUnit`, `handleSaveSector`, `handleSaveRole` | `companies`, `units`, `sectors`, `unitSectors`, `roles` | **Alto** — Altera cadastros estruturais corporativos. |
| `OrganizationAndPositionsModule` | `handleGenerateSequentialPositions`, `handleSaveEditedPosition` | `workPositions`, `allocations` | **Alto** — Cria vagas em lote ou edita posto (propagando jornada/regra ao titular). |
| `EmployeesAndAvailabilityModule` | `handleHireEmployee`, `handleSaveEmployeeProfileAndRateio` | `employees`, `allocations`, `workPositions` | **Alto** — Admite colaborador preenchendo vaga ou altera cadastro/agenda de rateio. |
| `EmployeesAndAvailabilityModule` | `handleExecuteGuidedMovement` | `allocations`, `workPositions` | **Alto** — Promove/transfere colaborador de posto/loja ou cria vaga inline. |
| `EmployeesAndAvailabilityModule` | `handleSaveUnavailability` | `unavailabilityEvents`, `employees`, `dailyEntriesByMonth` | **Alto** — Lança/edita férias, LM ou INSS e sobrescreve os dias na escala mensal. |
| `RulesShiftsAndCalendarModule` | `handleSaveShift`, `handleSaveRule`, `handleCreateRuleOverride` | `workShifts`, `scheduleRules`, `ruleAssignments` | **Alto** — Altera catálogo de horários de 8 colunas e regras trabalhistas. |
| `RulesShiftsAndCalendarModule` | `handleSaveCalendarDay` | `marketCalendarDays`, `dailyEntriesByMonth` | **Alto** — Configura feriado/fechamento/meio expediente e propaga para a escala. |
| `AdminAndAuditModule` | `handleSaveOperatorProfile`, `handleToggleOperatorActive` | `userProfiles` | **Alto** — Altera permissões RBAC e unidades autorizadas de operadores. |

### 1.2 Operações Destrutivas ou de Sobrescrita em Massa (`DESTRUCTIVE_OPERATION`)
> [!CAUTION]
> As operações abaixo **nunca devem ser executadas contra o banco de produção (Supabase)** durante testes exploratórios ou gravações de vídeos sem que o interceptador de rede (Sandbox Mock) esteja ativo.

1. **Restauração da Base Oficial (`onResetToSeed` em `AdminAndAuditModule.jsx`, linha 189)**:
   - Sobrescreve todo o estado `db` no Supabase (`__ERP_PARTITIONED_CORE_V8__`) e no `localStorage` com o retorno de `buildInitialErpDatabase()`, descartando quaisquer cadastros ou edições feitas posteriormente.
2. **Limpeza Completa de Mês (`handleExecuteClearMonth(true)` em `ScheduleGridModule.jsx`)**:
   - Define todas as células da competência/unidade ativa como `EMPTY` (ou remove todas as edições manuais), apagando o planejamento mensal daquela filial.
3. **Construção Manual em Branco (`handleExecuteManualBuild("EMPTY")` em `ScheduleGridModule.jsx`)**:
   - Reinicia toda a grade do mês selecionado com células vazias (`EMPTY`).
4. **Recálculo Integral Descartando Edições Manuais (`handleGenerateMonthSchedule(false)`)**:
   - Regera a escala mensal ignorando e sobrescrevendo todos os ajustes manuais (`MANUAL_OVERRIDE`).
5. **Exclusão de Registros (`handleDeactivateOrDeletePosition`, `handleDeactivateOrDeleteEmployee`, `handleDeleteUnavailability`, `handleDeleteRuleOverride`, `handleDeleteCalendarDay`)**:
   - Remove entidades ou desativa vínculos estruturais e reverte lançamentos associados na grade.

### 1.3 Operações que Expõem Dados Sensíveis ou Corporativos (`DATA_EXPOSURE`)
1. **Exportação de Backup JSON (`handleExportFullBackup` em `AdminAndAuditModule.jsx`, linhas 67–79)**:
   - Gera download de arquivo `.json` contendo todas as coleções do banco: razão social, CNPJ, nomes completos de colaboradores, matrículas, datas de admissão/aviso prévio, afastamentos médicos (INSS/Licença Maternidade), e-mails de operadores e trilha de auditoria.
2. **Impressão Paisagem / PDF (`window.print()` em `ScheduleGridModule.jsx`)**:
   - Expõe a escala nominal completa da loja para impressão ou salvamento em PDF.
3. **Dados Corporativos e Pessoais no Código-Fonte e Arquivos do Repositório**:
   - [`src/domain/seedLoja03.js`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/domain/seedLoja03.js), [`escala_novembro_2026_loja3.csv`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/escala_novembro_2026_loja3.csv) e [`backups/backup_pre_v8_20261028.json`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/backups/backup_pre_v8_20261028.json) contêm dados reais da operação da Loja 03:
     - Empresa: `YUARA PRESTADORA SERVIÇOS LJ 03 LTDA` (CNPJ `40.633.037/0001-71`).
     - Nomes reais de colaboradores, situações de férias, aviso prévio e afastamento INSS.

---

## 2. Diagnóstico de Vulnerabilidades e Limitações de Segurança

### 2.1 Credenciais de Fallback Hardcoded no Código-Fonte
Em [`src/services/erpRepository.js`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/services/erpRepository.js#L10-L13), as constantes `SUPA_URL` e `SUPA_KEY` utilizam `import.meta.env?.VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, mas possuem valores literais de *fallback* apontando diretamente para uma instância real do Supabase (`*.supabase.co`) com um token JWT `anon` válido.
- **Risco**: Qualquer execução local de `npm run dev` com acesso à internet conectará automaticamente ao banco remoto no Supabase se não houver isolamento de rede ou variáveis de ambiente sobrescritas.

### 2.2 Autenticação e RBAC Executados Exclusivamente no Cliente (Client-Side)
1. **Acesso Operador Identificado (`sessionStorage`)**:
   - Na tela de login (`TelaLogin`), a aba padrão `"Acesso Operador Identificado"` não exige senha nem validação de token junto ao servidor: basta digitar qualquer nome (`>= 3` letras), qualquer e-mail (exceto o legado bloqueado) e escolher o perfil `ADMIN` no `<select>` para ingressar com poderes totais na interface.
2. **Desbloqueio Livre do Simulador RBAC**:
   - Em [`src/modules/AdminAndAuditModule.jsx`](file:///d:/Coding/Projects/Escala%20de%20Folga%20Automatizada/src/modules/AdminAndAuditModule.jsx#L169-L175), mesmo quando um usuário entra com perfil restrito (`VIEWER` ou `OPERATOR`), o botão `"Habilitar Simulador RBAC"` fica visível e permite que o próprio usuário desbloqueie o `<select>` e eleve seu `currentUserRole` em memória para `ADMIN`.
3. **Ausência de Enforcement RBAC no Banco (Supabase)**:
   - O cliente Supabase utiliza a chave anônima (`anon`) e grava diretamente na tabela `configuracoes` via `upsert`. As verificações `assertPermission` e `assertUnitAccess` ocorrem apenas no código JavaScript do navegador antes de chamar `ErpRepository.saveDatabase`.

---

## 3. Protocolo de Segurança Obrigatório para o Gerador Autônomo de Vídeos (Etapa 2)

Para que o sistema autônomo navegue pela aplicação, demonstre funcionalidades de escrita (como pintar células, cadastrar férias, promover colaboradores ou publicar escalas) e grave vídeos **sem jamais alterar o banco de dados real nem expor dados sensíveis indevidamente**, a Etapa 2 deverá implementar obrigatoriamente os 4 *guardrails* abaixo:

### Guardrail 1 — Interceptação Total de Rede (Supabase Offline/Mock Interceptor)
Antes de abrir a aplicação no navegador automatizado (Playwright / Antigravity Browser), o runner deve interceptar todas as requisições HTTP destinadas a `*.supabase.co/**`:
- **`GET /rest/v1/configuracoes*`**: Retornar `200 OK` com array vazio `[]` (ou snapshot controlado em memória), forçando `ErpRepository.loadDatabase()` a utilizar exclusivamente o seed local em memória (`buildInitialErpDatabase()`) e o `localStorage` efêmero da sessão de gravação.
- **`POST / PUT / PATCH / DELETE /rest/v1/configuracoes*`**: Retornar `200 OK` simulado (`[]`) sem transmitir nenhum pacote para a internet. Isso garante **risco zero de mutação no banco de dados remoto**, permitindo demonstrar qualquer ação na UI com feedback visual real (`"Salvo com segurança"`).

### Guardrail 2 — Contexto de Navegador Efêmero e Isolado por Vídeo
Cada vídeo tutorial deve ser gravado em um `BrowserContext` limpo e descartável:
- Antes de cada roteiro, o `localStorage` (`erp_relational_db_v8_cache`) e o `sessionStorage` (`erp_v8_verified_operator_session`) são pré-populados com um estado determinístico (Seed Homologado).
- Ao término da gravação do vídeo, o contexto é destruído, evitando que mutações de um vídeo contaminem o vídeo seguinte.

### Guardrail 3 — Modo de Sanitização / Mascaramento de Dados Pessoais (Opcional/Parametrizável)
Para vídeos destinados a treinamento externo ou portfólio público:
- O injetor de estado inicial poderá aplicar uma função de anonimização sobre `db.companies` (ex.: `"SUPERMERCADO MODELO LTDA"`, CNPJ `"00.000.000/0001-91"`) e `db.employees` (substituindo nomes reais e observações médicas de INSS por nomes fictícios padronizados), mantendo intacta toda a estrutura de 74 postos, 13 setores e regras matemáticas.

### Guardrail 4 — Proibição de Exposição de Segredos nos Artefatos
- Nenhum roteiro, legenda, narração ou log gerado pelo pipeline poderá exibir chaves de API (`VITE_SUPABASE_ANON_KEY`), URLs internas do projeto Supabase ou tokens JWT.
