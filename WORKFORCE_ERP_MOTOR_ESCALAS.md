# WORKFORCE ERP — AUDITORIA DO MOTOR DE ESCALAS (`WORKFORCE_ERP_MOTOR_ESCALAS.md`)

**Data da Auditoria:** 28/10/2026  
**Arquivo Principal Auditado:** `src/domain/scheduleEngine.js` (844 linhas)  
**Suíte de Testes Auditada:** `src/tests/scheduleEngine.test.js` (490 linhas)

---

## 1. VISÃO GERAL E DETERMINISMO DO MOTOR

O motor de cálculo (`src/domain/scheduleEngine.js`) é implementado como um conjunto de funções puras em JavaScript ES Modules, sem dependência de DOM, React ou efeitos colaterais de rede. Todas as operações de data utilizam `Date.UTC(y, m - 1, d, 12, 0, 0)` (`parseISODate`, linha 33) para eliminar desvios de fuso horário ou horário de verão.

---

## 2. ALGORITMO DE CONTINUIDADE HISTÓRICA ENTRE MESES (PASSO A PASSO)

### 2.1 Função `computeCycleStateFromEntries` (`linhas 168–206`)
Recebe a lista de lançamentos diários de um colaborador (`entriesUpToDate`), ordena cronologicamente (`a.workDate.localeCompare(b.workDate)`) e percorre dia a dia para consolidar o estado na fronteira do período:

1. Se `entry.status` for `"F"`, `"A"` ou `"FECHADO"`:
   - `lastRestDate = entry.workDate`
   - `consecutiveWorkDays = 0`
   - Se for domingo (`dow === 0`), `sundaysWorkedStreak = 0`.
2. Se `entry.status` for `"T"` ou `"MEIO_EXP"`:
   - `consecutiveWorkDays += 1`
   - Se for domingo (`dow === 0`), `sundaysWorkedStreak += 1`.
   - Se possuir `entry.lunchSlot`, armazena em `lastLunchSlot`.
3. Se `entry.status` for `"V"` (Férias), `"LM"`, `"INSS"`, `"ADM"` ou `"DEM"`:
   - `consecutiveWorkDays = 0` (períodos de afastamento/férias não acumulam dias trabalhados consecutivos).

### 2.2 Resolução de Estado Inicial na Virada do Mês (`generateEmployeeScheduleForMonth`, `linhas 227–273`)
Ao calcular o mês `yearMonth` (ex.: `2026-11`), o motor determina o estado inicial do ciclo no dia `01` seguindo uma hierarquia estrita de 4 níveis:

1. **Nível 1 (Prioridade Máxima — `previousMonthEntries`)**: Se os lançamentos diários do mês imediatamente anterior (`2026-10`) existem, executa `computeCycleStateFromEntries` sobre eles. Qualquer alteração manual feita pelo operador nos últimos dias de Outubro altera diretamente `consecutiveWorkDays` e `lastRestDate` que entram em 1º de Novembro.
2. **Nível 2 (`previousCycleState`)**: Se não houver os lançamentos diários de Outubro em memória, mas existir um snapshot salvo em `db.cycleStates` para `2026-10`, utiliza esse snapshot.
3. **Nível 3 (`employee.anchorLastRestDate`)**: Se for o primeiro mês da base (ex.: Outubro/2026, cuja última folga ocorreu em Setembro/2026), calcula a distância em dias corridos entre o dia 1º do mês e `anchorLastRestDate`:
   ```js
   const diff = diffDaysISO(firstDateOfMonth, employee.anchorLastRestDate) - 1;
   consecutiveWorkDays = Math.max(0, diff);
   ```
4. **Nível 4 (Fallback com Alerta de Lacuna Histórica)**: Caso não exista nenhum dos 3 anteriores, emite o alerta `MISSING_HISTORICAL_ANCHOR` no array `warnings` e inicia com deslocamento `employeeRotationRank % 5`.

---

## 3. EXEMPLO CONCRETO DE CÁLCULO COM DATAS REAIS (OUTUBRO → NOVEMBRO/2026)

