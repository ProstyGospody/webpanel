import { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type MaterialIconProps = {
  name: string;
  filled?: boolean;
  className?: string;
};

export function MaterialIcon({ name, filled = false, className }: MaterialIconProps) {
  return <span aria-hidden className={cn("material-symbols-rounded", filled && "md-icon--filled", className)}>{name}</span>;
}

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
};

export function Button({ variant = "filled", icon, trailingIcon, className, children, fullWidth = false, ...props }: ButtonProps) {
  return (
    <button className={cn("md-button", `md-button--${variant}`, fullWidth && "md-button--full", className)} {...props}>
      {icon && <MaterialIcon name={icon} className="md-button__icon" />}
      <span>{children}</span>
      {trailingIcon && <MaterialIcon name={trailingIcon} className="md-button__icon" />}
    </button>
  );
}

type IconButtonVariant = "standard" | "filled" | "tonal" | "outlined";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
  variant?: IconButtonVariant;
};

export function IconButton({ icon, label, variant = "standard", className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn("md-icon-button", variant !== "standard" && `md-icon-button--${variant}`, className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <MaterialIcon name={icon} />
    </button>
  );
}

type StatusTone = "neutral" | "success" | "warning" | "error" | "info";

type StatusBadgeProps = {
  tone?: StatusTone;
  children?: ReactNode;
  icon?: string;
  enabled?: boolean;
  trueLabel?: string;
  falseLabel?: string;
};

export function StatusBadge({ tone = "neutral", children, icon, enabled, trueLabel = "Enabled", falseLabel = "Disabled" }: StatusBadgeProps) {
  const resolvedTone = enabled === undefined ? tone : enabled ? "success" : "error";
  const label = children || (enabled === undefined ? "-" : enabled ? trueLabel : falseLabel);
  return (
    <span className={cn("md-badge", `md-badge--${resolvedTone}`)}>
      {icon && <MaterialIcon name={icon} />}
      {label}
    </span>
  );
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, meta }: PageHeaderProps) {
  return (
    <header className="md-page-header">
      <div className="md-page-header__titles">
        <h1 className="md-page-title">{title}</h1>
        {subtitle && <p className="md-page-subtitle">{subtitle}</p>}
      </div>
      {(actions || meta) && (
        <div>
          {actions && <div className="md-page-actions">{actions}</div>}
          {meta && <div className="md-page-meta">{meta}</div>}
        </div>
      )}
    </header>
  );
}

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  outlined?: boolean;
}>;

export function Card({ title, subtitle, action, className, children, outlined = false }: CardProps) {
  return (
    <section className={cn("md-card", outlined && "md-card--outlined", className)}>
      {(title || subtitle || action) && (
        <header className="md-card__header">
          <div>
            {title && <h2 className="md-card__title">{title}</h2>}
            {subtitle && <p className="md-card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="md-card__content">{children}</div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="md-metric-card">
      <div className="md-metric-label">{label}</div>
      <div className="md-metric-value">{value}</div>
      {hint && <div className="md-metric-hint">{hint}</div>}
    </div>
  );
}

type MessageTone = "info" | "warning" | "error" | "success";

type InlineMessageProps = {
  tone?: MessageTone;
  children: ReactNode;
};

export function InlineMessage({ tone = "info", children }: InlineMessageProps) {
  const iconByTone: Record<MessageTone, string> = {
    info: "info",
    warning: "warning",
    error: "error",
    success: "check_circle",
  };

  return (
    <div className={cn("md-inline-message", `md-inline-message--${tone}`)}>
      <MaterialIcon name={iconByTone[tone]} />
      <div>{children}</div>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon = "inbox", action }: EmptyStateProps) {
  return (
    <div className="md-empty-state" role="status" aria-live="polite">
      <MaterialIcon name={icon} />
      <p className="md-empty-state__title">{title}</p>
      {description && <p className="md-empty-state__description">{description}</p>}
      {action && <div className="md-page-actions" style={{ justifyContent: "center", marginTop: 12 }}>{action}</div>}
    </div>
  );
}

type LinearProgressProps = {
  value?: number;
  indeterminate?: boolean;
};

export function LinearProgress({ value = 0, indeterminate = false }: LinearProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("md-linear-progress", indeterminate && "md-linear-progress--indeterminate")} aria-hidden>
      <div className="md-linear-progress__bar" style={{ width: indeterminate ? undefined : `${clamped}%` }} />
    </div>
  );
}

export function CircularProgress() {
  return <span className="md-circular-progress" aria-hidden />;
}

type BaseFieldProps = {
  label: string;
  supportingText?: string;
  errorText?: string;
  className?: string;
};

type TextFieldProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, supportingText, errorText, className, ...props }: TextFieldProps) {
  return (
    <label className={cn("md-field", errorText && "md-field--error", className)}>
      <span className="md-field__label">{label}</span>
      <input className="md-field__control" {...props} />
      {(errorText || supportingText) && <span className="md-field__supporting">{errorText || supportingText}</span>}
    </label>
  );
}

type SelectFieldProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
};

export function SelectField({ label, supportingText, errorText, className, options, ...props }: SelectFieldProps) {
  return (
    <label className={cn("md-field", errorText && "md-field--error", className)}>
      <span className="md-field__label">{label}</span>
      <select className="md-field__control" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {(errorText || supportingText) && <span className="md-field__supporting">{errorText || supportingText}</span>}
    </label>
  );
}

type TextareaFieldProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({ label, supportingText, errorText, className, ...props }: TextareaFieldProps) {
  return (
    <label className={cn("md-field", errorText && "md-field--error", className)}>
      <span className="md-field__label">{label}</span>
      <textarea className="md-field__control" {...props} />
      {(errorText || supportingText) && <span className="md-field__supporting">{errorText || supportingText}</span>}
    </label>
  );
}

type SwitchFieldProps = {
  label: string;
  supportingText?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function SwitchField({ label, supportingText, checked, onChange, disabled = false }: SwitchFieldProps) {
  return (
    <label className="md-switch-field">
      <span className="md-switch-field__text">
        <span className="md-switch-field__label">{label}</span>
        {supportingText && <span className="md-switch-field__supporting">{supportingText}</span>}
      </span>
      <input className="md-switch" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
    </label>
  );
}

