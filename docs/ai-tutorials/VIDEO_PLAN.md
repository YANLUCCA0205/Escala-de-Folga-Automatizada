# Plano Diretor de Vídeos Tutoriais — Fase C

> **Documento gerado na Etapa 1 (Fase C — Estruturação dos Tutoriais)**
> **Objetivo**: Estruturar uma trilha pedagógica completa de **10 vídeos curtos (microlearning de 2 a 4 minutos)** organizados por módulos e jornadas de usuário para o **Workforce ERP v8.0.0-ERP**.

---

## Visão Geral da Grade de Vídeos Tutoriais

| Código | Módulo / Jornada | Título do Vídeo | Público-Alvo | Duração Estimada | Dependências |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **VID-01** | Módulo 0 — Acesso e Contexto | Primeiro Acesso Nominal, Seletor de Filial e Navegação Global | Todos os Perfis (`VIEWER` a `ADMIN`) | `02:15` | Nenhuma (Vídeo Inicial) |
| **VID-02** | Módulo 1 — Dashboard e BI | Posição do Quadro na Data (Fotografia) vs Fluxo Mensal | Gestores, RH e Diretoria (`VIEWER`, `MANAGER`, `ADMIN`) | `03:00` | `VID-01` |
| **VID-03** | Módulo 1 — BI Avançado | Inteligência Analítica por Períodos Flexíveis (1ª a 5ª Semana, Quinzenas e Intervalo entre Meses) | Gestores, RH e Auditoria (`VIEWER`, `MANAGER`, `ADMIN`) | `03:15` | `VID-02` |
| **VID-04** | Módulo 2 — Estrutura e Vagas | Configuração da Empresa, Setores com Cobertura Mínima e Geração de Postos em Lote | Administradores e Gerentes (`ADMIN`, `MANAGER`) | `03:30` | `VID-01` |
| **VID-05** | Módulo 3 — Colaboradores | Admissão em Vaga Aberta, Promoção Guiada e Criação de Vaga Inline na Central do Colaborador | RH, Gerentes e Operadores (`OPERATOR`, `MANAGER`, `ADMIN`) | `03:45` | `VID-04` |
| **VID-06** | Módulo 3 — Rateio e Férias | Gestão de Colaboradores de Rateio Multiunidade e Programação Dinâmica de Férias/INSS | RH, Gerentes e Operadores (`OPERATOR`, `MANAGER`, `ADMIN`) | `03:30` | `VID-05` |
| **VID-07** | Módulo 4 — Jornadas e Regras | Catálogo de Jornadas de 8 Colunas e Motor de Regras 5x1, 5x2 e 6x1 (Simples e Avançado) | Administradores e Engenheiros de Escala (`ADMIN`) | `03:45` | `VID-01` |
| **VID-08** | Módulo 5 — Calendário e Escala | Calendário Operacional do Mercado e Geração Automática da Escala com Continuidade entre Meses | Gerentes e Operadores (`OPERATOR`, `MANAGER`, `ADMIN`) | `03:30` | `VID-07` |
| **VID-09** | Módulo 5 — Edição de Escalas | Edição Rápida com Pincel, Popover Contextual, Troca de Folgas, Almoço de Domingo e Undo/Redo | Operadores e Encarregados de Setor (`OPERATOR`, `MANAGER`, `ADMIN`) | `04:00` | `VID-08` |
| **VID-10** | Módulo 6 — Governança e Auditoria | Checklist de 10 Níveis, Publicação Oficial, Reabertura Auditada, Simulador RBAC e Auditoria | Gerentes, RH e Administradores (`MANAGER`, `ADMIN`) | `03:45` | `VID-09` |

---

## Detalhamento Individual dos Tutoriais

---

### VID-01 — Primeiro Acesso Nominal, Seletor de Filial e Navegação Global
- **Título**: Como acessar o Workforce ERP v8.0 com Identificação Nominal e navegar entre Lojas e Competências
- **Público-alvo**: Todos os usuários do sistema (`VIEWER`, `OPERATOR`, `MANAGER`, `ADMIN`).
- **Objetivo**: Ensinar o operador a autenticar-se nominalmente sem contas genéricas compartilhadas, compreender a barra de status de sincronização e alternar o contexto global de Unidade (`LOJA_03`, `LOJA_01`, `LOJA_02`) e Competência (`2026-10`, `2026-11`).
- **Telas envolvidas**:
  - `TelaLogin` (`src/App.jsx`)
  - Barra Lateral Esquerda (`Sidebar`) e Barra Superior (`Topbar`)
  - Tela inicial `📅 Escalas Mensais` (`ScheduleGridModule.jsx`)
