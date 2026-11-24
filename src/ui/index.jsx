// =============================================================================
// BIBLIOTECA DE COMPONENTES REUTILIZÁVEIS — DESIGN SYSTEM UNIÃO ERP (v9.0)
// Todos os componentes seguem padrões WAI-ARIA, navegação por teclado e tokens CSS.
// =============================================================================

import { useState, useEffect, useRef, useId } from "react";
import Icon from "./Icon.jsx";

export { Icon };

export function Button({
  variant = "secondary", // 'primary' | 'secondary' | 'tertiary' | 'danger' | 'danger-outline'
  size = "md", // 'sm' | 'md' | 'lg'
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const classes = [
    "erp-btn",
    `erp-btn--${variant}`,
    size !== "md" ? `erp-btn--${size}` : "",
    fullWidth ? "erp-btn--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} disabled={disabled || loading} className={classes} {...rest}>
      {loading ? <Spinner size={14} /> : icon ? <Icon name={icon} size={size === "sm" ? 14 : 15} /> : null}
      {children && <span>{children}</span>}
      {!loading && iconRight ? <Icon name={iconRight} size={size === "sm" ? 14 : 15} /> : null}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  size = "md",
  type = "button",
  className = "",
  ...rest
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`erp-icon-btn ${size === "sm" ? "erp-icon-btn--sm" : ""} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 15 : 17} />
    </button>
  );
}

export function Field({ label, htmlFor, required = false, hint, error, children, style }) {
  const autoId = useId();
  const id = htmlFor || autoId;
  return (
    <div className="erp-field" style={style}>
      {label && (
        <label htmlFor={id} className="erp-label">
          {label}
          {required && <span style={{ color: "var(--erp-danger)", marginLeft: 3 }}>*</span>}
        </label>
      )}
      {typeof children === "function" ? children(id) : children}
      {error ? (
        <div className="erp-field-error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="erp-field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

export function TextInput({ size = "md", invalid = false, className = "", ...rest }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`erp-input ${size !== "md" ? `erp-input--${size}` : ""} ${className}`}
      {...rest}
    />
  );
}

export function PasswordInput({
  value,
  onChange,
  size = "lg",
  invalid = false,
  placeholder = "Digite sua senha",
  autoComplete = "current-password",
  id,
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        className={`erp-input ${size !== "md" ? `erp-input--${size}` : ""}`}
        style={{ paddingRight: 38 }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        title={visible ? "Ocultar senha" : "Mostrar senha"}
        style={{
          position: "absolute",
          right: 6,
          width: 28,
          height: 28,
          border: "none",
          background: "transparent",
          color: "var(--erp-ink-muted)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
        }}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={16} />
      </button>
    </div>
  );
}

export function Select({ size = "md", invalid = false, className = "", children, ...rest }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`erp-select ${size !== "md" ? `erp-select--${size}` : ""} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Pesquisar...",
  size = "md",
  onClear,
  style,
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", ...style }}>
      <Icon
        name="search"
        size={14}
        style={{ position: "absolute", left: 10, color: "var(--erp-ink-muted)", pointerEvents: "none" }}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`erp-input ${size !== "md" ? `erp-input--${size}` : ""}`}
        style={{ paddingLeft: 30, paddingRight: value && onClear ? 28 : 10 }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar busca"
          style={{
            position: "absolute",
            right: 6,
            border: "none",
            background: "transparent",
            color: "var(--erp-ink-muted)",
            cursor: "pointer",
            padding: 2,
          }}
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}

export function Badge({ tone = "neutral", dot = false, children, style }) {
  return (
    <span className={`erp-badge erp-badge--${tone}`} style={style}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            display: "inline-block",
          }}
        />
      )}
      {children}
    </span>
  );
}

export function Alert({ tone = "info", title, action, children, style }) {
  const iconMap = { info: "info", success: "check", warning: "alert", danger: "alert" };
  return (
    <div className={`erp-alert erp-alert--${tone}`} role="status" style={style}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon name={iconMap[tone] || "info"} size={17} style={{ marginTop: 2 }} />
        <div>
          {title && <div style={{ fontWeight: 700, marginBottom: children ? 2 : 0 }}>{title}</div>}
          {children && <div style={{ lineHeight: 1.45 }}>{children}</div>}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function Tabs({ items = [], activeId, onChange, ariaLabel = "Seções" }) {
  return (
    <div className="erp-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isSelected = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(item.id)}
            className="erp-tab"
          >
            {item.icon && <Icon name={item.icon} size={15} />}
            <span>{item.label}</span>
            {item.badge != null && <Badge tone={isSelected ? "brand" : "neutral"}>{item.badge}</Badge>}
          </button>
        );
      })}
    </div>
  );
}

