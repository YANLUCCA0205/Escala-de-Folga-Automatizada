# WORKFORCE ERP — MODELO DE DADOS E PERSISTÊNCIA (`WORKFORCE_ERP_MODELO_DE_DADOS.md`)

**Data da Auditoria:** 28/10/2026  
**Arquivos Examinados:**
- `supabase/migrations/20261028_erp_complete_schema.sql` (267 linhas)
- `src/domain/seedLoja03.js` (492 linhas)
- `src/services/erpRepository.js` (145 linhas)
- `src/domain/scheduleEngine.js` (844 linhas)

---

## 1. ARQUITETURA DE PERSISTÊNCIA ATUAL (SQL DDL vs. DOCUMENTO JSONB)

É fundamental distinguir duas representações presentes no repositório:

1. **Modelo Relacional PostgreSQL (`supabase/migrations/20261028_erp_complete_schema.sql`)**:
   - Define 18 tabelas normalizadas em `snake_case` com chaves primárias `UUID`, `FOREIGN KEY`, `UNIQUE` e `CHECK` constraints.
   - **Situação Atual:** Não está sendo consultado diretamente pelo frontend via queries relacionais (`sb.from('employees')`, etc.) porque a instância remota do Supabase possuía originalmente apenas as tabelas `configuracoes` e `escalas`.
2. **Modelo Relacional em Memória Persistido como Documento JSONB (`src/services/erpRepository.js`)**:
   - A aplicação mantém em memória um objeto estruturado (`db`, em `camelCase`) contendo todas as coleções normalizadas por ID (`companies`, `units`, `sectors`, `unitSectors`, `functionalCategories`, `roles`, `workShifts`, `scheduleRules`, `ruleAssignments`, `workPositions`, `employees`, `allocations`, `unavailabilityEvents`, `marketCalendarDays`, `monthlySchedules`, `dailyEntriesByMonth`, `cycleStates`, `auditLogs`, `userProfiles`).
   - `ErpRepository.saveDatabase(dbState)` (`src/services/erpRepository.js`, linhas 104–126) persiste esse objeto inteiro na coluna `dados` (JSONB) da tabela `configuracoes` do Supabase sob a chave `unidade = "__ERP_RELATIONAL_CORE_V7__"` e `mes = "2026-ERP"`, além de salvar cópia em `localStorage` (`erp_relational_db_v7_cache`).

---

## 2. DICIONÁRIO COMPLETO DE ENTIDADES E ATRIBUTOS (ESTADO ATIVO `db`)

### 2.1 `companies` (Empresas)
Representa a pessoa jurídica empregadora.
- `id` (`string`, PK): ex. `"comp_yuara_03"`
- `legalName` (`string`): Razão social (atualmente `"YUARA PRESTADORA SERVIÇOS LJ 03 LTDA"` no seed, linha 15)
- `tradeName` (`string`): Nome fantasia (`"União Supermercados — Loja 03"`)
- `cnpj` (`string`): `"40.633.037/0001-71"`
- `active` (`boolean`): `true`

### 2.2 `units` (Unidades / Lojas)
- `id` (`string`, PK): `"LOJA_03"`, `"LOJA_01"`, `"LOJA_02"`
- `companyId` (`string`, FK → `companies.id`)
- `code` (`string`): `"LJ03"`, `"LJ01"`, `"LJ02"`
- `name` (`string`): `"LOJA 03"`, `"LOJA 01"`, `"LOJA 02"`
- `city` (`string`), `state` (`string`), `active` (`boolean`)
- **Limitação Atual:** Todos os 74 postos e 60 colaboradores do seed estão vinculados a `unitId: "LOJA_03"`. As unidades `LOJA_01` e `LOJA_02` existem no array `units`, mas possuem 0 postos e 0 alocações iniciais.

### 2.3 `sectors` e `unitSectors` (Setores e Parâmetros por Loja)
**`sectors`**:
- `id` (`string`, PK): ex. `"SEC_ACOUGUE"`, `"SEC_CAIXA"`, `"SEC_PADARIA"`
- `code` (`string`): código curto
- `name` (`string`): nome de exibição
- `displayOrder` (`number`): ordem de renderização na grade e no BI (`1` a `13`)
- `minDailyCoverage` (`number`): cobertura mínima padrão em dias úteis

**`unitSectors`**:
- `id` (`string`, PK)
- `unitId` (`string`, FK → `units.id`)
- `sectorId` (`string`, FK → `sectors.id`)
- `minDailyCoverage` (`number`): mínimo exigido de colaboradores trabalhando por dia útil no setor daquela unidade
- `minSundayCoverage` (`number`): mínimo exigido aos domingos (`Math.floor(minDailyCoverage * 0.6)`)

### 2.4 `functionalCategories` e `roles` (Categorias Funcionais e Funções/Cargos)
**`functionalCategories`**:
- `id` (`string`, PK): `"CAT_GESTAO"`, `"CAT_PERECIVEIS"`, `"CAT_ATENDIMENTO"`, `"CAT_MERCEARIA"`, `"CAT_LOGISTICA"`, `"CAT_APOIO"`
- `code` (`string`), `name` (`string`), `hierarchyLevel` (`number`)

