# Workforce ERP v9.0 (compatível com base v8.0) — União Supermercados

Plataforma corporativa de Gestão de Quadro de Colaboradores, Estrutura Organizacional, Jornadas, Motor Temporal de Escalas (`5x1`, `5x2`, `6x1 Dom`, `6x1 Flex`), Rateio Multiunidade, Governança RBAC/MFA e Auditoria Verificada.

## Arquitetura Corporativa

- **Backend Dual-Mode: PostgreSQL Soberano Integrado (`server/`) + Supabase Cloud (`supabase/`)**:
  - **Modo Local Integrado (`npm run dev` / `npm run preview`)**: sobe automaticamente o backend corporativo em `/api/v9/*` com banco **PostgreSQL real em disco** (`.data/pgdata` via PGlite), executando as mesmas migrations SQL, **Row Level Security (RLS)** por unidade, hash de senhas `scrypt`, sessões JWT revogáveis, convites criptográficos de uso único, MFA TOTP RFC 6238 (`aal2`) e migração automática inicial das 19 partições operacionais.
  - **Modo Supabase Cloud**: basta definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local` para apontar o cliente para um projeto Supabase externo sem alterar uma linha de código.
- **Autenticação, Governança MASTER e Segurança de Banco (`supabase/migrations/`, `src/services/authService.js`)**:
  - Cadastro público eliminado, política de senhas >= 12 caracteres validada no cliente e no servidor, limitação de tentativas, mensagens neutras contra enumeração e modo *fail-closed* sem fallback inseguro em `localStorage`.
  - Hierarquia RBAC em 5 níveis (`MASTER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) com **MFA TOTP obrigatório (`aal2`)** para o perfil `MASTER` e proteção por trigger contra desativação do último `MASTER` ativo.
  - Isolamento efetivo por filial em `public.erp_partitions` sob **Row Level Security (RLS)** e gravação transacional via RPC `public.erp_save_batch` (controle otimista de revisão, bloqueio de escalas publicadas no servidor e trilha `public.erp_audit_logs` imutável *append-only*).
  - Provisionamento seguro via Edge Function / endpoint administrativo `admin-users` (convite de uso único ou senha temporária CSPRNG com troca obrigatória no primeiro acesso).
- **Design System Institucional e Layout Global (`src/ui/`, `src/layout/AppShell.jsx`, `src/theme/uniaoTheme.js`)**:
  - Tokens CSS derivados do Manual Oficial da Marca União Supermercados (`#2B5690` Azul União, `#E9403C` Vermelho União, tipografia `Montserrat`), superfícies neutras e iconografia SVG padronizada.
  - Barra lateral sanfonada organizada por 5 grandes áreas funcionais e recolhível para priorizar o espaço da grade operacional.
  - Cabeçalho global compacto com seletor único e consistente da unidade ativa, notificações e preferências centralizadas.
- **Motor de Escalas e Continuidade Temporal (`src/domain/scheduleEngine.js`, `src/modules/ScheduleGridModule.jsx`)**:
  - Preservação integral das regras trabalhistas (CLT Art. 66 interjornada 11h, faixas de almoço de domingo `1..4`, rateio multiunidade, checklist em 10 níveis e continuidade histórica entre competências, compatível com bases `Workforce ERP v8.0`).
  - Grade unificada com cabeçalho único fixo, agrupamento sanfonado por setor, ferramentas contextuais, modo tela ampliada, sinalização de conflitos na célula e navegação por teclado.

## Inicialização Rápida (Ambiente Local Integrado)

1. Inicie o servidor da aplicação (inicializa automaticamente o PostgreSQL `.data/pgdata`, aplica as migrations de segurança e importa as partições operacionais):
   ```bash
   npm run dev
   ```
2. Em outro terminal, provisione sua primeira conta `MASTER` nominal (sem senhas fixas no código):
   ```bash
   npm run provision:master -- --email seu.email@uniaosupermercados.com.br --name "Seu Nome Completo"
   ```
3. Abra no navegador o **link criptográfico de uso único** exibido no terminal para definir sua senha definitiva e cadastrar seu aplicativo autenticador TOTP (Google Authenticator, Microsoft Authenticator ou Authy).

> Para conectar a um projeto **Supabase Cloud**, copie `.env.example` para `.env.local`, preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, e siga `docs/security/MIGRATIONS_AND_ROLLBACK.md`.

## Comandos Principais

```bash
# Instalar dependências
npm install

# Executar aplicação + backend PostgreSQL RLS integrado
npm run dev

# Provisionar primeira conta MASTER
npm run provision:master -- --email seu.email@uniaosupermercados.com.br --name "Seu Nome"

# Executar todas as suítes automatizadas (92 testes: Motor + PostgreSQL RLS + Backend E2E + Auth + UI/SSR)
npm test

# Verificar lint
npm run lint

# Gerar build de produção
npm run build
```