export function Accordion({ title, badge, defaultOpen = false, open: controlledOpen, onToggle, children }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = () => {
    if (onToggle) onToggle(!isOpen);
    else setInternalOpen((v) => !v);
  };

  return (
    <div className="erp-accordion">
      <button type="button" className="erp-accordion-hdr" aria-expanded={isOpen} onClick={toggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={15} />
          <span>{title}</span>
          {badge != null && <Badge tone="neutral">{badge}</Badge>}
        </div>
      </button>
      {isOpen && <div className="erp-accordion-body">{children}</div>}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  size = "md", // 'sm' | 'md' | 'lg'
  footer,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="erp-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`erp-dialog ${size !== "md" ? `erp-dialog--${size}` : ""}`}
      >
        <div className="erp-dialog-hdr">
          <h2 className="erp-dialog-title">{title}</h2>
          {onClose && <IconButton icon="x" label="Fechar diálogo" size="sm" onClick={onClose} />}
        </div>
        <div className="erp-dialog-body">{children}</div>
        {footer && <div className="erp-dialog-ftr">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, ...rest }) {
  if (!open) return null;
  return <ConfirmDialogOpen {...rest} />;
}

function ConfirmDialogOpen({
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  danger = false,
  requirePhrase = "",
  busy = false,
  children,
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = !requirePhrase || typed.trim() === requirePhrase;

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={!canConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {description && (
          <p style={{ margin: 0, fontSize: "var(--erp-text-sm)", color: "var(--erp-ink-secondary)" }}>
            {description}
          </p>
        )}
        {children}
        {requirePhrase && (
          <Field
            label={`Digite "${requirePhrase}" para habilitar a confirmação`}
            required
          >
            {(id) => (
              <TextInput
                id={id}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requirePhrase}
                autoComplete="off"
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  );
}

export function SidePanel({ open, onClose, title, subtitle, footer, width = 520, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="erp-drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="erp-drawer"
        style={{ width }}
      >
        <div className="erp-dialog-hdr">
          <div>
            <h2 className="erp-dialog-title">{title}</h2>
            {subtitle && (
              <div style={{ fontSize: "var(--erp-text-xs)", color: "var(--erp-ink-muted)", marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {onClose && <IconButton icon="x" label="Fechar painel" size="sm" onClick={onClose} />}
        </div>
        <div className="erp-dialog-body" style={{ flex: 1 }}>
          {children}
        </div>
        {footer && <div className="erp-dialog-ftr">{footer}</div>}
      </aside>
    </div>
  );
}

export function PopoverMenu({ trigger, items = [], align = "right" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          className="erp-popover"
          style={align === "left" ? { left: 0, right: "auto" } : { right: 0 }}
        >
          {items.map((item, idx) => {
            if (item.separator) {
              return <div key={`sep_${idx}`} className="erp-menu-sep" role="separator" />;
            }
            return (
              <button
                key={item.id || idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  if (item.onClick) item.onClick();
                }}
                className={`erp-menu-item ${item.danger ? "erp-menu-item--danger" : ""}`}
              >
                {item.icon && <Icon name={item.icon} size={15} />}
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, meta, actions }) {
  return (
    <header className="erp-page-header no-print">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="erp-page-title">{title}</h1>
          {meta}
        </div>
        {subtitle && <p className="erp-page-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </header>
  );
}

export function Toolbar({ children, style, className = "" }) {
  return (
    <div className={`erp-toolbar no-print ${className}`} style={style}>
      {children}
    </div>
  );
}

export function ToolbarGroup({ children }) {
  return <div className="erp-toolbar-group">{children}</div>;
}

export function ToolbarDivider() {
  return <div className="erp-toolbar-divider" role="separator" />;
}

export function FilterBar({
  primaryFilters,
  advancedFilters,
  activeFilterCount = 0,
  onClearFilters,
  rightSlot,
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="erp-surface no-print" style={{ marginBottom: 12 }}>
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
          {primaryFilters}
          {advancedFilters && (
            <Button
              variant="secondary"
              size="md"
              icon="filter"
              onClick={() => setExpanded((v) => !v)}
            >
              Mais filtros
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          )}
          {activeFilterCount > 0 && onClearFilters && (
            <Button variant="tertiary" size="sm" icon="x" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
        {rightSlot && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{rightSlot}</div>}
      </div>
      {advancedFilters && expanded && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--erp-border)",
            background: "var(--erp-surface-subtle)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          {advancedFilters}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon = "info", title, description, action }) {
  return (
    <div
      style={{
        padding: "36px 20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        color: "var(--erp-ink-muted)",
      }}
    >
      <Icon name={icon} size={28} />
      <div style={{ fontSize: "var(--erp-text-md)", fontWeight: 700, color: "var(--erp-ink)" }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: "var(--erp-text-sm)", maxWidth: 420 }}>{description}</div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      style={{ animation: "erp-spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes erp-spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function Kbd({ children }) {
  return (
    <kbd
      style={{
        display: "inline-block",
        padding: "1px 5px",
        fontSize: 11,
        fontFamily: "var(--erp-font-mono)",
        background: "var(--erp-surface-muted)",
        border: "1px solid var(--erp-border-strong)",
        borderRadius: 4,
        color: "var(--erp-ink-secondary)",
      }}
    >
      {children}
    </kbd>
  );
}