**`roles` (Funções)**:
- `id` (`string`, PK): ex. `"R_ACOUGUEIRO"`, `"R_OP_CAIXA"`
- `categoryId` (`string`, FK → `functionalCategories.id`)
- `defaultSectorId` (`string`, FK → `sectors.id`)
- `code` (`string`), `name` (`string`)
- `hierarchyRank` (`number`): nível hierárquico para ordenação
- `projectedMonthlyCost` (`number | null`): custo mensal projetado por função (opcional)

### 2.5 `workShifts` (Jornadas e Horários Contratuais — 8 Colunas da Planilha)
- `id` (`string`, PK): ex. `"SH_OP_MANHA_0640"`, `"SH_OP_TARDE_1130"`
- `code` (`string`), `name` (`string`)
- `shiftPeriod` (`"MANHÃ" | "TARDE" | "INTERMEDIÁRIO" | "INTEGRAL" | "NOTURNO"`)
- `entryTime` (`string` `HH:MM`): Coluna 1 de horário da planilha (Entrada)
- `breakStart` (`string` `HH:MM`): Coluna 2 (Início do intervalo de almoço)
- `breakEnd` (`string` `HH:MM`): Coluna 3 (Fim do intervalo de almoço)
- `exitBaseTime` (`string` `HH:MM`): Coluna 4 (Saída contratual base)
- `baseWorkload` (`string` `HH:MM`): Coluna 5 (Carga horária base, ex.: `"07:20"` ou `"08:00"`)
- `extensionWorkload` (`string` `HH:MM`): Coluna 6 (Complemento operacional, ex.: `"01:40"`)
- `effectiveExitTime` (`string` `HH:MM`): Coluna 7 (Saída efetiva real, ex.: `"17:10"` ou `"22:00"`)
- `contractDailyWorkload` (`string` `HH:MM`): Coluna 8 (`C.H` contratual, ex.: `"07:20"`)
- `weeklyHours` (`number`): `44`

### 2.6 `scheduleRules` e `ruleAssignments` (Regras de Escala e Vigências Temporais)
**`scheduleRules`**:
- `id` (`string`, PK): `"RULE_5X1"`, `"RULE_5X2"`, `"RULE_6X1_DOM"`, `"RULE_6X1_DOM_SEG"`, `"RULE_6X1_SAB_DOM"`, `"RULE_6X1_SAB_DOM_SEG"`
- `code` (`string`), `name` (`string`), `description` (`string`)
- `ruleType`: `"5X1" | "5X2" | "6X1_DOM" | "6X1_FLEX"`
- `workDaysInCycle` (`number`): `5` ou `6`
- `restDaysInCycle` (`number`): `1` ou `2`
- `allowedRestDows` (`number[]`): dias da semana permitidos para folga (`0`=Dom, `1`=Seg, ..., `6`=Sáb). Vazio `[]` no `5X1` corrido.
- `fixedWeekdays` (`boolean`): no `5X2`, define se as 2 folgas são fixas nos dias `allowedRestDows` (ex.: `[6, 0]` = Sáb/Dom) ou rotativas.
- `maxConsecutiveWorkDays` (`number`): limite máximo de dias consecutivos sem folga (`5`, `6` ou `7`).
- `requiresSundayLunchSlot` (`boolean`): se exige faixa de almoço `1..4` quando trabalha no domingo/feriado.
- `closedMarketCountsAsRest` (`boolean`): se um dia de mercado fechado (`FECHADO`) zera o contador de dias trabalhados consecutivos.

**`ruleAssignments` (Vigências Temporais por Colaborador — Cenário 3)**:
- `id` (`string`, PK)
- `employeeId` (`string`, FK → `employees.id`)
- `ruleId` (`string`, FK → `scheduleRules.id`)
- `effectiveFrom` (`string` `YYYY-MM-DD`): início de vigência da regra
- `effectiveTo` (`string | null` `YYYY-MM-DD`): término de vigência (`null` = indeterminado)
- **Precedência:** `getEffectiveRuleForDate` (`scheduleEngine.js`, linhas 134–155) verifica primeiro `ruleAssignments` na data `isoDate`; se não houver registro vigente, utiliza `allocation.scheduleRuleId`.

### 2.7 `workPositions` (Postos de Trabalho / Vagas)
Entidade independente da pessoa física (`employees`).
- `id` (`string`, PK): ex. `"POS_LJ03_01"`, `"POS_LJ03_RATEIO-01"`
- `unitId` (`string`, FK → `units.id`)
- `sectorId` (`string`, FK → `sectors.id`)
- `roleId` (`string`, FK → `roles.id`)
- `defaultShiftId` (`string`, FK → `workShifts.id`)
- `defaultRuleId` (`string`, FK → `scheduleRules.id`)
- `positionNumber` (`number | null`): número sequencial (`1` a `70`, ou `null` quando `isSharedRateio === true`)
- `code` (`string`): `"01"` a `"70"` ou `"RATEIO-01"`..`"RATEIO-04"`
- `title` (`string`): ex. `"AÇOUGUEIRO 01"`
- `isSharedRateio` (`boolean`): `true` para colaboradores compartilhados entre lojas/CNPJs
- `status`: `"FILLED" | "OPEN_AUTHORIZED" | "OPEN_UNPLANNED" | "FROZEN" | "DEACTIVATED"`
- `estimatedMonthlyCost` (`number | null`), `authorizedBudget` (`number | null`)
- `notes` (`string`): observações estruturais da vaga