- **Sequência de ações**:
  1. Abrir a aplicação em `http://localhost:5173/`.
  2. Na aba `"Acesso Operador Identificado"`, demonstrar a tentativa de uso do e-mail genérico legado (`gestao.loja03@uniaosupermercados.com.br`) e exibir o alerta de bloqueio de governança.
  3. Preencher `"Carlos Mendes"` no Nome Completo, `"carlos.mendes@uniaosupermercados.com.br"` no E-mail Corporativo e selecionar o perfil `"ADMIN"`.
  4. Clicar em `"Ingressar com Identificação Nominal"`.
  5. Na barra lateral esquerda, alterar o seletor `"Unidade / Filial Ativa"` de `LOJA 03` para `LOJA 01` e voltar para `LOJA 03`.
  6. Alterar o seletor `"Competência Ativa"` de `2026-11` para `2026-10` e retornar para `2026-11`.
  7. Apontar na barra superior o indicador de sincronização (`Sincronizado v8.0`), o crachá do operador e os 9 módulos do menu lateral.
- **Explicação das regras de negócio**:
  - O ERP v8.0 proíbe sessões anônimas ou contas genéricas coletivas para garantir que 100% das alterações na escala tenham autoria individual rastreável na Trilha de Auditoria (`VERIFIED_OPERATOR_SESSION`).
  - O contexto de Unidade e Competência é global: ao mudar a loja ou o mês na barra lateral, todos os módulos passam a operar imediatamente sobre aquela partição de dados.
- **Roteiro preliminar**:
  - **[00:00 - 00:35] (Cena: Tela de Login)**: *"Bem-vindo ao Workforce ERP versão 8.0 da União Supermercados. Para garantir rastreabilidade total nas auditorias trabalhistas, o sistema exige identificação nominal do operador. Contas genéricas antigas são bloqueadas automaticamente. Informe seu nome completo, seu e-mail corporativo e seu perfil de atuação para iniciar."*
  - **[00:35 - 01:30] (Cena: Sidebar e Seletores Globais)**: *"Ao entrar, observe à esquerda os dois seletores globais: Unidade Ativa e Competência Mensal. Tudo o que você visualiza ou edita no sistema respeita a loja e o mês escolhidos aqui. Vamos alternar entre Outubro e Novembro de 2026 na Loja 03."*
  - **[01:30 - 02:15] (Cena: Topbar e Menu de 9 Módulos)**: *"No topo, você acompanha em tempo real o status de salvamento da partição e seu perfil RBAC ativo. No menu lateral, as 9 áreas do sistema estão organizadas na ordem natural do seu trabalho."*
- **Duração estimada**: `02:15` (135 segundos).
- **Dependências**: Nenhuma.

---

### VID-02 — Posição do Quadro na Data (Fotografia) vs Fluxo Mensal
- **Título**: Dashboard Executivo: Entendendo a diferença entre Posição do Quadro na Data e Fluxo Mensal
- **Público-alvo**: Diretores, Gerentes de Loja, Analistas de RH e Auditores (`VIEWER`, `MANAGER`, `ADMIN`).
- **Objetivo**: Demonstrar como consultar a fotografia exata da lotação da loja em um dia específico sem confundir vagas abertas com colaboradores em férias, e diferenciar fotografia diária de fluxo mensal.
- **Telas envolvidas**:
  - `📊 Dashboard e Indicadores` (`DashboardAndBiModule.jsx` — Seções 1 e 3)
- **Sequência de ações**:
  1. Clicar em `"📊 Dashboard e Indicadores"` no menu lateral.
  2. Selecionar a Competência Base `"2026-10"` (Outubro/2026).
  3. Definir o campo `"📸 Posição do Quadro na Data"` para `"2026-10-15"`.
  4. Destacar os 7 cards de KPIs no topo: `Postos Planejados (70 próprios + 4 rateio)`, `Vagas Preenchidas`, `Vagas em Aberto`, `Férias na Data`, `Licença Maternidade / INSS na Data`, `Disponíveis para Operação na Data` e `Trabalhando na Data`.
  5. Rolar até a tabela `"Mapa Analítico de Lotação e Cobertura por Setor"` e comparar as colunas `"Férias na Data"` e `"Férias no Mês (Fluxo)"`.
- **Explicação das regras de negócio**:
  - **Vaga Preenchida vs Disponibilidade**: Quando um colaborador titular entra em férias ou afastamento INSS, o posto de trabalho continua `FILLED` (preenchido — não abre vaga de contratação indevida), porém a disponibilidade operacional naquela data diminui.
  - **Fotografia na Data vs Fluxo do Mês**: `"Férias na Data"` mostra quem está ausente especificamente no dia consultado; já `"Férias no Fluxo do Mês"` contabiliza todos os colaboradores que gozaram ao menos 1 dia de férias ao longo da competência.