### Caso 1: Regime `5X1` — Colaborador `AKSUELSON ALVES` (`AUXILIAR DE AÇOUGUE 01`)
- **Parâmetro no Seed (`seedLoja03.js`, linha 317)**: `rule: "RULE_5X1"`, `anchorRest: "2026-09-26"`.
- **Cálculo de Outubro/2026 (`2026-10`)**:
  - `firstDateOfMonth = "2026-10-01"`.
  - `diff = diffDaysISO("2026-10-01", "2026-09-26") - 1 = 5 - 1 = 4` dias trabalhados em Setembro após a folga de `26/09` (trabalhou `27, 28, 29, 30/09`).
  - **Dia `01/10` (Qui)**: `consecutiveWork = 4 < 5` → Trabalha (`T`), `consecutiveWork` passa para `5`.
  - **Dia `02/10` (Sex)**: `consecutiveWork === 5 >= 5` → **Folga (`F`)**, `consecutiveWork` zera para `0`, `lastRestDate = "2026-10-02"`.
  - Sequência de folgas em Outubro (a cada 6 dias): **`02/10`, `08/10`, `14/10`, `20/10`, `26/10`**.
  - Nos dias **`27/10, 28/10, 29/10, 30/10, 31/10`**, ele trabalha 5 dias consecutivos (`consecutiveWork` termina Outubro valendo **`5`**).
- **Transição para Novembro/2026 (`2026-11`)**:
  - Ao abrir `2026-11`, `computeCycleStateFromEntries` lê os lançamentos de Outubro e entrega `consecutiveWorkDays = 5` e `lastRestDate = "2026-10-26"`.
  - **Dia `01/11` (Dom)**: `consecutiveWork === 5 >= 5` → **Folga (`F`) em `01/11`** (reproduzindo exatamente a anotação `"FOLGA EM 01/11"` da planilha original!).
  - Próximas folgas em Novembro: **`07/11`, `13/11`, `19/11`, `25/11`**.
  - Trabalha `26, 27, 28, 29, 30/11` (5 dias) → Coluna `PRÓX. MÊS` projeta automaticamente: **`FOLGA EM 01/12`**.

### Caso 2: Regime `5X1` — Colaborador com Folga em `29/10` (`ARLINDO EMANUEL`)
- Última folga em Outubro: **`2026-10-29`**.
- Trabalha `30/10` (1º dia) e `31/10` (2º dia). Estado final de Outubro: `consecutiveWorkDays = 2`.
- Em Novembro:
  - `01/11`: Trabalha (3º dia)
  - `02/11`: Trabalha (4º dia — em `2026-11-02`, feriado de Finados configurado como `HALF_DAY`, recebe `status = "MEIO_EXP"`, que também conta como dia trabalhado `+1`).
  - `03/11`: Trabalha (5º dia)
  - `04/11`: `consecutiveWork === 5` → **Folga (`F`) em `04/11`**.

---

## 4. COMPORTAMENTO DE CADA REGRA DE ESCALA NO MOTOR (`linhas 402–440`)

1. **`5X1` (`ruleType === "5X1"`)**:
   - Conta dias efetivamente trabalhados (`T` ou `MEIO_EXP`). Quando `consecutiveWork >= workDaysInCycle` (padrão `5`), o dia seguinte é `F`.
   - Se o colaborador não tem histórico do mês anterior e `isoDate === employee.anchorLastRestDate`, força `isRestDay = true` naquela data-âncora (`linha 408`).
2. **`5X2` (`ruleType === "5X2"`)**:
   - **Modo Fixo (`fixedWeekdays !== false` e `allowedRestDows.length >= 2`)**: Folga nos dias da semana listados em `allowedRestDows` (padrão `[6, 0]` = Sábado e Domingo).
   - **Modo Rotativo (`fixedWeekdays === false`)**: Trabalha 5 dias corridos e ativa `restDaysRemainingInCycle = 1`, concedendo 2 dias consecutivos de folga (`F`) antes de reiniciar a contagem.
3. **`6X1_DOM` (`ruleType === "6X1_DOM"`)**:
   - Folga fixa em todos os domingos (`dow === 0`).
4. **`6X1_FLEX` (`ruleType === "6X1_FLEX"` — ex.: `DOM/SEG`, `SAB/DOM`, `SAB/DOM/SEG`)**:
   - Em cada semana, verifica se o dia atual pertence a `allowedRestDows` (ex.: `[0, 1]` para `DOM/SEG`).
   - Escolhe o dia da folga da semana usando `chosenDow = allowedRestDows[flexWeekIndex % allowedRestDows.length]`.
   - Ao passar pelo último dia da janela permitida na semana (`dow === allowedRestDows[allowedRestDows.length - 1]`), incrementa `flexWeekIndex += 1`, fazendo com que na semana seguinte o colaborador folgue no próximo dia da lista (revezando entre Domingo e Segunda-feira).
   - **Trava de segurança (`linha 434`)**: Se `!isRestDay && consecutiveWork >= maxConsecutiveWorkDays && allowedDows.includes(dow)`, força `isRestDay = true` para evitar violação do limite de dias seguidos.
   - **Limitação Algorítmica Identificada no `6X1_FLEX`**: Quando `allowedRestDows` cruza o fim da semana JavaScript (`[6, 0]` = Sábado `6` e Domingo `0`), na semana em que o colaborador folga no Sábado (`dow=6`) e na semana seguinte folga no Domingo (`dow=0`), a distância entre Sábado de uma semana e Domingo da outra é de **8 dias** (7 dias trabalhados entre as duas folgas). O motor limita em `maxConsecutiveWorkDays: 7`, mas se o limite legal estrito de 6 dias trabalhados (folga até o 7º dia, OJ 410 TST) for exigido, a transição de Sábado → Domingo precisa de uma folga intermediária ou inversão de ordem.

