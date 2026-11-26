// =============================================================================
// TELAS CORPORATIVAS DE AUTENTICAÇÃO E CICLO DE ACESSO — WORKFORCE ERP v9.0
//
// Composição institucional de tela inteira em duas áreas integradas:
//   1. Painel Institucional (União Supermercados — sólido, sóbrio, sem gradientes)
//   2. Painel Funcional (acesso restrito, sem cadastro público, sem seletor RBAC)
// =============================================================================

import { useState, useEffect, useRef } from "react";
import UniaoLogo from "../../components/UniaoLogo.jsx";
import { evaluatePassword } from "../../domain/passwordPolicy.js";
import {
  Button,
  Field,
  TextInput,
  PasswordInput,
  Alert,
  Badge,
  Icon,
} from "../../ui/index.jsx";

export function AuthLayout({ environmentLabel, children }) {
  return (
    <div className="erp-auth-screen">
      {/* ÁREA INSTITUCIONAL */}
      <section className="erp-auth-brand" aria-label="Identidade institucional">
        {/* Composição geométrica discreta em linha fina (referência ao movimento de onda da marca) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 600 600"
          fill="none"
          style={{
            position: "absolute",
            right: -120,
            bottom: -120,
            width: 520,
            height: 520,
            opacity: 0.06,
            pointerEvents: "none",
          }}
        >
          <circle cx="380" cy="380" r="160" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="380" cy="380" r="240" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="380" cy="380" r="320" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>

        <div>
          <UniaoLogo variant="positivo_azul" layout="horizontal" size="lg" idSuffix="auth_brand" />
        </div>

        <div style={{ maxWidth: 440, position: "relative" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94A8C4",
              marginBottom: 10,
            }}
          >
            Plataforma Corporativa de Gestão Operacional
          </div>
          <h1
            style={{
              margin: "0 0 14px",
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.25,
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
            }}
          >
            Workforce ERP — Quadro de Colaboradores e Escalas
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "#CBD5E1",
            }}
          >
            Planejamento de jornadas, controle de ocupação de postos, continuidade de ciclos
            trabalhistas e governança auditada das unidades do União Supermercados.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingTop: 20,
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            fontSize: 12,
            color: "#94A8C4",
          }}
        >
          <span>União Supermercados · Acesso restrito a operadores autorizados</span>
          <span style={{ fontFamily: "var(--erp-font-mono)" }}>v9.0</span>
        </div>
      </section>

      {/* ÁREA FUNCIONAL DE AUTENTICAÇÃO */}
      <main className="erp-auth-functional">
        <div className="erp-auth-box">
          {environmentLabel && (
            <div style={{ marginBottom: 20 }}>
              <Badge tone="neutral" dot>
                {environmentLabel}
              </Badge>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 1. PÁGINA DE LOGIN CORPORATIVO
// -----------------------------------------------------------------------------
export function LoginPage({
  environmentLabel,
  onSubmit,
  onForgotPassword,
  busy = false,
  notice = null,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const res = await onSubmit({ email, password });
    if (res && !res.ok && res.message) {
      setErrorMsg(res.message);
    }
  };

  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--erp-ink)",
          letterSpacing: "-0.015em",
        }}
      >
        Acesso ao sistema
      </h2>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: "var(--erp-text-sm)",
          color: "var(--erp-ink-muted)",
        }}
      >
        Utilize suas credenciais corporativas nominais para iniciar a sessão.
      </p>

      {notice && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">{notice}</Alert>
        </div>
      )}

      {errorMsg && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="E-mail corporativo" required>
          {(id) => (
            <TextInput
              id={id}
              type="email"
              size="lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.sobrenome@uniaosupermercados.com.br"
              autoComplete="username"
              autoFocus
              required
            />
          )}
        </Field>

        <Field label="Senha" required>
          {(id) => (
            <PasswordInput
              id={id}
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />
          )}
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
          <button
            type="button"
            onClick={onForgotPassword}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              color: "var(--erp-brand-blue)",
              fontSize: "var(--erp-text-xs)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recuperar senha
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!email.trim() || !password}
        >
          Entrar
        </Button>
      </form>

      <div
        style={{
          marginTop: 28,
          paddingTop: 16,
          borderTop: "1px solid var(--erp-border)",
          fontSize: "var(--erp-text-xs)",
          color: "var(--erp-ink-muted)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--erp-ink-secondary)" }}>Orientação de acesso:</strong> este
        sistema não permite criação pública de contas. Para solicitar provisionamento ou ajuste de
        unidades autorizadas, contate o administrador de governança (TI / RH Corporativo).
      </div>
    </AuthLayout>
  );
}