- **Roteiro preliminar**:
  - **[00:00 - 01:00] (Cena: Cabeçalho do Dashboard e Seletor de Data)**: *"No Dashboard Executivo, resolvemos uma das maiores dúvidas de gestão de quadro: quantas vagas tenho preenchidas hoje versus quantas pessoas estão efetivamente disponíveis para trabalhar nesta data. Escolha a competência e selecione o dia exato em 'Posição do Quadro na Data'."*
  - **[01:00 - 02:10] (Cena: Os 7 KPIs Executivos)**: *"Observe que na Loja 03 temos 70 postos próprios e 4 postos compartilhados de rateio. Quando um colaborador sai de férias, a vaga dele continua preenchida, mas o card 'Férias na Data' registra sua ausência temporária e reduz automaticamente o indicador 'Disponíveis na Data'."*
  - **[02:10 - 03:00] (Cena: Mapa Analítico por Setor)**: *"Na tabela setorial abaixo, você acompanha lado a lado a fotografia exata do dia selecionado e o fluxo acumulado do mês para cada um dos 13 setores da loja."*
- **Duração estimada**: `03:00` (180 segundos).
- **Dependências**: `VID-01`.

---

### VID-03 — Inteligência Analítica por Períodos Flexíveis (Semana 1..5, Quinzenas e Intervalo Livre)
- **Título**: BI Operacional: Analisando Cobertura por Semana (1ª a 5ª), Quinzena e Intervalos entre Meses
- **Público-alvo**: Gestores de Operação, RH e Auditoria (`VIEWER`, `MANAGER`, `ADMIN`).
- **Objetivo**: Ensinar a utilizar o motor de consulta flexível para auditar semanas específicas (incluindo os dias 29 a 31 na 5ª semana), quinzenas e períodos personalizados que cruzam meses, interpretando Colaboradores Únicos vs Pessoas-Dia.
- **Telas envolvidas**:
  - `📊 Dashboard e Indicadores` (`DashboardAndBiModule.jsx` — Seção 2: Inteligência Analítica por Período Flexível)
- **Sequência de ações**:
  1. Na seção `"Inteligência Analítica por Período Flexível"`, clicar no modo `"📆 Semana do Mês (1ª a 5ª)"`.
  2. Alternar entre `1ª Semana (01 a 07)` e `5ª Semana / Fim do Mês (29 a 30/31)` para demonstrar que os dias finais do mês nunca ficam ocultos.
  3. Clicar em `"🌗 Quinzena (1ª ou 2ª)"` e alternar entre `1ª Quinzena (01 a 15)` e `2ª Quinzena (16 ao fim)`.
  4. Clicar em `"🔍 Intervalo Personalizado"` e selecionar de `"2026-10-25"` até `"2026-11-05"` (cruzando Outubro e Novembro).
  5. Filtrar pelo setor `"AÇOUGUE"` e clicar no botão `"Ver Registros Nominais do Período (Drilldown)"`.
- **Explicação das regras de negócio**:
  - **Colaboradores Únicos vs Pessoas-Dia (`personDays`)**: Em um período de 7 dias, 1 colaborador trabalhando 6 dias representa `1 Colaborador Único`, mas gera `6 Pessoas-Dia` de força de trabalho. O BI exibe ambos os números para evitar distorções estatísticas.
  - **Cobertura da 5ª Semana e Fronteira de Meses**: Meses de 30 e 31 dias possuem a 5ª semana explícita (`29..31`), e o modo personalizado concatena perfeitamente os lançamentos de competências consecutivas (`dailyEntriesByMonth`).
- **Roteiro preliminar**:
  - **[00:00 - 01:10] (Cena: Modos de Período Semana 1..5 e Quinzena)**: *"Precisa analisar apenas uma quinzena ou os últimos dias do mês? Na Inteligência Analítica Flexível, você alterna com um clique entre Dia, Semana de 1 a 5 — cobrindo inclusive os dias 29, 30 e 31 —, 1ª ou 2ª Quinzena e Mês Completo."*
  - **[01:10 - 02:15] (Cena: Intervalo Personalizado Cruzando Meses)**: *"Ao selecionar 'Intervalo Personalizado', você pode auditar janelas que atravessam dois meses, como de 25 de Outubro a 5 de Novembro. O painel separa claramente quantas pessoas únicas trabalharam do volume total de pessoas-dia acumuladas."*
  - **[02:15 - 03:15] (Cena: Linha do Tempo Diária e Drilldown Nominal)**: *"Filtre por setor, função ou turno, verifique os alertas de dias com déficit de cobertura e abra o Drilldown Nominal para auditar cada registro individualmente."*
- **Duração estimada**: `03:15` (195 segundos).
- **Dependências**: `VID-02`.

---

### VID-04 — Configuração da Empresa, Setores com Cobertura Mínima e Geração de Postos em Lote
- **Título**: Estrutura Organizacional e Quadro de Postos: Cadastrando Lojas, Setores e Vagas em Lote
- **Público-alvo**: Administradores Corporativos e Gerentes (`ADMIN`, `MANAGER`).
- **Objetivo**: Demonstrar como manter o cadastro societário da empresa, configurar as metas mínimas de cobertura de cada setor (dia útil vs domingo) e utilizar o gerador automático de postos numerados e o modal de edição completa de vagas.
- **Telas envolvidas**:
  - `🏛️ Estrutura Organizacional` (`OrganizationAndPositionsModule.jsx` — aba `structure`)
  - `🪑 Quadro de Postos e Vagas` (`OrganizationAndPositionsModule.jsx` — aba `positions` e modal `editingPos`)