### 2.8 `employees` e `allocations` (Colaboradores e Alocações Históricas SCD Tipo 2)
**`employees`**:
- `id` (`string`, PK)
- `registrationCode` (`string`): matrícula (`"MAT-1002"`, etc.)
- `fullName` (`string`)
- `hireDate` (`string` `YYYY-MM-DD`): data de admissão
- `terminationDate` (`string | null` `YYYY-MM-DD`): data de desligamento
- `noticePeriodEndDate` (`string | null` `YYYY-MM-DD`): término do aviso prévio (ex.: `2026-10-28` para Iara Gonçalves e `2026-10-24` para Elaine Gomes)
- `employmentStatus`: `"ACTIVE" | "ON_VACATION" | "MATERNITY_LEAVE" | "MEDICAL_LEAVE" | "NOTICE_PERIOD" | "TERMINATED"`
- `anchorLastRestDate` (`string | null` `YYYY-MM-DD`): data-âncora da última folga conhecida antes do primeiro mês calculado
- `anchorCycleOffset` (`number`): deslocamento inicial de revezamento

**`allocations` (Vínculo Temporal Colaborador ↔ Posto/Setor/Unidade)**:
- `id` (`string`, PK)
- `employeeId` (`string`, FK → `employees.id`)
- `workPositionId` (`string`, FK → `workPositions.id`)
- `unitId` (`string`, FK → `units.id`)
- `sectorId` (`string`, FK → `sectors.id`)
- `roleId` (`string`, FK → `roles.id`)
- `workShiftId` (`string`, FK → `workShifts.id`)
- `scheduleRuleId` (`string`, FK → `scheduleRules.id`)
- `startDate` (`string` `YYYY-MM-DD`): início da alocação no posto/setor
- `endDate` (`string | null` `YYYY-MM-DD`): término da alocação (`null` = alocação ativa atual)
- `transferReason` (`string`)

### 2.9 `unavailabilityEvents` (Férias, Licenças, INSS e Aviso Prévio)
- `id` (`string`, PK)
- `employeeId` (`string`, FK → `employees.id`)
- `eventType`: `"VACATION" | "MATERNITY_LEAVE" | "MEDICAL_LEAVE" | "NOTICE_PERIOD"`
- `startDate` (`string` `YYYY-MM-DD`)
- `endDate` (`string` `YYYY-MM-DD`)
- `cycleBehavior`: `"RESET_ON_RETURN" | "PRESERVE_PHASE"`
- `notes` (`string`)

### 2.10 `marketCalendarDays` (Calendário Operacional de Abertura do Mercado)
- `id` (`string`, PK)
- `unitId` (`string`, FK → `units.id`)
- `calendarDate` (`string` `YYYY-MM-DD`)
- `dayType`: `"HOLIDAY" | "OPTIONAL_HOLIDAY" | "SUNDAY" | "CRITICAL_OFFER" | "PAYDAY"`
- `openingMode`: `"FULL_DAY" | "HALF_DAY" | "CLOSED"`
- `description` (`string`)
- `halfDayClosingTime` (`string` `HH:MM`)
- `requiresLunchScale` (`boolean`)
- `weight` (`number`)

### 2.11 `monthlySchedules`, `dailyEntriesByMonth` e `cycleStates`
**`monthlySchedules`**:
- `id`, `unitId`, `yearMonth` (`"YYYY-MM"`), `status` (`"DRAFT" | "VALIDATED" | "PUBLISHED" | "IMPACTED_BY_PAST_CHANGE"`), `impactWarning`, `validatedAt`, `publishedAt`.

**`dailyEntriesByMonth[yearMonth]`** (Array de lançamentos diários):
- `employeeId`, `workPositionId`, `unitId`, `sectorId`, `workDate` (`"YYYY-MM-DD"`)
- `status`: `"T" | "MEIO_EXP" | "F" | "A" | "FECHADO" | "V" | "LM" | "INSS" | "ADM" | "DEM"`
- `origin`: `"AUTO_GENERATED" | "MANUAL_OVERRIDE" | "VALIDATED" | "PUBLISHED" | "EXECUTED"`
- `lunchSlot`: `"1" | "2" | "3" | "4" | null`
- `ruleId` (`string | null`)

**`cycleStates`** (Estado consolidado ao final de cada mês `yearMonth`):
- `employeeId`, `yearMonth`, `lastRestDate`, `consecutiveWorkDays`, `flexRotationIndex`, `sundaysWorkedStreak`, `lastLunchSlot`.