// -----------------------------------------------------------------------------
// 2. RECUPERAÇÃO DE SENHA (sem enumeração de contas)
// -----------------------------------------------------------------------------
export function ForgotPasswordPage({ environmentLabel, onSubmit, onBack, busy = false }) {
  const [email, setEmail] = useState("");
  const [submittedMsg, setSubmittedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const res = await onSubmit(email);
    if (res?.ok) {
      setSubmittedMsg(res.message);
    } else {
      setErrorMsg(res?.message || "Não foi possível processar a solicitação.");
    }
  };

  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Recuperação de senha</h2>
      <p style={{ margin: "0 0 20px", fontSize: "var(--erp-text-sm)", color: "var(--erp-ink-muted)" }}>
        Informe seu e-mail corporativo para receber um link seguro de redefinição de uso único.
      </p>

      {submittedMsg ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Alert tone="success" title="Solicitação registrada">
            {submittedMsg}
          </Alert>
          <Button variant="secondary" size="lg" fullWidth onClick={onBack}>
            Voltar para o acesso
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}
          <Field label="E-mail corporativo" required>
            {(id) => (
              <TextInput
                id={id}
                type="email"
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome.sobrenome@uniaosupermercados.com.br"
                autoComplete="username"
                autoFocus
                required
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={busy}
            disabled={!email.trim()}
          >
            Enviar instruções
          </Button>
          <Button type="button" variant="tertiary" size="md" fullWidth onClick={onBack}>
            Voltar para o acesso
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

// -----------------------------------------------------------------------------
// 3. PRIMEIRO ACESSO / ATIVAÇÃO DE CONTA / DEFINIÇÃO DE SENHA
// -----------------------------------------------------------------------------
export function SetPasswordPage({
  environmentLabel,
  mode = "invite", // 'invite' | 'recovery' | 'forced'
  profile,
  onSubmit,
  onCancel,
  busy = false,
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const evaluation = evaluatePassword(password, {
    email: profile?.email || "",
    fullName: profile?.fullName || "",
  });
  const matches = password.length > 0 && password === confirm;

  const copyByMode = {
    invite: {
      title: "Primeiro acesso e ativação de conta",
      subtitle:
        "Bem-vindo(a). Defina sua senha definitiva e pessoal para ativar sua conta corporativa.",
      cta: "Ativar conta e continuar",
    },
    recovery: {
      title: "Definir nova senha",
      subtitle: "Cadastre uma nova senha corporativa que atenda aos critérios de segurança.",
      cta: "Salvar nova senha",
    },
    forced: {
      title: "Alteração obrigatória de senha",
      subtitle:
        "Sua credencial atual é temporária ou foi redefinida pela administração. Defina uma senha definitiva para prosseguir.",
      cta: "Atualizar senha e continuar",
    },
  }[mode] || {
    title: "Definir senha",
    subtitle: "Escolha uma senha corporativa segura.",
    cta: "Confirmar senha",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!evaluation.valid || !matches) return;
    const res = await onSubmit(password);
    if (res && !res.ok) {
      setErrorMsg(res.message || "Não foi possível registrar a nova senha.");
    }
  };

  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700 }}>{copyByMode.title}</h2>
      <p style={{ margin: "0 0 18px", fontSize: "var(--erp-text-sm)", color: "var(--erp-ink-muted)" }}>
        {copyByMode.subtitle}
      </p>

      {profile?.email && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 14,
            background: "var(--erp-surface)",
            border: "1px solid var(--erp-border)",
            borderRadius: 6,
            fontSize: "var(--erp-text-xs)",
          }}
        >
          Conta: <strong>{profile.email}</strong>
        </div>
      )}

      {errorMsg && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Nova senha definitiva" required>
          {(id) => (
            <PasswordInput
              id={id}
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
              required
            />
          )}
        </Field>

        <Field
          label="Confirmar nova senha"
          required
          error={confirm.length > 0 && !matches ? "A confirmação não coincide com a senha digitada." : ""}
        >
          {(id) => (
            <PasswordInput
              id={id}
              size="lg"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              invalid={confirm.length > 0 && !matches}
              required
            />
          )}
        </Field>

        <div
          style={{
            padding: "10px 12px",
            background: "var(--erp-surface)",
            border: "1px solid var(--erp-border)",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--erp-text-xs)",
              fontWeight: 700,
              marginBottom: 2,
            }}
          >
            <span>Requisitos de segurança</span>
            <span>{evaluation.strengthLabel}</span>
          </div>
          {evaluation.rules.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--erp-text-xs)",
                color: r.ok ? "var(--erp-success)" : "var(--erp-ink-muted)",
              }}
            >
              <Icon name={r.ok ? "check" : "chevronRight"} size={13} />
              <span>{r.label}</span>
            </div>
          ))}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!evaluation.valid || !matches}
        >
          {copyByMode.cta}
        </Button>

        {onCancel && (
          <Button type="button" variant="tertiary" size="sm" fullWidth onClick={onCancel}>
            Cancelar e encerrar sessão
          </Button>
        )}
      </form>
    </AuthLayout>
  );
}