- **Sequência de ações**:
  1. Clicar em `"🏛️ Estrutura Organizacional"`.
  2. No painel `"Dados Cadastrais da Empresa Principal"`, demonstrar a edição de Nome Fantasia / CNPJ e salvar.
  3. No painel `"Setores Operacionais e Cobertura Mínima"`, clicar em `"Editar"` no setor `"CAIXA"`, mostrar a configuração de `Mín. Dia Útil` e `Mín. Domingo` e salvar.
  4. Clicar em `"🪑 Quadro de Postos e Vagas"` no menu lateral.
  5. No `"Gerador Automático de Postos por Quantidade"`, selecionar Setor `"PADARIA"`, Função `"AUXILIAR DE PADARIA"`, Jornada `"06:00 às 14:50"`, Regra `"5X1"`, Quantidade `"2"` e clicar em `"+ Gerar Postos"`.
  6. Na tabela de postos, clicar em `"✏️ Editar Posto"` em um posto ocupado para exibir o Modal de Edição Completa e o aviso de propagação automática para o ocupante.
- **Explicação das regras de negócio**:
  - A cobertura mínima configurada em cada setor (`unitSectors`) alimenta diretamente o validador de conflitos (`MINIMUM_COVERAGE_BREACH`) e o Dashboard de BI.
  - O gerador sequencial numera automaticamente os novos postos (`AUXILIAR DE PADARIA 05`, `06`...) sem colidir com códigos existentes.
  - Ao alterar a jornada ou regra padrão de um posto ocupado no Modal de Edição, o sistema propaga a mudança para a alocação ativa do colaborador titular.
- **Roteiro preliminar**:
  - **[00:00 - 01:15] (Cena: Estrutura Organizacional — Empresa e Setores)**: *"Em Estrutura Organizacional, você gerencia os dados da empresa, as filiais e os setores. É aqui que definimos quantos colaboradores cada setor exige no mínimo em dias úteis e aos domingos."*
  - **[01:15 - 02:30] (Cena: Quadro de Postos e Gerador em Lote)**: *"Passando para o Quadro de Postos e Vagas, você controla os 74 postos autorizados da Loja 03. Precisa expandir um setor? Use o Gerador Automático por Quantidade para criar vagas numeradas em segundos."*
  - **[02:30 - 03:30] (Cena: Modal de Edição Completa de Posto)**: *"Clicando em 'Editar Posto', você ajusta título, status da vaga, custo orçado, jornada e regra de escala, atualizando automaticamente o vínculo do titular."*
- **Duração estimada**: `03:30` (210 segundos).
- **Dependências**: `VID-01`.

---

### VID-05 — Admissão em Vaga Aberta, Promoção Guiada e Criação de Vaga Inline na Central do Colaborador
- **Título**: Central do Colaborador: Admissão em Vaga Aberta, Promoção Guiada e Criação de Vaga Inline
- **Público-alvo**: Analistas de RH, Gerentes de Loja e Encarregados (`OPERATOR`, `MANAGER`, `ADMIN`).
- **Objetivo**: Ensinar a admitir um colaborador preenchendo uma vaga aberta e utilizar a Central Unificada do Colaborador para executar promoções, transferências ou mudanças de horário — inclusive criando uma vaga nova *inline* durante a promoção.
- **Telas envolvidas**:
  - `👥 Colaboradores` (`EmployeesAndAvailabilityModule.jsx` — aba `employees` e modal `Central de Gestão do Colaborador` abas `profile`, `movement` e `history`)
- **Sequência de ações**:
  1. Clicar em `"👥 Colaboradores"`.
  2. No formulário `"Admitir Novo Colaborador em Vaga Aberta"`, preencher Nome `"MARCOS VINICIUS"`, Matrícula `"MAT-2050"`, Data de Admissão `"2026-11-01"`, escolher uma vaga aberta e clicar em `"+ Admitir e Alocar na Vaga"`.
  3. Localizar um colaborador na lista e clicar no botão `"⚙️ Central do Colaborador"`.
  4. Mostrar a Aba 1 (`"1. Dados Cadastrais e Ciclo"`) onde fica a data da última folga âncora (`anchorLastRestDate`).
  5. Clicar na Aba 2 (`"2. Promoção, Transferência e Mudança de Horário/Posto"`).
  6. Demonstrar as 3 modalidades de movimentação e selecionar `"Criar Nova Vaga Agora (Inline) e Promover/Transferir"`, escolhendo novo setor, função, jornada, regra e data de vigência (`"2026-11-16"`).
  7. Executar a movimentação e abrir a Aba 4 (`"4. Histórico de Alocações e Eventos"`) mostrando a alocação anterior encerrada em `15/11` e a nova iniciada em `16/11`.
