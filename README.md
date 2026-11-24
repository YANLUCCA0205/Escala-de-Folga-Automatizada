# Workforce ERP v9.0 (compatível com base v8.0) — União Supermercados

Plataforma corporativa de Gestão de Quadro de Colaboradores, Estrutura Organizacional, Jornadas, Motor Temporal de Escalas (`5x1`, `5x2`, `6x1 Dom`, `6x1 Flex`), Rateio Multiunidade, Governança RBAC/MFA e Auditoria Verificada.

## Arquitetura Corporativa

- **Autenticação, Governança MASTER e Segurança de Banco (`supabase/migrations/`, `src/services/authService.js`)**:
  - Identidade gerenciada exclusivamente pelo **Supabase Auth** (cadastro público desabilitado, política de senhas >= 12 caracteres, limitação de tentativas, mensagens neutras contra enumeração e modo *fail-closed* sem fallback local).
  - Hierarquia RBAC em 5 níveis (`MASTER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) com **MFA TOTP obrigatório (`aal2`)** para o perfil `MASTER` e proteção por trigger contra desativação do último `MASTER` ativo.
  - Isolamento efetivo por filial em `public.erp_partitions` sob **Row Level Security (RLS)** e gravação transacional via RPC `public.erp_save_batch` (controle otimista de revisão, bloqueio de escalas publicadas no servidor e trilha `public.erp_audit_logs` imutável *append-only*).
  - Provisionamento seguro via Edge Function `supabase/functions/admin-users` (convite de uso único ou senha temporária CSPRNG com troca obrigatória no primeiro acesso).
- **Design System Institucional e Layout Global (`src/ui/`, `src/layout/AppShell.jsx`, `src/theme/uniaoTheme.js`)**:
  - Tokens CSS derivados do Manual Oficial da Marca União Supermercados (`#2B5690` Azul União, `#E9403C` Vermelho União, tipografia `Montserrat`), superfícies neutras e iconografia SVG padronizada.
  - Barra lateral sanfonada organizada por 5 grandes áreas funcionais e recolhível para priorizar o espaço da grade operacional.
  - Cabeçalho global compacto com seletor único e consistente da unidade ativa, notificações e preferências centralizadas.
- **Motor de Escalas e Continuidade Temporal (`src/domain/scheduleEngine.js`, `src/modules/ScheduleGridModule.jsx`)**:
  - Preservação integral das regras trabalhistas (CLT Art. 66 interjornada 11h, faixas de almoço de domingo `1..4`, rateio multiunidade, checklist em 10 níveis e continuidade histórica entre competências, compatível com bases `Workforce ERP v8.0`).
  - Grade unificada com cabeçalho único fixo, agrupamento sanfonado por setor, ferramentas contextuais, modo tela ampliada, sinalização de conflitos na célula e navegação por teclado.

## Configuração Rápida

1. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Aplique as migrations em `supabase/migrations/` e publique a Edge Function `admin-users`.
3. Provisione a primeira conta `MASTER` conforme `docs/security/MIGRATIONS_AND_ROLLBACK.md`.

## Comandos Principais

```bash
# Instalar dependências
npm install

# Executar servidor de desenvolvimento
npm run dev

# Executar todas as suítes automatizadas (Motor + Segurança Postgres PGlite + Auth/Partições + Navegação)
npm test

# Verificar lint
npm run lint

# Gerar build de produção
npm run build
```