// -----------------------------------------------------------------------------
// 4. CADASTRO E VERIFICAÇÃO DE MFA (TOTP — Obrigatório para MASTER)
// -----------------------------------------------------------------------------
export function MfaEnrollPage({ environmentLabel, onStart, onVerify, onSignOut, busy = false }) {
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingInit, setLoadingInit] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return undefined;
    startedRef.current = true;
    onStart()
      .then((data) => {
        setEnrollment(data);
        setLoadingInit(false);
      })
      .catch((err) => {
        setErrorMsg(err?.message || "Falha ao gerar chave MFA.");
        setLoadingInit(false);
      });
    return undefined;
  }, [onStart]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!enrollment?.factorId) return;
    const res = await onVerify({ factorId: enrollment.factorId, code });
    if (res && !res.ok) {
      setErrorMsg(res.message || "Código inválido.");
    }
  };

  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700 }}>
        Configurar autenticação multifator (MFA)
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: "var(--erp-text-sm)", color: "var(--erp-ink-muted)" }}>
        Contas de governança MASTER exigem obrigatoriamente segundo fator TOTP (Google
        Authenticator, Microsoft Authenticator ou 1Password).
      </p>

      {errorMsg && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      {loadingInit ? (
        <div style={{ padding: "24px 0", fontSize: "var(--erp-text-sm)" }}>
          Gerando chave criptográfica TOTP...
        </div>
      ) : enrollment ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {enrollment.qrCode && (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid var(--erp-border)",
                borderRadius: 6,
                padding: 14,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <img
                src={enrollment.qrCode}
                alt="QR Code para aplicativo autenticador MFA"
                style={{ width: 176, height: 176 }}
              />
            </div>
          )}

          {enrollment.secret && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--erp-surface)",
                border: "1px solid var(--erp-border)",
                borderRadius: 6,
                fontSize: "var(--erp-text-xs)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                <div style={{ color: "var(--erp-ink-muted)", marginBottom: 2 }}>
                  Chave de configuração TOTP (Base32)
                </div>
                <code style={{ fontFamily: "var(--erp-font-mono)", fontWeight: 700, fontSize: 13 }}>
                  {enrollment.secret}
                </code>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon="copy"
                onClick={() => navigator.clipboard?.writeText(enrollment.secret)}
              >
                Copiar
              </Button>
            </div>
          )}

          <Field label="Código de 6 dígitos gerado pelo autenticador" required>
            {(id) => (
              <TextInput
                id={id}
                size="lg"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoComplete="one-time-code"
                required
              />
            )}
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={busy}
            disabled={code.length !== 6}
          >
            Validar e concluir ativação MFA
          </Button>
          <Button type="button" variant="tertiary" size="sm" fullWidth onClick={onSignOut}>
            Sair
          </Button>
        </form>
      ) : null}
    </AuthLayout>
  );
}