- **Explicação das regras de negócio**:
  - Todo colaborador ativo ocupa um Posto de Trabalho através de uma Alocação com vigência (`startDate` e `endDate`).
  - Quando uma promoção ou transferência ocorre no meio do mês (ex.: `16/11`), o sistema encerra a alocação antiga na véspera (`15/11`), libera o posto antigo (`OPEN_UNPLANNED`), preenche o posto novo (`FILLED`) e preserva o histórico completo.
- **Roteiro preliminar**:
  - **[00:00 - 01:10] (Cena: Admissão Rápida em Vaga Aberta)**: *"No módulo Colaboradores, admitir um novo profissional é simples: informe os dados básicos, escolha uma das vagas abertas da loja e defina a data da última folga âncora. A vaga passa imediatamente para preenchida."*
  - **[01:10 - 02:45] (Cena: Central do Colaborador — Promoção e Vaga Inline)**: *"Para qualquer gestão individual, clique em 'Central do Colaborador'. Na aba de Promoção e Movimentação Guiada, você pode transferir o profissional para uma vaga existente, mudar apenas seu horário ou até mesmo criar uma vaga nova na hora, sem precisar sair desta tela."*
  - **[02:45 - 03:45] (Cena: Aba de Histórico de Alocações)**: *"Na aba Histórico, todas as movimentações ficam registradas com data de início e fim, mantendo a integridade jurídica da escala."*
- **Duração estimada**: `03:45` (225 segundos).
- **Dependências**: `VID-04`.

---

### VID-06 — Gestão de Colaboradores de Rateio Multiunidade e Programação Dinâmica de Férias/INSS
- **Título**: Rateio Multiunidade (Agenda Semanal entre Lojas) e Gestão Dinâmica de Férias e Afastamentos
- **Público-alvo**: RH, Gerentes e Operadores (`OPERATOR`, `MANAGER`, `ADMIN`).
- **Objetivo**: Demonstrar como configurar a agenda semanal de colaboradores compartilhados entre filiais (Rateio) e como programar, editar ou remover Férias, Licença Maternidade, INSS e Aviso Prévio com reflexo imediato na escala.
- **Telas envolvidas**:
  - `👥 Colaboradores` -> `⚙️ Central do Colaborador` -> Aba `"3. Rateio Multiunidade (Agenda Semanal)"`
  - `🏖️ Férias e Afastamentos` (`EmployeesAndAvailabilityModule.jsx` — aba `availability`)
- **Sequência de ações**:
  1. Em `👥 Colaboradores`, abrir a `⚙️ Central do Colaborador` de um colaborador de rateio (ou habilitar `"Colaborador de Rateio Compartilhado"` na Aba 3).
  2. Marcar as lojas autorizadas (`LOJA_03`, `LOJA_01`, `LOJA_02`) e definir na tabela de Segunda a Domingo em qual loja ele atua em cada dia da semana (`rateioScheduleByDow`). Salvar.
  3. Clicar em `"🏖️ Férias e Afastamentos"` no menu lateral.
  4. Selecionar um colaborador, escolher `"Férias Programadas (VACATION)"`, período `"2026-11-10"` a `"2026-11-24"`, comportamento `"Reiniciar Ciclo no Retorno (RESET_ON_RETURN)"` e clicar em `"+ Registrar Evento e Atualizar Escala"`.
  5. Mostrar na tabela de eventos os botões `"✏️ Editar"` e `"🗑️ Remover"` e demonstrar como o status do colaborador muda automaticamente para `ON_VACATION` durante a vigência.
- **Explicação das regras de negócio**:
  - **Conflito de Rateio (`RATEIO_UNIT_TIME_CONFLICT`)**: O validador de 10 níveis impede que um colaborador de rateio seja escalado simultaneamente em duas lojas no mesmo dia ou em uma loja diferente daquela reservada para aquele dia da semana em `rateioScheduleByDow`.
  - **Comportamento no Retorno de Férias (`cycleBehavior`)**: Com `RESET_ON_RETURN`, ao voltar das férias o colaborador inicia um novo ciclo zerado (ex.: trabalha 5 dias completos antes da próxima folga na 5x1); com `PRESERVE_PHASE`, ele retoma a contagem de onde havia parado antes do afastamento.
- **Roteiro preliminar**:
  - **[00:00 - 01:35] (Cena: Central do Colaborador — Aba 3 Rateio Multiunidade)**: *"Supervisores, técnicos de TI e prevenção frequentemente atendem mais de uma loja. Na aba Rateio Multiunidade, você define quais filiais o colaborador atende e qual é a loja dele em cada dia da semana, evitando conflitos de horário entre unidades."*
  - **[01:35 - 03:30] (Cena: Módulo Férias e Afastamentos)**: *"Em Férias e Afastamentos, você programa férias, licença maternidade, INSS e aviso prévio. Escolha se o ciclo de folgas deve reiniciar no retorno ou preservar a fase anterior. Ao salvar, a escala mensal recebe automaticamente a marcação de férias e, se o evento for removido, o colaborador volta ao status Ativo instantaneamente."*
- **Duração estimada**: `03:30` (210 segundos).
- **Dependências**: `VID-05`.

