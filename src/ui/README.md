# Design System Institucional — Workforce ERP União Supermercados

## 1. Fonte de Identidade Visual
Baseado no **Manual de Identidade Visual União Supermercados**:
- **Azul União (`#2B5690`, Pantone 293 C)**: estabilidade, solidez e seriedade — aplicado na navegação institucional, ações primárias padrão, indicadores de foco e estados ativos.
- **Vermelho União (`#E9403C`, Pantone 485 C)**: energia e expressão — aplicado com parcimônia no filete de item ativo da navegação e na marca oficial, evitando competir com alertas de erro.
- **Tipografia**: família `Montserrat` (`400`, `500`, `600`, `700`) com `font-variant-numeric: tabular-nums` em tabelas e grades de escalas.

## 2. Princípios Visuais e Operacionais
- **Superfícies neutras**: fundo de aplicação `#F3F5F8` e cartões `#FFFFFF` com bordas sutis (`1px solid #DDE3EC`).
- **Hierarquia estrita de botões**:
  - `primary`: uma única ação principal por contexto operacional.
  - `secondary`: ações complementares frequentes.
  - `tertiary`: ações auxiliares de baixo peso visual.
  - `danger` / `danger-outline`: operações destrutivas, sempre isoladas de ações rotineiras e protegidas por `ConfirmDialog`.
- **Legibilidade mínima**: nenhum texto operacional abaixo de `12px` (`--erp-text-xs`); corpo padrão em `13px` (`--erp-text-sm`).
- **Zero ruído decorativo**: sem emojis coloridos como ícones (substituídos por `Icon.jsx` em SVG 1.75px), sem gradientes chamativos, sem sombras em cartões estáticos e sem cartões aninhados desnecessários.
