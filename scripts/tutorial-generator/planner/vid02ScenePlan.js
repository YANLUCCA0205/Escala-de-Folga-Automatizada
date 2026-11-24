// =============================================================================
// PLANEJADOR DE CENAS ESTRUTURADAS — CENÁRIO PILOTO VID-02 (PRIORIDADE 3.1)
// Gera o plano de cenas reproduzível a partir do roteiro do VID-02 (Dashboard
// Executivo: Posição do Quadro na Data vs Fluxo Mensal).
// =============================================================================

import fs from "node:fs";
import path from "node:path";

export function buildVid02StructuredPlan() {
  return {
    videoId: "VID-02",
    title: "Dashboard Executivo: Posição do Quadro na Data (Fotografia) vs Fluxo Mensal",
    targetAudience: "Gestores, RH e Diretoria (VIEWER, MANAGER, ADMIN)",
    resolution: { width: 1920, height: 1080 },
    fps: 15,
    featuresCovered: ["FEAT-CTX-01", "FEAT-DASH-01", "FEAT-DASH-02"],
    scenes: [
      {
        sceneId: "VID02_SCENE_01",
        order: 1,
        title: "Abertura e Acesso ao Dashboard Executivo",
        narrationText:
          "Bem-vindo ao tutorial do Dashboard Executivo do Workforce ERP versão 8.0. Neste vídeo, vamos aprender a analisar a Posição do Quadro na Data e diferenciá-la do fluxo mensal da loja.",
        subtitleText:
          "Bem-vindo ao Dashboard Executivo do Workforce ERP v8.0: Posição do Quadro na Data vs Fluxo Mensal.",
        calloutLabel: "1. Menu Lateral: Dashboard e Indicadores",
        minDurationMs: 7000,
        steps: [
          {
            type: "CLICK_ROLE",
            role: "button",
            namePattern: "Dashboard e Indicadores",
            callout: "Acesso ao Painel Executivo e BI",
            waitAfterMs: 1200,
          },
          {
            type: "HIGHLIGHT_TEXT",
            textPattern: "Painel Executivo de Quadro de Pessoal, Escalas e Inteligência Analítica",
            callout: "Cabeçalho de Governança e Fotografia Diária",
            waitAfterMs: 1500,
          },
        ],
        observableAssertion: {
          description: "Título do Painel Executivo visível no topo da tela",
          checkText: "Painel Executivo de Quadro de Pessoal, Escalas e Inteligência Analítica",
        },
      },
      {
        sceneId: "VID02_SCENE_02",
        order: 2,
        title: "Configurando a Competência e a Fotografia na Data",
        narrationText:
          "No cabeçalho superior, selecionamos a competência de Novembro de 2026 e definimos a data exata da fotografia para o dia 10 de Novembro. Observe que o sistema recalcula instantaneamente todos os indicadores para refletir este dia específico.",
        subtitleText:
          "Selecione a Competência Base (2026-11) e a data da Fotografia do Quadro (10/11/2026).",
        calloutLabel: "2. Seletor: Posição do Quadro na Data (10/11/2026)",
        minDurationMs: 8500,
        steps: [
          {
            type: "HIGHLIGHT_SELECTOR",
            selector: 'input[type="month"]',
            callout: "Competência Base: Novembro/2026",
            waitAfterMs: 1400,
          },
          {
            type: "SET_DATE_INPUT",
            selector: 'input[type="date"]',
            value: "2026-11-10",
            callout: "Fotografia em 10/11/2026 (Férias Ativas na Data)",
            waitAfterMs: 1800,
          },
        ],
        observableAssertion: {
          description: "Texto confirmando a fotografia na data 10/11/2026 visível",
          checkText: "Posição do Quadro na Data (10/11/2026)",
        },
      },
      {
        sceneId: "VID02_SCENE_03",
        order: 3,
        title: "Inspeção dos 7 KPIs Executivos: Vagas Preenchidas vs Férias na Data",
        narrationText:
          "Nos sete cartões executivos, vemos 24 postos próprios e 2 postos compartilhados de rateio. Mesmo quando um titular está em férias no dia 10 de Novembro, sua vaga permanece preenchida, enquanto o cartão Disponíveis na Data mostra quem realmente está apto para operar hoje.",
        subtitleText:
          "Vagas continuam preenchidas durante as férias, mas o card 'Disponíveis na Data' reflete as ausências.",
        calloutLabel: "3. KPIs: Estoque de Vagas vs Disponibilidade Real na Data",
        minDurationMs: 9500,
        steps: [
          {
            type: "HIGHLIGHT_TEXT",
            textPattern: "Postos Planejados (Quadro Próprio)",
            callout: "24 Postos Próprios + 2 de Rateio",
            waitAfterMs: 1600,
          },
          {
            type: "HIGHLIGHT_TEXT",
            textPattern: "Férias na Data (Fotografia)",
            callout: "Distingue Férias Hoje vs Férias no Mês",
            waitAfterMs: 1800,
          },
          {
            type: "HIGHLIGHT_TEXT",
            textPattern: "Disponíveis para Operação na Data",
            callout: "Efetivo Disponível no Dia 10/11",
            waitAfterMs: 1600,
          },
        ],
        observableAssertion: {
          description: "Card 'Férias na Data (Fotografia)' e 'Disponíveis para Operação na Data' visíveis",
          checkText: "Férias na Data (Fotografia)",
        },
      },
      {
        sceneId: "VID02_SCENE_04",
        order: 4,
        title: "Inteligência Analítica por Período Flexível (Semana 1 a 5 e Intervalo Livre)",
        narrationText:
          "Descendo para a Inteligência Analítica por Período Flexível, podemos consultar qualquer recorte de tempo: dia específico, primeira à quinta semana do mês — cobrindo os dias 29 a 31 —, quinzenas ou um intervalo personalizado entre dois meses, separando colaboradores únicos de pessoas-dia.",
        subtitleText:
          "Consulte Semanas (1ª a 5ª), Quinzenas ou Intervalos Personalizados separando Pessoas Únicas de Pessoas-Dia.",
        calloutLabel: "4. Período Flexível: Semana 1..5, Quinzena e Intervalo",
        minDurationMs: 9500,
        steps: [
          {
            type: "SCROLL_TO_TEXT",
            textPattern: "Inteligência Analítica por Período Flexível",
            waitAfterMs: 800,
          },
          {
            type: "CLICK_ROLE",
            role: "button",
            namePattern: "Quinzena",
            callout: "Filtro por 1ª ou 2ª Quinzena",
            waitAfterMs: 1500,
          },
          {
            type: "CLICK_ROLE",
            role: "button",
            namePattern: "Intervalo Personalizado",
            callout: "Intervalo Cruzando Meses (25/10 a 05/11)",
            waitAfterMs: 1800,
          },
          {
            type: "HIGHLIGHT_TEXT",
            textPattern: "Colaboradores Únicos",
            callout: "Pessoas Únicas vs Pessoas-Dia Acumuladas",
            waitAfterMs: 1400,
          },
        ],
        observableAssertion: {
          description: "Métrica 'Colaboradores Únicos' visível na seção de Período Flexível",
          checkText: "Colaboradores Únicos",
        },
      },
      {
        sceneId: "VID02_SCENE_05",
        order: 5,
        title: "Mapa Analítico por Setor e Equilíbrio de Almoço Dominical",
        narrationText:
          "Por fim, na tabela de lotação por setor, você compara lado a lado as vagas ocupadas, as férias na data e no fluxo do mês e a distribuição das quatro faixas de almoço aos domingos. Assim você toma decisões rápidas com total segurança operacional.",
        subtitleText:
          "Mapa Analítico Setorial: compare lotação, férias na data vs fluxo mensal e faixas de almoço.",
        calloutLabel: "5. Quadro Analítico por Setor e Faixas de Almoço N01-N04",
        minDurationMs: 8500,
        steps: [
          {
            type: "SCROLL_TO_TEXT",
            textPattern: "Mapa Analítico de Lotação",
            waitAfterMs: 1000,
          },
          {
            type: "HIGHLIGHT_TEXT",
            textPattern: "Mapa Analítico de Lotação",
            callout: "Visão Consolidada dos Setores da Filial Demo",
            waitAfterMs: 2200,
          },
        ],
        observableAssertion: {
          description: "Tabela 'Mapa Analítico de Lotação' visível com setores da unidade",
          checkText: "AÇOUGUE",
        },
      },
    ],
  };
}

export function saveStructuredPlanArtifact(workspaceRoot, plan) {
  const outPath = path.join(
    workspaceRoot,
    "docs",
    "ai-tutorials",
    "VID-02_SCENE_PLAN.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), "utf8");
  return outPath;
}