---

### VID-07 — Catálogo de Jornadas de 8 Colunas e Motor de Regras 5x1, 5x2 e 6x1
- **Título**: Engenharia de Horários: Jornadas Contratuais de 8 Colunas e Regras de Escala em 2 Níveis
- **Público-alvo**: Administradores Corporativos e Especialistas de DP/RH (`ADMIN`).
- **Objetivo**: Ensinar a criar e auditar jornadas de trabalho com o validador aritmético de 8 colunas (incluindo turnos que cruzam meia-noite) e configurar regras de escala no Modo Simples (com preview de 14 dias), no Modo Avançado e com Vigência Temporal.
- **Telas envolvidas**:
  - `⏱️ Jornadas e Regras` (`RulesShiftsAndCalendarModule.jsx` — sub-aba `rules`)
- **Sequência de ações**:
  1. Clicar em `"⏱️ Jornadas e Regras"`.
  2. No formulário de `"Jornadas Contratuais (8 Colunas)"`, preencher Entrada `"07:00"`, Início Intervalo `"11:00"`, Fim Intervalo `"13:00"`, Saída Base `"16:20"` e Saída Real `"18:00"`.
  3. Clicar em `"⚡ Auto-Calcular Cargas Horárias"` e observar o card verde confirmando `C.H. Base: 07:20` e `Prorrogação: 01:40`.
  4. Simular um intervalo de apenas 30 minutos (`11:00` às `11:30`) para exibir o alerta vermelho de violação intrajornada CLT (< 1h para jornada acima de 6h) e corrigir de volta.
  5. Rolar até `"Motor de Regras de Escala (2 Níveis)"`, testar os templates do **Modo Simples** observando a fita de **Simulação Visual de 14 Dias** (`T` e `F`).
  6. Alternar para **Modo Avançado** e, em seguida, demonstrar o cadastro de uma **Exceção de Regra com Vigência Temporal** para um colaborador.
- **Explicação das regras de negócio**:
  - **Aritmética das 8 Colunas (`calculateShiftMetrics`)**: Garante consistência matemática entre `(Saída Base - Entrada) - Intervalo = Carga Base` e `Saída Efetiva - Saída Base = Prorrogação`, suportando inclusive turnos noturnos que cruzam `00:00` e validando o Art. 71 da CLT.
  - **Modalidades de Escala**: Suporta `5x1 Contínuo`, `5x2 Fixo (Sáb/Dom)`, `5x2 Rotativo Corrido`, `6x1 Folga Fixa Domingo` e `6x1 Flex` (`DOM/SEG`, `SÁB/DOM`, `SÁB/DOM/SEG` com espaçamento mínimo garantido entre folgas).
- **Roteiro preliminar**:
  - **[00:00 - 01:45] (Cena: Formulário e Validador de 8 Colunas de Jornada)**: *"No módulo Jornadas e Regras, cada horário contratual possui 8 colunas auditadas em tempo real. Ao digitar os horários de entrada, almoço e saída, clique em 'Auto-Calcular Cargas Horárias'. O motor verifica na hora se a conta fecha, suporta turnos que viram a meia-noite e alerta caso o intervalo intrajornada seja inferior ao mínimo legal."*
  - **[01:45 - 03:45] (Cena: Motor de Regras Simples/Avançado e Vigência Temporal)**: *"Logo abaixo, configure regras 5x1, 5x2 ou 6x1 usando o Modo Simples com prévia visual de 14 dias, ou abra o Modo Avançado para controle fino. Você também pode aplicar uma mudança temporária de regra para um colaborador com data de início e fim."*
- **Duração estimada**: `03:45` (225 segundos).
- **Dependências**: `VID-01`.

---

### VID-08 — Calendário Operacional do Mercado e Geração Automática com Continuidade entre Meses
- **Título**: Calendário Operacional de Feriados e Geração da Escala com Continuidade Histórica
- **Público-alvo**: Gerentes de Loja e Operadores de Escala (`OPERATOR`, `MANAGER`, `ADMIN`).
- **Objetivo**: Demonstrar como configurar feriados (Dia Inteiro, Meio Expediente ou Mercado Fechado) no Calendário Operacional e como o motor gera a escala de Novembro respeitando perfeitamente os últimos dias trabalhados em Outubro, além de detectar impactos futuros.
- **Telas envolvidas**:
  - `🗓️ Calendário Operacional` (`RulesShiftsAndCalendarModule.jsx` — sub-aba `calendar`)
  - `📅 Escalas Mensais` (`ScheduleGridModule.jsx`)
