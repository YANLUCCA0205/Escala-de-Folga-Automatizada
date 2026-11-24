-- =============================================================================
-- ERP DE GESTÃO DO QUADRO DE COLABORADORES, ESCALAS E WORKFORCE MANAGEMENT
-- Migration 001: Schema Relacional Normalizado Completo (PostgreSQL / Supabase)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EMPRESAS E UNIDADES (Módulo A)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(100),
    state CHAR(2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SETORES, CATEGORIAS FUNCIONAIS E FUNÇÕES (Módulo A)
CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    display_order INT NOT NULL DEFAULT 100,
    min_daily_coverage INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unit_sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    min_daily_coverage INT NOT NULL DEFAULT 1,
    min_sunday_coverage INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (unit_id, sector_id)
);

CREATE TABLE IF NOT EXISTS functional_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    hierarchy_level INT NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES functional_categories(id) ON DELETE SET NULL,
    default_sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    hierarchy_rank INT NOT NULL DEFAULT 100,
    projected_monthly_cost NUMERIC(12, 2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. JORNADAS E HORÁRIOS DE TRABALHO (Módulo D)
CREATE TABLE IF NOT EXISTS work_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    shift_period VARCHAR(20) NOT NULL CHECK (shift_period IN ('MANHÃ', 'TARDE', 'INTERMEDIÁRIO', 'INTEGRAL', 'NOTURNO')),
    entry_time TIME NOT NULL,
    break_start TIME NOT NULL,
    break_end TIME NOT NULL,
    exit_base_time TIME NOT NULL,
    base_workload INTERVAL NOT NULL,
    extension_workload INTERVAL NOT NULL DEFAULT '00:00:00',
    effective_exit_time TIME NOT NULL,
    contract_daily_workload INTERVAL NOT NULL,
    weekly_hours NUMERIC(5, 2) NOT NULL DEFAULT 44.00,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MOTOR DE REGRAS DE ESCALA E VERSÕES (Módulo D)
CREATE TABLE IF NOT EXISTS schedule_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('5X1', '5X2', '6X1_DOM', '6X1_FLEX', 'CUSTOM')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_rule_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES schedule_rules(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    work_days_in_cycle INT NOT NULL,
    rest_days_in_cycle INT NOT NULL,
    allowed_rest_dows INT[] NOT NULL DEFAULT '{}', -- 0=Dom, 1=Seg, ..., 6=Sab
    max_consecutive_work_days INT NOT NULL DEFAULT 6,
    max_sundays_worked_consecutively INT NOT NULL DEFAULT 2,
    requires_sunday_lunch_slot BOOLEAN NOT NULL DEFAULT TRUE,
    closed_market_counts_as_rest BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from DATE NOT NULL DEFAULT '2026-01-01',
    effective_to DATE,
    priority INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rule_id, version_number)
);

-- 5. QUADRO DE VAGAS E POSTOS DE TRABALHO (Módulo B)
CREATE TABLE IF NOT EXISTS work_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    default_shift_id UUID REFERENCES work_shifts(id) ON DELETE SET NULL,
    default_rule_id UUID REFERENCES schedule_rules(id) ON DELETE SET NULL,
    position_number INT, -- NULL quando for RATEIO
    code VARCHAR(40) NOT NULL, -- Ex: '01', '02', 'RATEIO-01'
    title VARCHAR(150) NOT NULL, -- Ex: 'AÇOUGUEIRO 01'
    is_shared_rateio BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN_UNPLANNED'
        CHECK (status IN ('FILLED', 'OPEN_AUTHORIZED', 'OPEN_UNPLANNED', 'FROZEN', 'DEACTIVATED')),
    estimated_monthly_cost NUMERIC(12, 2),
    authorized_budget NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (unit_id, code, title)
);

CREATE INDEX IF NOT EXISTS idx_work_positions_unit_sector ON work_positions(unit_id, sector_id, status);