export function MfaVerifyPage({ environmentLabel, onSubmit, onSignOut, busy = false }) {
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const res = await onSubmit({ code });
    if (res && !res.ok) {
      setErrorMsg(res.message || "Código de verificação inválido.");
    }
  };

  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700 }}>
        Verificação em duas etapas
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: "var(--erp-text-sm)", color: "var(--erp-ink-muted)" }}>
        Informe o código temporário de 6 dígitos exibido em seu aplicativo autenticador.
      </p>

      {errorMsg && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Código autenticador (TOTP)" required>
          {(id) => (
            <TextInput
              id={id}
              size="lg"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={busy}
          disabled={code.length !== 6}
        >
          Confirmar acesso
        </Button>
        <Button type="button" variant="tertiary" size="sm" fullWidth onClick={onSignOut}>
          Encerrar sessão
        </Button>
      </form>
    </AuthLayout>
  );
}

// -----------------------------------------------------------------------------
// 5. TELAS DE ESTADO DE CONTA / SESSÃO / INDISPONIBILIDADE (Fail-Closed)
// -----------------------------------------------------------------------------
export function AccountBlockedPage({ environmentLabel, variant = "deactivated", onSignOut }) {
  const content = {
    deactivated: {
      title: "Conta desativada",
      body: "O seu cadastro de operador encontra-se desativado e não possui permissão para consultar ou alterar dados operacionais.",
    },
    suspended: {
      title: "Conta temporariamente suspensa",
      body: "O seu acesso está temporariamente suspenso pela administração do sistema.",
    },
    no_profile: {
      title: "Conta sem perfil operacional autorizado",
      body: "Sua identidade ainda não possui perfil e unidades atribuídos pelo administrador MASTER.",
    },
  }[variant] || {
    title: "Acesso bloqueado",
    body: "Esta conta não está habilitada para acessar o sistema.",
  };

  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <Alert tone="danger" title={content.title}>
        {content.body}
      </Alert>
      <p
        style={{
          margin: "16px 0 20px",
          fontSize: "var(--erp-text-xs)",
          color: "var(--erp-ink-muted)",
          lineHeight: 1.5,
        }}
      >
        Caso necessite de regularização de acesso, entre em contato com o administrador responsável
        pela governança do Workforce ERP.
      </p>
      <Button variant="secondary" size="lg" fullWidth onClick={onSignOut}>
        Voltar para a tela inicial
      </Button>
    </AuthLayout>
  );
}

export function SessionExpiredPage({ environmentLabel, onContinue }) {
  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <Alert tone="warning" title="Sessão encerrada ou expirada">
        Por segurança, sua sessão anterior expirou ou foi revogada pela administração. Realize
        uma nova autenticação para continuar trabalhando.
      </Alert>
      <div style={{ marginTop: 18 }}>
        <Button variant="primary" size="lg" fullWidth onClick={onContinue}>
          Autenticar novamente
        </Button>
      </div>
    </AuthLayout>
  );
}

export function ServiceUnavailablePage({
  environmentLabel,
  onRetry,
  busy = false,
}) {
  return (
    <AuthLayout environmentLabel={environmentLabel}>
      <Alert
        tone="danger"
        title="Serviço de autenticação indisponível"
      >
        Não foi possível validar sua identidade junto ao servidor corporativo no momento. Por
        segurança, novas sessões permanecem bloqueadas até o restabelecimento da comunicação.
      </Alert>
      <div style={{ marginTop: 18 }}>
        <Button variant="primary" size="lg" fullWidth onClick={onRetry} loading={busy}>
          Verificar conexão novamente
        </Button>
      </div>
      <p
        style={{
          marginTop: 16,
          fontSize: "var(--erp-text-xs)",
          color: "var(--erp-ink-muted)",
          lineHeight: 1.5,
        }}
      >
        Caso a indisponibilidade persista, contate o administrador do sistema.
      </p>
    </AuthLayout>
  );
}
