# Governança de Segurança, Migrations, Provisionamento MASTER e Rollback

## 1. Visão Geral das Migrations (v9.0)

| Ordem | Arquivo | Natureza | Finalidade |
|---|---|---|---|
| 1 | `supabase/migrations/20261028_erp_complete_schema.sql` | Legada (preservada) | Esquema relacional histórico inicial (mantido para rastreabilidade). |
| 2 | `supabase/migrations/20261201000100_security_foundation.sql` | **Aditiva e reversível** | Cria schema `private`, tabelas `erp_permissions`, `erp_role_permissions`, `erp_profiles`, `erp_audit_logs` (append-only por triggers), `private.credential_resets`, predicados RLS (`session_is_valid`, `is_active_user`, `has_permission`, `can_access_unit`, `recent_mfa`), proteção do último `MASTER` ativo e RPCs de ativação/administração. |
| 3 | `supabase/migrations/20261201000200_partitioned_storage.sql` | **Aditiva e reversível** | Cria `public.erp_partitions` `(scope, kind, period)`, `public.erp_settings` e `public.erp_backups` com RLS por unidade e RPC transacional `public.erp_save_batch` (concorrência otimista + trava de escala publicada + auditoria na mesma transação). |
| 4 | `supabase/migrations/20261201000300_lockdown_legacy_tables.sql` | **Restritiva (requer autorização antes de aplicar em produção)** | Habilita RLS e revoga `ALL` de `anon` e `authenticated` na tabela legada `configuracoes` e tabelas sem RLS, mantendo os dados intactos para `service_role`. |

---

## 2. Procedimento Seguro de Criação do Primeiro MASTER

### Modo A — Backend PostgreSQL Soberano Integrado (`npm run dev` / Servidor Local)
1. Ao iniciar `npm run dev`, o plugin `server/viteBackendPlugin.js` inicializa `.data/pgdata`, aplica idempotentemente as migrations `20261201000100` e `20261201000200` e migra automaticamente as 19 partições operacionais.
2. Em um terminal administrativo da própria máquina (com `npm run dev` ativo ou com o servidor parado), execute:
   ```powershell
   npm run provision:master -- --email seu.email@uniaosupermercados.com.br --name "Seu Nome Completo"
   ```
   - Caso `npm run dev` esteja ativo, o script autentica em `http://127.0.0.1:5173/api/v9/internal/bootstrap` usando o segredo local `.data/admin.secret` (restrito a *loopback*). Caso esteja parado, abre `.data/pgdata` diretamente.
3. Abra no navegador o **link criptográfico de uso único** emitido no terminal, defina a senha definitiva (>= 8 caracteres) e cadastre o segundo fator TOTP (`aal2`).

### Modo B — Projeto Supabase Cloud Externo
1. Aplique as migrations `20261201000100` e `20261201000200` no projeto Supabase (`supabase db push`).
2. Publique a Edge Function administrativa:
   ```bash
   supabase functions deploy admin-users
   ```
3. Em um terminal administrativo seguro (fora do navegador, sem gravar segredos em arquivos versionados), defina temporariamente as variáveis de ambiente e execute o script:
   ```powershell
   $env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
   node scripts/provision-first-master.mjs --email diretoria@uniaosupermercados.com.br --name "Governança Corporativa" --mode link
   ```
4. O script invocará `public.admin_bootstrap_first_master` (que **recusa execução** caso já exista qualquer conta `MASTER` pendente ou ativa) e emitirá um link criptográfico de uso único.
5. Ao abrir o link:
   - O operador define sua senha definitiva (>= 8 caracteres, aprovada por `passwordPolicy.js` e GoTrue).
   - A conta passa de `PENDING` para `ACTIVE` (`complete_activation`).
   - O sistema exige imediatamente o cadastramento do segundo fator TOTP (`MfaEnrollPage`) para elevar a sessão a `aal2`.