-- 6. COLABORADORES E ALOCAÇÕES HISTÓRICAS (Módulo C)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_code VARCHAR(40) UNIQUE NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    hire_date DATE NOT NULL,
    termination_date DATE,
    notice_period_end_date DATE,
    employment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (employment_status IN ('ACTIVE', 'ON_VACATION', 'MATERNITY_LEAVE', 'MEDICAL_LEAVE', 'NOTICE_PERIOD', 'TERMINATED')),
    anchor_last_rest_date DATE,
    anchor_cycle_offset INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_position_id UUID NOT NULL REFERENCES work_positions(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    work_shift_id UUID NOT NULL REFERENCES work_shifts(id) ON DELETE RESTRICT,
    schedule_rule_id UUID NOT NULL REFERENCES schedule_rules(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE, -- NULL significa alocação vigente atual
    transfer_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_allocations_employee_dates ON employee_allocations(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_allocations_position_dates ON employee_allocations(work_position_id, start_date, end_date);

-- 7. FÉRIAS, AFASTAMENTOS E INDISPONIBILIDADES (Módulo F)
CREATE TABLE IF NOT EXISTS unavailability_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL
        CHECK (event_type IN ('VACATION', 'MATERNITY_LEAVE', 'MEDICAL_LEAVE', 'NOTICE_PERIOD', 'UNPAID_LEAVE', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cycle_behavior VARCHAR(30) NOT NULL DEFAULT 'RESET_ON_RETURN'
        CHECK (cycle_behavior IN ('RESET_ON_RETURN', 'PRESERVE_PHASE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_unavailability_dates ON unavailability_events(employee_id, start_date, end_date);

-- 8. CALENDÁRIO OPERACIONAL DE ABERTURA DO MERCADO (Domingos, Feriados, Pontos Facultativos)
CREATE TABLE IF NOT EXISTS market_calendar_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    calendar_date DATE NOT NULL,
    day_type VARCHAR(30) NOT NULL
        CHECK (day_type IN ('NORMAL', 'SUNDAY', 'HOLIDAY', 'OPTIONAL_HOLIDAY', 'CRITICAL_OFFER', 'PAYDAY')),
    opening_mode VARCHAR(20) NOT NULL DEFAULT 'FULL_DAY'
        CHECK (opening_mode IN ('FULL_DAY', 'HALF_DAY', 'CLOSED')),
    description VARCHAR(150),
    half_day_closing_time TIME DEFAULT '13:00:00',
    requires_lunch_scale BOOLEAN NOT NULL DEFAULT FALSE,
    weight NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    UNIQUE (unit_id, calendar_date)
);

-- 9. ESCALAS MENSAIS, LANÇAMENTOS DIÁRIOS E ESTADOS DE CICLO (Módulo E)
CREATE TABLE IF NOT EXISTS monthly_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    year_month CHAR(7) NOT NULL, -- Formato 'YYYY-MM'
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'VALIDATED', 'PUBLISHED', 'IMPACTED_BY_PAST_CHANGE')),
    impact_warning TEXT,
    validated_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (unit_id, year_month)
);

CREATE TABLE IF NOT EXISTS daily_schedule_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monthly_schedule_id UUID NOT NULL REFERENCES monthly_schedules(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    work_position_id UUID NOT NULL REFERENCES work_positions(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    status VARCHAR(25) NOT NULL
        CHECK (status IN ('EMPTY', 'T', 'MEIO_EXP', 'F', 'A', 'FECHADO', 'V', 'LM', 'INSS', 'ADM', 'DEM')),
    origin VARCHAR(25) NOT NULL DEFAULT 'AUTO_GENERATED'
        CHECK (origin IN ('AUTO_GENERATED', 'MANUAL_OVERRIDE', 'VALIDATED', 'PUBLISHED', 'EXECUTED')),
    lunch_slot VARCHAR(10) CHECK (lunch_slot IN ('1', '2', '3', '4')), -- 1=09-10h, 2=10-11h, 3=11-12h, 4=12-13h
    rule_id UUID REFERENCES schedule_rules(id) ON DELETE SET NULL,
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_unit_date ON daily_schedule_entries(unit_id, work_date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_emp_date ON daily_schedule_entries(employee_id, work_date);

CREATE TABLE IF NOT EXISTS cycle_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    year_month CHAR(7) NOT NULL, -- Estado consolidado ao FIM deste mês ('YYYY-MM')
    last_rest_date DATE,
    consecutive_work_days INT NOT NULL DEFAULT 0,
    flex_rotation_index INT NOT NULL DEFAULT 0,
    sundays_worked_streak INT NOT NULL DEFAULT 0,
    last_lunch_slot VARCHAR(10),
    projected_next_rest_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, year_month)
);

-- 10. ADMINISTRAÇÃO, PERMISSÕES E AUDITORIA (Módulo H)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150),
    role_profile VARCHAR(30) NOT NULL DEFAULT 'ADMIN'
        CHECK (role_profile IN ('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
    authorized_units TEXT[] NOT NULL DEFAULT '{"LOJA_03"}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(100),
    summary TEXT NOT NULL,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