- **Sequência de ações**:
  1. Clicar em `"🗓️ Calendário Operacional"`.
  2. Inspecionar os feriados de Novembro/2026 da Loja 03 (`02/11 Finados - Meio Expediente até 13:00`, `15/11 Proclamação da República`, `20/11 Consciência Negra`).
  3. Demonstrar a edição ou criação de um feriado com modo de abertura `"HALF_DAY"` ou `"CLOSED"`.
  4. Navegar para `"📅 Escalas Mensais"`, marcar `"Mostrar Últimos 6 Dias do Mês Anterior"` e mostrar como a folga na regra `5x1` em `29/10` gera exatamente 5 dias de trabalho (`30/10`, `31/10`, `01/11`, `02/11`, `03/11`) e a próxima folga em `04/11`.
  5. Alterar a competência para `"2026-10"`, mudar manualmente uma folga no dia `30/10` e mostrar o banner `"⚠️ Impacto Detectado na Escala do Mês Seguinte (2026-11)"`, acionando a atualização que preserva ajustes manuais.
- **Explicação das regras de negócio**:
  - **Continuidade Temporal Real**: O mês não começa do zero no dia 1º. O motor lê o `cycleState` e os últimos lançamentos do mês anterior para evitar sequências ilegais de 8, 9 ou 10 dias seguidos na virada do mês.
  - **Preservação de `MANUAL_OVERRIDE`**: Ao recalcular o mês seguinte após uma mudança no fim do mês anterior, todas as células ajustadas manualmente pelo gestor em Novembro são preservadas intactas.
- **Roteiro preliminar**:
  - **[00:00 - 01:20] (Cena: Calendário Operacional do Mercado)**: *"Antes de fechar a escala do mês, confira o Calendário Operacional da sua loja. Aqui configuramos se nos feriados o supermercado abrirá o dia inteiro, em meio expediente até às 13 horas ou se ficará fechado."*
  - **[01:20 - 02:35] (Cena: Escalas Mensais com Cauda de 6 Dias do Mês Anterior)**: *"Na tela de Escalas Mensais, ative 'Mostrar Últimos 6 Dias do Mês Anterior'. Veja a precisão da continuidade: quem folgou em 29 de Outubro na escala 5x1 trabalha nos dias 30 e 31 de Outubro, continua nos dias 1, 2 e 3 de Novembro e recebe sua folga exatamente no dia 4 de Novembro."*
  - **[02:35 - 03:30] (Cena: Detector de Impacto Futuro)**: *"E se você precisar alterar o fim de Outubro depois que Novembro já estiver pronto? O ERP detecta o impacto automaticamente e atualiza Novembro sem apagar nenhum ajuste manual já feito."*
- **Duração estimada**: `03:30` (210 segundos).
- **Dependências**: `VID-07`.

---

### VID-09 — Edição Rápida com Pincel, Popover Contextual, Troca de Folgas, Almoço de Domingo e Undo/Redo
- **Título**: Operando a Grade de Escalas: Modo Pincel, Menu Contextual, Troca de Folgas e Faixas de Almoço
- **Público-alvo**: Operadores de Escala, Líderes de Setor e Gerentes (`OPERATOR`, `MANAGER`, `ADMIN`).
- **Objetivo**: Ensinar todas as ferramentas de produtividade da grade mensal: pintura rápida com pincéis, edição independente de status e almoço via Popover, troca casada de folgas, balanceamento automático de almoços de domingo, construção manual e Desfazer/Refazer.
- **Telas envolvidas**:
  - `📅 Escalas Mensais` (`ScheduleGridModule.jsx`)
- **Sequência de ações**:
  1. Na barra `"Modo de Edição / Pincel Rápido"`, selecionar `"🖌️ Pincel: Folga Adicional (A)"` e clicar/arrastar sobre células da grade.
  2. Selecionar `"🍽️ Almoço 1 (09-10h)"` e clicar sobre células de domingo trabalhado (`T`).
  3. Clicar em `"↩️ Desfazer"` e `"↪️ Refazer"` demonstrando a segurança na edição.
  4. Voltar para `"🖱️ Clique Contextual (Menu)"` e clicar em uma célula para abrir o Popover flutuante: alterar a faixa de almoço sem perder o status `T`.
  5. No Popover, clicar em `"🔄 Iniciar Troca de Folga neste Dia"` e clicar no colega do mesmo setor para inverter os dias.
  6. Clicar em `"🍽️ Equilibrar Almoços Dom."` para balancear automaticamente as faixas `N01` a `N04` por setor e turno.
  7. Abrir o modal `"🛠️ Construir / Iniciar Escala Manual"` para mostrar como iniciar um mês em branco (`EMPTY`) ou copiar a estrutura do mês anterior.
- **Explicação das regras de negócio**:
  - **Independência entre Status e Faixa de Almoço**: A faixa de almoço (`1` a `4`) é um atributo independente do status `T`, permitindo organizar o revezamento de refeitório aos domingos e feriados sem alterar o ciclo de folgas.
  - **Balanceamento Setorial de Almoço (`balanceSectorSundayLunchSlots`)**: Distribui os colaboradores trabalhando no domingo dentro do mesmo setor e turno de forma uniforme entre as 4 faixas horárias (`09h-10h`, `10h-11h`, `11h-12h`, `12h-13h`).