### Recuperação Administrativa (Break-Glass — Local ou Cloud)
Caso todos os dispositivos MFA do único `MASTER` sejam perdidos e não exista outro `MASTER` ativo:
```powershell
npm run provision:master -- --recover --i-understand-break-glass --email diretoria@uniaosupermercados.com.br --name "Governança Corporativa"
```
- A função `public.admin_recover_master` bloqueia a execução caso exista outro `MASTER` ativo no banco.
- Remove os fatores TOTP perdidos, invalida sessões, exige troca imediata de senha (`must_change_password = true`) e grava registro imutável com `origin_type = 'BREAK_GLASS'` em `public.erp_audit_logs`.

---

## 3. Migração Controlada da Base Operacional

1. **Simulação obrigatória (`--dry-run`)**:
   ```bash
   node scripts/migrate-legacy-to-partitions.mjs --source supabase --dry-run
   ```
   O script confere matematicamente 100% das coleções (`companies`, `units`, `sectors`, `roles`, `workShifts`, `scheduleRules`, `workPositions`, `employees`, `allocations`, `unavailabilityEvents`, `marketCalendarDays`, `monthlySchedules`, `dailyEntriesByMonth`, `cycleStates`) e aborta caso haja qualquer divergência.
2. **Aplicação com backup automático (`PRE_MIGRATION`)**:
   ```bash
   node scripts/migrate-legacy-to-partitions.mjs --source supabase --apply
   ```
3. **Lockdown da tabela legada** (somente após validação da operação na v9 e autorização formal): aplicar `20261201000300_lockdown_legacy_tables.sql`.

---

## 4. Governança de Dados Pessoais (LGPD) e Histórico Git

### Exposição identificada na auditoria
Foram localizados no repositório público (commit `81b5783` e anteriores):
1. `backups/backup_pre_v8_20261028.json` — nomes completos de 61 colaboradores, matrículas, admissões, férias e afastamentos médicos (INSS).
2. `escala_novembro_2026_loja3.csv` — escala nominal da Loja 03.
3. `src/domain/seedLoja03.js` — razão social, CNPJ e nomes de colaboradores (anteriormente empacotado no bundle público do navegador!).
4. Chave `anon` e URL do projeto legado fixadas no código-fonte anterior.

### Mitigações já implementadas nesta branch (sem reescrita destrutiva de histórico)
- **Bundle do frontend 100% limpo**: `seedLoja03.js` e dados empresariais hardcoded foram removidos de `erpRepository.js`, `AdminAndAuditModule.jsx` e `OrganizationAndPositionsModule.jsx`. Nenhum dado nominal real é enviado a visitantes não autenticados no build de produção (`dist/`).
- **Chaves fixas removidas**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` passaram a ser lidas exclusivamente de variáveis de ambiente.

### Procedimento recomendado mediante autorização expressa do proprietário
1. Rotacionar chaves no painel do Supabase / utilizar novo projeto Supabase dedicado.
2. Remover arquivos sensíveis do índice mantendo cópia segura fora do Git:
   ```bash
   git rm --cached backups/backup_pre_v8_20261028.json escala_novembro_2026_loja3.csv
   ```
3. Caso o repositório permaneça público, expurgar blobs históricos com `git filter-repo` após backup completo do repositório bare:
   ```bash
   git filter-repo --path backups/backup_pre_v8_20261028.json --path escala_novembro_2026_loja3.csv --invert-paths
   ```

---

## 5. Procedimento de Recuperação e Rollback

### Nível 1 — Restauração Operacional pelo Painel MASTER
- Acesse **Administração → Backup e recuperação**, selecione o snapshot desejado (ou o snapshot `PRE_MIGRATION` / `PRE_RESTORE`), valide o código TOTP MFA recente e digite `RESTAURAR <prefixo-id>`.

### Nível 2 — Rollback das Migrations Aditivas (SQL)
Como a tabela legada `configuracoes` permanece intacta durante toda a transição:
```sql
-- Apenas em cenário extremo de retorno emergencial com autorização expressa:
drop table if exists public.erp_backups cascade;
drop table if exists public.erp_partitions cascade;
drop table if exists public.erp_settings cascade;
drop table if exists public.erp_audit_logs cascade;
drop table if exists public.erp_profiles cascade;
drop table if exists public.erp_role_permissions cascade;
drop table if exists public.erp_permissions cascade;
drop schema if exists private cascade;
```
