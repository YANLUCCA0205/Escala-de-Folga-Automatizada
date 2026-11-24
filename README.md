# Workforce ERP v8.0 — Gestão de Quadro de Colaboradores, Escalas e BI

Sistema Integrado de Gestão de Quadro de Pessoal, Motor Temporal de Escalas de Folga (`5x1`, `5x2`, `6x1 Dom`, `6x1 Flex`), Controle de Concorrência Otimista, Rateio Multiunidade e Business Intelligence Operacional.

## Arquitetura do Sistema

- **Motor de Regras e Continuidade Temporal (`src/domain/scheduleEngine.js`)**:
  - Geração determinística de escalas mensais com continuidade histórica entre competências (`computeCycleStateFromEntries`, `generateEmployeeScheduleForMonth`).
  - Balanceamento automático de faixas de almoço aos domingos e feriados (`1` a `4`) por setor e turno (`balanceSectorSundayLunchSlots`).
  - Cálculo e auditoria aritmética das 8 colunas de jornada contratual (`calculateShiftMetrics`) e validação de descanso interjornada mínimo de 11h CLT Art. 66 (`checkInterjornadaRest`), incluindo turnos que cruzam a meia-noite (`00:00`).
  - Validação em 10 níveis (`verifyScheduleConflicts` / `validateMonthlyScheduleChecklist`) e governança de escalas publicadas (`isScheduleLockedForEditing`, `reopenPublishedSchedule`).
- **Persistência Particionada e Concorrência (`src/services/erpRepository.js`)**:
  - Sincronização com Supabase e controle de revisão (`schemaRevision`) com merge por identificador único (`mergeConcurrentDatabaseStates`).
  - Controle de acesso baseado em papéis (`RBAC`: `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) e escopo por unidade (`assertPermission`, `assertUnitAccess`).
- **Módulos Operacionais (`src/modules/`)**:
  - `ScheduleGridModule.jsx`: Grade mensal interativa com Popover Contextual, Modo Pincel, Desfazer/Refazer, Troca Bilateral de Folgas e Impressão Paisagem A4.
  - `DashboardAndBiModule.jsx`: Indicadores executivos e consulta operacional por período flexível (Mês, Semanas 1 a 5, Quinzenas, Fotografia na Data e Intervalo Personalizado).
  - `OrganizationAndPositionsModule.jsx`: Cadastro de Empresa, Unidades, Setores, Funções e Quadro de Postos/Vagas.
  - `EmployeesAndAvailabilityModule.jsx`: Central Unificada do Colaborador, Movimentação Funcional Guiada, Rateio Multiunidade e Férias/Afastamentos.
  - `RulesShiftsAndCalendarModule.jsx`: Regras de Escala, Turnos de 8 Colunas e Calendário Operacional por Loja.
  - `AdminAndAuditModule.jsx`: Gestão de Operadores Autorizados, Simulador RBAC restrito a Administradores e Trilha de Auditoria Verificada.

## Comandos Principais

```bash
# Instalar dependências
npm install

# Executar servidor de desenvolvimento (http://localhost:5173)
npm run dev

# Executar suíte completa de testes automatizados (Node Test Runner)
npm test

# Gerar build de produção
npm run build
```