---

## 5. INTERAÇÃO COM FÉRIAS, AFASTAMENTOS, MUDANÇA DE REGRA E VIRADA DE ANO

- **Férias (`V`), Licença Maternidade (`LM`) e INSS (`INSS`) (`linhas 335–358`)**:
  - Têm precedência sobre qualquer regra automática e sobre o calendário do mercado.
  - Durante o período de afastamento, `consecutiveWork` permanece `0`. No primeiro dia de retorno após o término das férias (`endDate + 1`), o colaborador inicia o bloco com `consecutiveWork = 0` (trabalha 5 dias antes da próxima folga no `5x1`).
- **Preservação de Edições Manuais (`MANUAL_OVERRIDE`, `linhas 360–378`)**:
  - Se `preserveManualOverrides === true`, qualquer célula já marcada com `origin === "MANUAL_OVERRIDE"` é mantida intacta durante o recálculo do mês, e seu status (`F`, `A` ou `T`) alimenta normalmente o contador `consecutiveWork` dos dias subsequentes do próprio mês!
- **Virada de Ano (`Dezembro → Janeiro`)**:
  - As funções `getPreviousYearMonth("2027-01")` → `"2026-12"` e `getNextYearMonth("2026-12")` → `"2027-01"` (`linhas 73–85`) tratam explicitamente `m === 1` e `m === 12`, garantindo continuidade idêntica na virada de ano.

---

## 6. COBERTURA DE TESTES AUTOMATIZADOS (`src/tests/scheduleEngine.test.js`)

Comando de execução: `npm test` (`node --test src/tests/scheduleEngine.test.js`).  
Todos os **6 cenários** executam contra o código real e passam integralmente:

1. **Cenário 1 (`L64–112`)**: Folga em `29/10/2026` → trabalha `30/10, 31/10, 01/11, 02/11, 03/11` (5 dias) → comprova folga automática em `04/11/2026` e `10/11/2026`.
2. **Cenário 2 (`L117–177`)**: Gera Outubro e Novembro → altera manualmente a folga de Outubro de `26/10` para `28/10` → `detectFutureScheduleImpact` detecta impacto em Novembro e comprova que a primeira folga de Novembro muda de `01/11` para `03/11`.
3. **Cenário 3 (`L182–233`)**: Colaborador muda de `6X1_DOM` para `5X1` em `16/11/2026` → comprova `6X1_DOM` até `15/11` e `5X1` a partir de `16/11` (folgando no sábado `21/11`).
4. **Cenário 4 (`L238–291`)**: Cria 11 postos sequenciais (`AÇOUGUEIRO 01` a `11`), preenche 5 → `computeWorkforceAnalytics` comprova `11` planejados, `5` preenchidos e `6` vagos.
5. **Cenário 5 (`L297–460`)**: 11 postos, 7 colaboradores vinculados, 2 em férias → comprova `7` preenchidos, `4` vagos, `2` em férias e `5` disponíveis; valida `5X2`, feriado `HALF_DAY` (`02/11`), feriado `CLOSED` (`15/11`), almoço de domingo `1..4` e transferência de setor em `16/10` preservando Setembro/Outubro/Novembro.
6. **Cenário 6 (`L464–489`)**: Executa `buildInitialErpDatabase()` da Loja 03 e comprova que os 9 colaboradores com anotação de folga na planilha original (`AKSUELSON ALVES`, `ZAIR HENRIQUE`, `LUCAS JEAN`, `LAUANDA SILVA`, `FLÁVIA GOMES`, `ALICE JACIELLE`, `ANGELA SOUSA`, `MÔNICA SANTOS`, `MARIA CLARA`) caem exatamente em `01/11`, `02/11` e `03/11`.