- **Roteiro preliminar**:
  - **[00:00 - 01:25] (Cena: Barra de Pincéis e Undo/Redo)**: *"Editar a escala mensal é rápido e intuitivo. Escolha um dos pincéis na barra superior — como Folga Normal, Folga Adicional, Meio Expediente ou uma das 4 faixas de almoço — e clique ou arraste diretamente sobre os dias. Errou? Use os botões Desfazer e Refazer a qualquer momento."*
  - **[01:25 - 02:45] (Cena: Popover Contextual e Troca de Folga)**: *"No modo Clique Contextual, clicar em qualquer célula abre o menu completo daquele dia. Nele você altera status e almoço separadamente ou inicia uma Troca de Folga entre dois colaboradores do setor com apenas dois cliques."*
  - **[02:45 - 04:00] (Cena: Equilibrar Almoços e Construção Manual)**: *"Use o botão 'Equilibrar Almoços Dom.' para distribuir automaticamente as turmas de refeitório nos domingos e feriados, ou o botão 'Construir Escala Manual' caso prefira montar uma escala do zero."*
- **Duração estimada**: `04:00` (240 segundos).
- **Dependências**: `VID-08`.

---

### VID-10 — Checklist de 10 Níveis, Publicação Oficial, Reabertura Auditada, Simulador RBAC e Auditoria
- **Título**: Fechamento e Governança: Validação em 10 Níveis, Publicação, Reabertura e Trilha de Auditoria
- **Público-alvo**: Gerentes de Loja, RH e Administradores (`MANAGER`, `ADMIN`).
- **Objetivo**: Demonstrar o processo de validação de conformidade trabalhista em 10 níveis, o bloqueio contra edições após a publicação oficial da escala, a reabertura auditada com versionamento (`v1` -> `v2`), a impressão A4 paisagem e a governança RBAC e de Auditoria.
- **Telas envolvidas**:
  - `📅 Escalas Mensais` (`ScheduleGridModule.jsx` — Modais de Checklist, Publicação e Reabertura)
  - `🔐 Administração e Auditoria` (`AdminAndAuditModule.jsx`)
- **Sequência de ações**:
  1. Em `"📅 Escalas Mensais"`, clicar em `"✅ Validar Checklist"` e apresentar a separação entre **Erros Impeditivos Bloqueantes** (ex.: célula vazia, trabalho em férias, mercado fechado, conflito de rateio) e **Avisos Operacionais** (ex.: interjornada < 11h, excesso de dias consecutivos, déficit de cobertura, almoço sem faixa).
  2. Com 0 erros bloqueantes, clicar em `"🔒 Publicar Escala Oficial"`.
  3. Mostrar que a escala passa para `PUBLISHED` e bloqueia edições acidentais na grade.
  4. Clicar em `"🔓 Reabrir Escala Publicada"`, informar a justificativa `"Ajuste de escala solicitado pela gerência operacional"` e confirmar, mostrando que a versão sobe para `v2`.
  5. Navegar até `"🔐 Administração e Auditoria"`.
  6. Demonstrar o **Simulador RBAC** (alternando para `VIEWER`), o **Cadastro de Operadores por Unidade** e a **Trilha de Auditoria Verificada** contendo o registro exato da publicação e da reabertura recém-executadas.
- **Explicação das regras de negócio**:
  - **Bloqueio de Publicação (`canPublish`)**: O sistema impede a publicação oficial se houver qualquer erro de severidade bloqueante (`blocking === true`), protegendo a empresa contra falhas graves como escalar colaborador em férias ou deixar dias sem preenchimento (`EMPTY`).
  - **Governança de Versão e Reabertura (`reopenPublishedSchedule`)**: Uma escala publicada é imutável. Para editá-la, exige-se permissão `VALIDATE_PUBLISH_SCHEDULE` e justificativa formal mínima de 5 caracteres, gerando nova versão (`versionNumber + 1`) e log indelével.
- **Roteiro preliminar**:
  - **[00:00 - 01:25] (Cena: Modal do Checklist de 10 Níveis)**: *"Antes de publicar a escala, clique em 'Validar Checklist'. O motor audita 10 níveis de regras trabalhistas e operacionais: interjornada mínima de 11 horas, limite de dias consecutivos, cobertura mínima por setor, conflitos de rateio e faixas de almoço."*
  - **[01:25 - 02:35] (Cena: Publicação Oficial e Reabertura Auditada v2)**: *"Sem erros bloqueantes, clique em 'Publicar Escala Oficial'. A grade fica protegida com cadeado contra alterações acidentais. Caso surja uma emergência, a reabertura exige justificativa formal e cria automaticamente a versão 2 da escala."*
  - **[02:35 - 03:45] (Cena: Módulo Administração e Auditoria)**: *"Por fim, em Administração e Auditoria, você gerencia quais operadores acessam cada filial, simula perfis RBAC, exporta backups completos em JSON e consulta a Trilha de Auditoria Verificada com cada ação registrada nominalmente."*
- **Duração estimada**: `03:45` (225 segundos).
- **Dependências**: `VID-09`.
